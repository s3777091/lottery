"""Remove the gold calligraphy (inside tracked column boxes) and the corner watermarks, re-encode.

usage: erase.py SRC COLS_JSON START_FRAME N_FRAMES OUT.mp4 FFMPEG [debug_dir]
"""
import cv2, numpy as np, sys, json, subprocess, os

src, cj, start, n, out, ffmpeg = sys.argv[1], sys.argv[2], int(sys.argv[3]), int(sys.argv[4]), sys.argv[5], sys.argv[6]
dbg = sys.argv[7] if len(sys.argv) > 7 and sys.argv[7] != '-' else None
GLOBAL = [tuple(map(int, r.split('-'))) for r in (sys.argv[8].split(',') if len(sys.argv) > 8 else [])]
K31 = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (31, 31))

def global_mask(f):
    b, g, r = [c.astype(np.int16) for c in cv2.split(f)]
    gray = cv2.cvtColor(f, cv2.COLOR_BGR2GRAY)
    th = cv2.morphologyEx(gray, cv2.MORPH_TOPHAT, K31)
    hsv = cv2.cvtColor(f, cv2.COLOR_BGR2HSV)
    ch = ((hsv[..., 2] > 140) & (hsv[..., 1] < 90)).astype(np.uint8)
    ch = cv2.dilate(cv2.morphologyEx(ch, cv2.MORPH_OPEN, np.ones((7, 7), np.uint8)), np.ones((21, 21), np.uint8))
    m = ((th > 18) & (r - b > 30) & (r > 90) & (ch == 0)).astype(np.uint8) * 255
    return cv2.dilate(m, np.ones((5, 5), np.uint8), iterations=2)
cols = json.load(open(cj))['columns']
byframe = {}
for c in cols:
    act = [fr for fr in c['frames'] if fr['i'] > 0.02]
    if not act: continue
    lo, hi = act[0]['f'] - 10, act[-1]['f'] + 6
    if c['kind'] in ('small', 'orn'): lo, hi = c['frames'][0]['f'], c['frames'][-1]['f']
    for fr in c['frames']:
        if lo <= fr['f'] <= hi:
            byframe.setdefault(fr['f'], []).append((c['kind'] + ('-big' if c['id'].startswith('P') else ''), np.array(fr['b'], np.float32).reshape(4, 2)))

WM = [(4, 2, 78, 108), (4, 1040, 116, 1074)]  # x0, y0, x1, y1 (top-left figure, bottom-left ID)
K = {'orn': cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (27, 27)), 'small': cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (27, 27)),
     'hair': cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (27, 27)),
     'brush': cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (61, 61))}

def expand(box, kind):
    c = box.mean(0)
    u = (box[1] - box[0]); v = (box[3] - box[0])
    w, h = np.linalg.norm(u), np.linalg.norm(v)
    su = (w * (1.35 if kind != 'brush' else 1.15) + 24) / max(w, 1)
    sv = (h * 1.06 + 24) / max(h, 1)
    return np.array([c - u * su / 2 - v * sv / 2, c + u * su / 2 - v * sv / 2, c + u * su / 2 + v * sv / 2, c - u * su / 2 + v * sv / 2], np.float32)

def gold_mask(f, kind, box):
    """Mask of gold text + glow for inpainting (hair / brush columns)."""
    H, W = f.shape[:2]
    eb = expand(box, kind)
    x0, y0 = np.floor(eb.min(0)).astype(int); x1, y1 = np.ceil(eb.max(0)).astype(int)
    x0, y0 = max(0, x0), max(0, y0); x1, y1 = min(W, x1), min(H, y1)
    if x1 - x0 < 4 or y1 - y0 < 4: return None, None
    crop = f[y0:y1, x0:x1].astype(np.float32)
    b, g, r = crop[..., 0], crop[..., 1], crop[..., 2]
    lum = 0.299 * r + 0.587 * g + 0.114 * b
    if kind == 'brush':
        m = ((r - b > 40) & (lum > 50)) | (lum > 185)
        it = 3
    else:
        m = ((r - b > 14) & (lum > 140)) | ((lum > 230) & (r - b > 4))
        th = cv2.morphologyEx(cv2.cvtColor(f[y0:y1, x0:x1], cv2.COLOR_BGR2GRAY), cv2.MORPH_TOPHAT, K['hair'])
        m = m | ((th > 16) & (r - b > 6) & (r > 140))
        it = 2
    poly = np.zeros(lum.shape, np.uint8)
    cv2.fillConvexPoly(poly, (eb - [x0, y0]).astype(np.int32), 1)
    m = (m & (poly > 0)).astype(np.uint8) * 255
    m = cv2.dilate(m, np.ones((5, 5), np.uint8), iterations=it)
    return m, (x0, y0, x1, y1)

