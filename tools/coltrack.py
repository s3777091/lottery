"""Planar-track text columns through a shot.

spec JSON: {"src": video, "fps": 30, "columns": [
   {"id": "c1", "kind": "small|hair|brush", "ref": 9.6, "box": [x, y, w, h], "angle": 0,
    "range": [t0, t1]} ...]}
Writes per-frame oriented boxes (TL,TR,BR,BL), text intensity and reveal fraction.
"""
import cv2, numpy as np, sys, json

spec = json.load(open(sys.argv[1]))
out = sys.argv[2]
cap = cv2.VideoCapture(spec['src'])
FPS = spec.get('fps', 30)
K = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (25, 25))

cache = {}
def frame(fi):
    if fi not in cache:
        cap.set(cv2.CAP_PROP_POS_FRAMES, fi)
        ok, f = cap.read()
        if not ok: return None
        g = cv2.cvtColor(f, cv2.COLOR_BGR2GRAY)
        cache[fi] = (f, g)
    return cache[fi]

def textmask(f, g, kind):
    b, gg, r = [c.astype(np.int16) for c in cv2.split(f)]
    th = cv2.morphologyEx(g, cv2.MORPH_TOPHAT, K)
    if kind == 'hair':
        return ((th > 28) & (r - b > 12) & (r > 150)).astype(np.uint8)
    if kind == 'orn':
        return ((th > 12) & (r - b > 15) & (r > 70)).astype(np.uint8)
    return ((th > 28) & (r - b > 30) & (r > 120)).astype(np.uint8)

def box_from(x, y, w, h, ang):
    c = np.array([x + w / 2, y + h / 2])
    a = np.deg2rad(ang)
    u = np.array([np.cos(a), np.sin(a)]) * w / 2      # across
    v = np.array([-np.sin(a), np.cos(a)]) * h / 2     # down the column
    return np.array([c - u - v, c + u - v, c + u + v, c - u + v], np.float32)

def region_mask(shape, box, pad):
    m = np.zeros(shape, np.uint8)
    c = box.mean(0)
    big = c + (box - c) * 1.0
    poly = big.astype(np.int32)
    cv2.fillConvexPoly(m, poly, 255)
    return cv2.dilate(m, cv2.getStructuringElement(cv2.MORPH_RECT, (pad * 2 + 1, pad * 2 + 1)))

charmask = {}
def notchar(fi):
    if fi not in charmask:
        f = frame(fi)[0]
        hsv = cv2.cvtColor(f, cv2.COLOR_BGR2HSV)
        ch = ((hsv[..., 2] > 150) & (hsv[..., 1] < 80)).astype(np.uint8)
        ch = cv2.morphologyEx(ch, cv2.MORPH_OPEN, np.ones((9, 9), np.uint8))
        ch = cv2.dilate(ch, np.ones((25, 25), np.uint8))
        charmask[fi] = (ch == 0).astype(np.uint8) * 255
    return charmask[fi]

def step(fa, fb, box, pad=140, avoid=False):
    """Track box from frame fa to fb (adjacent) with LK + clamped similarity."""
    A, B = frame(fa), frame(fb)
    if A is None or B is None: return box, 0
    ga, gb = A[1], B[1]
    rm = region_mask(ga.shape, box, pad)
    if avoid: rm = cv2.bitwise_and(rm, notchar(fa))
    pts = cv2.goodFeaturesToTrack(ga, 300, 0.01, 6, mask=rm)
    if pts is None or len(pts) < 8: return box, 0
    nxt, st, err = cv2.calcOpticalFlowPyrLK(ga, gb, pts, None, winSize=(21, 21), maxLevel=3)
    ok = st.ravel() == 1
    if ok.sum() < 8: return box, 0
    M, inl = cv2.estimateAffinePartial2D(pts[ok], nxt[ok], method=cv2.RANSAC, ransacReprojThreshold=2.5)
    if M is None: return box, 0
    sc = np.hypot(M[0, 0], M[1, 0]); ang = np.arctan2(M[1, 0], M[0, 0])
    sc = np.clip(sc, 0.975, 1.025); ang = np.clip(ang, -0.03, 0.03)
    c = box.mean(0)
    nc = c @ M[:, :2].T + M[:, 2]
    R = np.array([[np.cos(ang), -np.sin(ang)], [np.sin(ang), np.cos(ang)]]) * sc
    nb = ((box - c) @ R.T + nc).astype(np.float32)
    return nb, int(inl.sum())

def measure(fi, box, kind):
    F = frame(fi)
    if F is None: return 0, 0, 0
    f, g = F
    w = np.linalg.norm(box[1] - box[0]); h = np.linalg.norm(box[3] - box[0])
    W, H = max(4, int(round(w))), max(4, int(round(h)))
    M = cv2.getAffineTransform(box[[0, 1, 3]], np.float32([[0, 0], [W, 0], [0, H]]))
    m = textmask(f, g, kind)
    crop = cv2.warpAffine(m, M, (W, H), flags=cv2.INTER_NEAREST)
    total = float(crop.sum())
    rows = crop.sum(1)
    nz = np.nonzero(rows > max(1, W * 0.02))[0]
    top = nz[0] / H if len(nz) else 0
    bot = (nz[-1] + 1) / H if len(nz) else 0
    return total, top, bot

