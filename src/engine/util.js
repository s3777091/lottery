// @ts-nocheck
/* Shared helpers: math, easing, canvas and text sampling. */
export const L = {};
{
  L.TAU = Math.PI * 2;
  L.rand = (a, b) => (b === undefined ? Math.random() * a : a + Math.random() * (b - a));
  L.pick = (arr) => arr[(Math.random() * arr.length) | 0];
  L.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  L.lerp = (a, b, t) => a + (b - a) * t;

  L.ease = {
    outCubic: (t) => 1 - Math.pow(1 - t, 3),
    inOutSine: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
    outBack: (t) => {
      const c1 = 1.70158, c3 = c1 + 1;
      return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
    },
  };

  L.view = { W: 1920, H: 1080, u: 1, dpr: 1 };

  L.canvas = (w, h) => {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  };

  /* ---------- Text ---------- */
  let _m = null;
  const M = () => (_m || (_m = L.canvas(4, 4).getContext('2d')));
  const fontStr = (o, size) => `${o.weight || 700} ${size}px ${o.family}`;

  const measure = (text, o, size) => {
    M().font = fontStr(o, size);
    return M().measureText(text).width;
  };
  L.fitSize = (text, o, size, maxW) => {
    const w = measure(text, o, size);
    return w > maxW ? (size * maxW) / w : size;
  };

  // Pixel points of the text (relative to text center), capped near maxPts.
  L.samplePoints = (text, o, size, maxPts = 900) => {
    const tw = measure(text, o, size);
    const w = Math.ceil(tw + size), h = Math.ceil(size * 2.1);
    const c = L.canvas(w, h), x = c.getContext('2d', { willReadFrequently: true });
    x.font = fontStr(o, size);
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.fillStyle = '#fff';
    x.fillText(text, w / 2, h / 2);
    const d = x.getImageData(0, 0, w, h).data;
    let filled = 0;
    for (let i = 3; i < d.length; i += 16) if (d[i] > 120) filled++;
    filled *= 4;
    const step = Math.max(1, Math.sqrt(filled / maxPts));
    const pts = [];
    for (let yy = 0; yy < h; yy += step) {
      const iy = yy | 0;
      for (let xx = 0; xx < w; xx += step) {
        const ix = xx | 0;
        if (d[(iy * w + ix) * 4 + 3] > 120) {
          pts.push(ix - w / 2 + (Math.random() - 0.5) * step * 0.7, iy - h / 2 + (Math.random() - 0.5) * step * 0.7);
        }
      }
    }
    // vertical "pen" profile across the width, for the brush-writing tip
    const B = 40, sum = new Float32Array(B), cnt = new Float32Array(B);
    for (let i = 0; i < pts.length; i += 2) {
      const b = L.clamp((((pts[i] + tw / 2) / tw) * B) | 0, 0, B - 1);
      sum[b] += pts[i + 1]; cnt[b]++;
    }
    const prof = new Float32Array(B);
    let last = 0;
    for (let b = 0; b < B; b++) { if (cnt[b]) last = sum[b] / cnt[b]; prof[b] = last; }
    return { pts, tw, size, prof };
  };
}