def fill_strokes(f, box, big=False):
    """Remove thin bright strokes by replacing them with a local median background (keeps glow halos)."""
    H, W = f.shape[:2]
    eb = expand(box, 'orn')
    P = 30
    x0, y0 = np.floor(eb.min(0)).astype(int) - P; x1, y1 = np.ceil(eb.max(0)).astype(int) + P
    x0, y0 = max(0, x0), max(0, y0); x1, y1 = min(W, x1), min(H, y1)
    if x1 - x0 < 8 or y1 - y0 < 8: return
    crop = f[y0:y1, x0:x1]
    sc = 0.2 if big else 0.5
    small = cv2.resize(crop, None, fx=sc, fy=sc, interpolation=cv2.INTER_AREA)
    med = cv2.medianBlur(cv2.medianBlur(small, 21), 9)
    if big: med = cv2.GaussianBlur(med, (0, 0), 3)
    bg = cv2.resize(med, (crop.shape[1], crop.shape[0]), interpolation=cv2.INTER_LINEAR).astype(np.float32)
    cf = crop.astype(np.float32)
    lum = cf @ np.float32([0.114, 0.587, 0.299]); blum = bg @ np.float32([0.114, 0.587, 0.299])
    m = ((lum - blum) > (5 if big else 10)).astype(np.uint8)
    poly = np.zeros(m.shape, np.uint8)
    cv2.fillConvexPoly(poly, (eb - [x0, y0]).astype(np.int32), 1)
    m = cv2.dilate(m & poly, np.ones((5, 5), np.uint8), iterations=2 if big else 1)
    a = cv2.GaussianBlur(m.astype(np.float32), (0, 0), 1.5)[..., None]
    # soften the edge of the whole region so no rectangle shows
    edge = cv2.GaussianBlur(poly.astype(np.float32), (0, 0), 12)[..., None]
    a = a * np.clip(edge * 1.6, 0, 1)
    out = cf * (1 - a) + np.minimum(bg, cf) * a
    f[y0:y1, x0:x1] = np.clip(out, 0, 255).astype(np.uint8)

def fill_column(f, kind, box):
    """Replace glowing gold pixels inside the column with background estimated around them."""
    H, W = f.shape[:2]
    eb = expand(box, kind)
    P = 40
    x0, y0 = np.floor(eb.min(0)).astype(int) - P; x1, y1 = np.ceil(eb.max(0)).astype(int) + P
    x0, y0 = max(0, x0), max(0, y0); x1, y1 = min(W, x1), min(H, y1)
    if x1 - x0 < 8 or y1 - y0 < 8: return
    crop = f[y0:y1, x0:x1].astype(np.float32)
    b, g, r = crop[..., 0], crop[..., 1], crop[..., 2]
    lum = 0.299 * r + 0.587 * g + 0.114 * b
    poly = np.zeros(lum.shape, np.uint8)
    cv2.fillConvexPoly(poly, (eb - [x0, y0]).astype(np.int32), 1)
    if kind == 'brush':
        m = ((r - b > 45) & (lum > 55)) | ((lum > 215) & (r - b > 15))
    elif kind == 'hair':
        m = ((r - b > 16) & (lum > 110)) | ((lum > 232) & (r - b > 4))
    elif kind == 'orn':
        m = ((r - b > 30) & (lum > 45)) | ((lum > 190) & (r - b > 14))
    else:
        m = ((r - b > 12) & (lum > 30)) | ((lum > 180) & (r - b > 5))
    m = (m & (poly > 0)).astype(np.uint8)
    m = cv2.dilate(m, np.ones((7, 7), np.uint8), iterations=1 if kind in ('small', 'orn') else 2)
    keep = (1 - m).astype(np.float32)
    sig = 22 if kind == 'brush' else 14
    num = cv2.GaussianBlur(crop * keep[..., None], (0, 0), sig)
    den = cv2.GaussianBlur(keep, (0, 0), sig)[..., None]
    bg = num / np.maximum(den, 1e-3)
    # where the hole is wider than the blur, fall back to a much wider estimate
    num2 = cv2.GaussianBlur(crop * keep[..., None], (0, 0), sig * 4)
    den2 = cv2.GaussianBlur(keep, (0, 0), sig * 4)[..., None]
    bg = np.where(den > 0.05, bg, num2 / np.maximum(den2, 1e-3))
    a = cv2.GaussianBlur(m.astype(np.float32), (0, 0), 2.5)[..., None]
    out = crop * (1 - a) + bg * a
    f[y0:y1, x0:x1] = np.clip(out, 0, 255).astype(np.uint8)