result = {'fps': FPS, 'columns': []}
gcache = {}
for col in spec['columns']:
    kind = col.get('kind', 'small')
    ref = round(col['ref'] * FPS)
    f0, f1 = round(col['range'][0] * FPS), round(col['range'][1] * FPS)
    x, y, w, h = col['box']
    box = box_from(x, y, w, h, col.get('angle', 0))
    boxes = {ref: box}
    pad, avoid = col.get('pad', 140), col.get('avoid', False)
    link = next((c for c in result['columns'] if c['id'] == col.get('link')), None)
    if link:
        lb = {fr['f']: np.array(fr['b'], np.float32).reshape(4, 2) for fr in link['frames']}
        def rel(fa, fb):
            P, Q = lb[fa], lb[fb]
            M, _ = cv2.estimateAffinePartial2D(P, Q)
            return M
    tmpl = None
    if col.get('global'):
        F = frame(ref); w0 = int(np.linalg.norm(box[1] - box[0])); h0 = int(np.linalg.norm(box[3] - box[0]))
        Mr = cv2.getAffineTransform(box[[0, 1, 3]], np.float32([[0, 0], [w0, 0], [0, h0]]))
        tmpl = cv2.warpAffine(textmask(F[0], F[1], kind).astype(np.float32), Mr, (w0, h0))
        tmpl = cv2.GaussianBlur(tmpl, (0, 0), 3)
    def gstep(fa, fb, b):
        key = (fa, fb)
        if key not in gcache:
            A, B = frame(fa), frame(fb)
            nm = notchar(fa)
            pts = cv2.goodFeaturesToTrack(A[1], 800, 0.005, 10, mask=nm)
            nxt, st, _ = cv2.calcOpticalFlowPyrLK(A[1], B[1], pts, None, winSize=(31, 31), maxLevel=5)
            ok = st.ravel() == 1
            M, _ = cv2.estimateAffinePartial2D(pts[ok], nxt[ok], method=cv2.RANSAC, ransacReprojThreshold=3)
            gcache[key] = M
        M = gcache[key]
        nb = (b @ M[:, :2].T + M[:, 2]).astype(np.float32)
        # refine translation with the text template
        F = frame(fb); m = cv2.GaussianBlur(textmask(F[0], F[1], kind).astype(np.float32), (0, 0), 3)
        w0, h0 = tmpl.shape[1], tmpl.shape[0]; S = 60
        Mr = cv2.getAffineTransform(nb[[0, 1, 3]], np.float32([[S, S], [w0 + S, S], [S, h0 + S]]))
        win = cv2.warpAffine(m, Mr, (w0 + 2 * S, h0 + 2 * S))
        if win.sum() > tmpl.sum() * 0.15 and tmpl.sum() > 0:
            r = cv2.matchTemplate(win, tmpl, cv2.TM_CCORR_NORMED)
            _, mv, _, ml = cv2.minMaxLoc(r)
            if mv > 0.35:
                dx, dy = ml[0] - S, ml[1] - S
                ux = (nb[1] - nb[0]) / w0; uy = (nb[3] - nb[0]) / h0
                nb = (nb + ux * dx * 0.7 + uy * dy * 0.7).astype(np.float32)
        return nb, 1
    def adv(fa, fb, b):
        if tmpl is not None: return gstep(fa, fb, b)
        if link and fa in lb and fb in lb:
            M = rel(fa, fb)
            return (b @ M[:, :2].T + M[:, 2]).astype(np.float32), 99
        return step(fa, fb, b, pad, avoid)
    if col.get('keys'):
        ks = col['keys']  # [t, cx, cy, w, h, angle]
        for fi in range(f0, f1 + 1):
            t = fi / FPS
            if t <= ks[0][0]: k = ks[0]
            elif t >= ks[-1][0]: k = ks[-1]
            else:
                j = next(j for j in range(len(ks) - 1) if ks[j][0] <= t <= ks[j + 1][0])
                a, c2 = ks[j], ks[j + 1]; u = (t - a[0]) / (c2[0] - a[0])
                k = [a[i] + (c2[i] - a[i]) * u for i in range(6)]
            boxes[fi] = box_from(k[1] - k[3] / 2, k[2] - k[4] / 2, k[3], k[4], k[5])
        f0b, f1b = ref, ref
    else:
        f0b, f1b = f0, f1
    b = box
    for fi in range(ref, f1b):
        b, n = adv(fi, fi + 1, b); boxes[fi + 1] = b
    b = box
    for fi in range(ref, f0b, -1):
        b, n = adv(fi, fi - 1, b); boxes[fi - 1] = b
    frames = []
    for fi in range(f0, f1 + 1):
        bx = boxes[fi]
        tot, top, bot = measure(fi, bx, kind)
        frames.append({'f': fi, 'b': [round(float(v), 1) for v in bx.ravel()], 'px': tot, 'top': round(top, 3), 'bot': round(bot, 3)})
    mx = max(1, max(fr['px'] for fr in frames))
    for fr in frames:
        fr['i'] = round(min(1.0, fr['px'] / (mx * 0.8)), 3)
        if col.get('keys'): fr['i'] = 1.0; fr['top'] = 0; fr['bot'] = 1
    result['columns'].append({'id': col['id'], 'kind': kind, 'frames': frames})
    life = [fr['f'] / FPS for fr in frames if fr['i'] > 0.15]
    print(col['id'], kind, 'life', (round(life[0], 2), round(life[-1], 2)) if life else None)
    # cache trimming
    for k in list(cache):
        if k < f0 - 5: del cache[k]
json.dump(result, open(out, 'w'))
