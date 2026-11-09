import cv2, numpy as np, sys, json
src, out, t0, t1 = sys.argv[1], sys.argv[2], float(sys.argv[3]), float(sys.argv[4])
cap = cv2.VideoCapture(src)
K = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (25, 25))
D = cv2.getStructuringElement(cv2.MORPH_RECT, (15, 45))
def textmask(f):
    b, g, r = [c.astype(np.int16) for c in cv2.split(f)]
    gold = (r > 140) & (r - b > 50) & (g > 90) & (g - b > 20)
    th = cv2.morphologyEx(cv2.cvtColor(f, cv2.COLOR_BGR2GRAY), cv2.MORPH_TOPHAT, K)
    return (gold & (th > 35)).astype(np.uint8) * 255
f0, f1 = round(t0 * 30), round(t1 * 30)
cap.set(cv2.CAP_PROP_POS_FRAMES, f0)
tracks = []
CUTS = [int(c) for c in (sys.argv[5].split(",") if len(sys.argv) > 5 else [])]
for fi in range(f0, f1):
    if fi in CUTS:
        for tr in tracks: tr["last"] = -999
    ok, f = cap.read()
    if not ok: break
    m = textmask(f)
    n, lab, st, cen = cv2.connectedComponentsWithStats(cv2.dilate(m, D))
    dets = []
    for i in range(1, n):
        x, y, w, h, a = st[i]
        if h >= 110 and h >= 2.2 * w:
            px = int((m[y:y+h, x:x+w] > 0).sum())
            dets.append([int(x), int(y), int(w), int(h), px])
    for d in dets:
        cx = d[0] + d[2] / 2
        best, bd = None, 1e9
        for tr in tracks:
            if fi - tr['last'] > 4: continue
            L = tr['f'][-1]
            lcx = L[1] + L[3] / 2
            ov = min(d[1] + d[3], L[2] + L[4]) - max(d[1], L[2])
            dist = abs(cx - lcx)
            if dist < 70 and ov > 0 and dist < bd: best, bd = tr, dist
        if best is not None and best['last'] != fi:
            best['f'].append([fi] + d); best['last'] = fi
        else:
            tracks.append({'id': len(tracks), 'f': [[fi] + d], 'last': fi})
res = []
for tr in tracks:
    fr = tr['f']
    if len(fr) < 6: continue
    px = sum(x[5] for x in fr) / len(fr)
    xs = [x[1] + x[3] / 2 for x in fr]; ys = [x[2] for x in fr]
    res.append({'id': tr['id'], 'start': fr[0][0] / 30, 'end': fr[-1][0] / 30, 'n': len(fr), 'px': px, 'f': fr})
    print(f"#{tr['id']:3d} {fr[0][0]/30:6.2f}-{fr[-1][0]/30:6.2f} n={len(fr):3d} x {min(xs):5.0f}->{xs[-1]:5.0f} y {fr[0][2]:4d} h~{np.median([x[4] for x in fr]):4.0f} w~{np.median([x[3] for x in fr]):3.0f} px~{px:5.0f}")
json.dump(res, open(out, 'w'))