def column_mask(f, kind, box):
    H, W = f.shape[:2]
    eb = expand(box, kind)
    x0, y0 = np.floor(eb.min(0)).astype(int); x1, y1 = np.ceil(eb.max(0)).astype(int)
    x0, y0 = max(0, x0), max(0, y0); x1, y1 = min(W, x1), min(H, y1)
    if x1 - x0 < 4 or y1 - y0 < 4: return None, None
    crop = f[y0:y1, x0:x1]
    b, g, r = [c.astype(np.int16) for c in cv2.split(crop)]
    gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
    th = cv2.morphologyEx(gray, cv2.MORPH_TOPHAT, K[kind])
    if kind == 'hair':
        m = (th > 16) & (r - b > 6) & (r > 140)
    else:
        m = (th > 14) & (r - b > 14) & (r > 80)
    m = m.astype(np.uint8) * 255
    poly = np.zeros_like(m)
    cv2.fillConvexPoly(poly, (eb - [x0, y0]).astype(np.int32), 255)
    m = cv2.bitwise_and(m, poly)
    m = cv2.dilate(m, np.ones((5, 5), np.uint8), iterations=2 if kind == 'brush' else 1)
    return m, (x0, y0, x1, y1)

cap = cv2.VideoCapture(src)
for _ in range(start): cap.grab()
W, H = 1920, 1080
enc = subprocess.Popen([ffmpeg, '-hide_banner', '-loglevel', 'error', '-y',
    '-f', 'rawvideo', '-pix_fmt', 'bgr24', '-s', f'{W}x{H}', '-r', '30', '-i', '-',
    '-ss', f'{start / 30:.4f}', '-t', f'{n / 30:.4f}', '-i', src,
    '-map', '0:v', '-map', '1:a', '-c:v', 'libx264', '-preset', 'slow', '-crf', '19', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', '-shortest', out], stdin=subprocess.PIPE)
for k in range(n):
    ok, f = cap.read()
    if not ok: break
    fi = start + k
    mask = np.zeros((H, W), np.uint8)
    for x0, y0, x1, y1 in WM: mask[y0:y1, x0:x1] = 255
    if any(a <= fi <= b for a, b in GLOBAL): mask = cv2.bitwise_or(mask, global_mask(f))
    orig = f.copy() if dbg else None
    for kind, box in byframe.get(fi, []):
        if kind in ('hair', 'brush'):
            m, r = gold_mask(f, kind, box) if kind == 'brush' else column_mask(f, kind, box)
            if m is not None:
                x0, y0, x1, y1 = r
                mask[y0:y1, x0:x1] = cv2.bitwise_or(mask[y0:y1, x0:x1], m)
        elif kind.startswith('orn'):
            fill_strokes(f, box, kind.endswith('-big'))
        else:
            fill_column(f, kind, box)
    g = cv2.inpaint(f, mask, 5, cv2.INPAINT_TELEA)
    if dbg: f = orig
    if dbg and k % 15 == 0:
        cv2.imwrite(os.path.join(dbg, f'e{fi:04d}.jpg'), np.hstack([cv2.resize(f, (960, 540)), cv2.resize(g, (960, 540))]))
    enc.stdin.write(g.tobytes())
enc.stdin.close()
enc.wait()
print('done', out, enc.returncode)
