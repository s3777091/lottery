"""Make a seamless forward loop from a clip: the last FADE frames are blended into the first ones.

out[j] = X[F + j]                                   for j <  N - 2F
out[j] = (1 - w) * X[F + j] + w * X[j - (N - 2F)]   for the last F frames, w eases 0 -> 1
so out[-1] == X[F - 1] and the loop restarts at X[F]: one ordinary frame step.

usage: loop_blend.py SRC OUT.mp4 FFMPEG FADE_SECONDS
"""
import cv2, numpy as np, sys, subprocess

src, out, ffmpeg, fade_s = sys.argv[1], sys.argv[2], sys.argv[3], float(sys.argv[4])
cap = cv2.VideoCapture(src)
N = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
fps = cap.get(cv2.CAP_PROP_FPS) or 60
W, H = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)), int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
F = min(int(round(fade_s * fps)), N // 3)
enc = subprocess.Popen([ffmpeg, '-hide_banner', '-loglevel', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'bgr24',
                        '-s', f'{W}x{H}', '-r', str(fps), '-i', '-', '-an', '-c:v', 'libx264', '-preset', 'medium',
                        '-crf', '16', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out], stdin=subprocess.PIPE)
head = cv2.VideoCapture(src)  # second decoder supplies X[0..F) for the blend
for _ in range(F): cap.grab()
for j in range(N - F):
    ok, f = cap.read()
    if not ok: break
    k = j - (N - 2 * F)
    if k >= 0:
        ok2, h = head.read()
        if ok2:
            t = (k + 1) / F
            w = t * t * (3 - 2 * t)  # smoothstep
            f = cv2.addWeighted(f, 1 - w, h, w, 0)
    enc.stdin.write(f.tobytes())
enc.stdin.close()
enc.wait()
print('loop', out, N - F, 'frames', enc.returncode)
