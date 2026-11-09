// Approved circlet artwork; all winner lettering remains editable at render time.
// The circlet is far wider than the other frames, so it is drawn taller (AY/AH) to share their footprint.
// The monkey medallion is then redrawn on top at an even scale, so its face keeps the artwork's true shape.
const W = 1360, H = 740, AY = 40, AH = 660;
// Medallion crop in art pixels (x, y, w, h) around the face on the lower rail.
const MEDAL = [900, 470, 300, 180];
let art, medal, pending;
function medallion() {
  if (medal || !art) return medal;
  const [mx, my, mw, mh] = MEDAL;
  medal = document.createElement('canvas'); medal.width = mw; medal.height = mh;
  const g = medal.getContext('2d', { willReadFrequently: true }); g.drawImage(art, mx, my, mw, mh, 0, 0, mw, mh);
  // Feather the crop sideways (and a little at top/bottom) so the wider rail blends into the stretched one.
  const img = g.getImageData(0, 0, mw, mh), d = img.data, sm = (a, b, v) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
  for (let y = 0; y < mh; y++) for (let x = 0; x < mw; x++) {
    const fx = 1 - sm(.6, .98, Math.abs(x + .5 - mw / 2) / (mw / 2)), fy = 1 - sm(.75, 1, Math.abs(y + .5 - mh / 2) / (mh / 2));
    d[(y * mw + x) * 4 + 3] *= fx * fy;
  }
  g.putImageData(img, 0, 0);
  return medal;
}
function drawArt(x, s = 1) {
  const sx = W / art.naturalWidth, sy = AH / art.naturalHeight, [mx, my, mw, mh] = MEDAL;
  x.drawImage(art, 0, AY * s, W * s, AH * s);
  // Same vertical scale as the frame, so the rail lines up; the width now matches it too.
  const cx = (mx + mw / 2) * sx, cy = AY + (my + mh / 2) * sy;
  x.drawImage(medallion(), (cx - mw * sy / 2) * s, (cy - mh * sy / 2) * s, mw * sy * s, mh * sy * s);
}

export function loadMonkeyCardAssets() {
  if (!pending) pending = new Promise(resolve => {
    const image = new Image();
    image.onload = () => { art = image; resolve(); };
    image.onerror = () => { pending = undefined; resolve(); };
    image.src = '/brand/monkey-gold-silver-v1.webp';
  });
  return pending;
}

export function monkeyWinnerCard(o, scale = 1) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(W * scale); canvas.height = Math.round(H * scale);
  const x = canvas.getContext('2d'); x.scale(scale, scale);
  if (art) drawArt(x);
  else { x.fillStyle = '#101013'; x.fillRect(260, 215, 840, 235); }
  function text(value, y, size, weight = 700, color = '#fff1ce') {
    if (!value) return;
    x.textAlign = 'center'; x.textBaseline = 'middle';
    do {
      x.font = `${weight} ${size}px "Be Vietnam Pro", sans-serif`;
      if (x.measureText(String(value)).width <= 620) break;
    } while (--size > 1);
    x.fillStyle = color; x.fillText(String(value), W / 2, y);
  }
  x.shadowColor = '#000'; x.shadowBlur = 6;
  text(o.name, 326, 60, 800);
  text(o.vietnameseName, 384, 26, 700);
  const words = String(o.description || '').trim().split(/\s+/).filter(Boolean);
  let lines = [], size = 23;
  do {
    lines = []; let line = '';
    x.font = `600 ${size}px "Be Vietnam Pro", sans-serif`;
    for (const word of words) {
      const next = line ? `${line} ${word}` : word;
      if (line && x.measureText(next).width > 610) { lines.push(line); line = word; }
      else line = next;
    }
    if (line) lines.push(line);
    if (lines.length <= 2 && lines.every(v => x.measureText(v).width <= 610)) break;
  } while (--size > 1);
  lines.forEach((line, i) => text(line, 424 + (i - (lines.length - 1) / 2) * 25, size, 600));
  text(o.info, 466, 16, 600, '#d8bd82');
  return { canvas, w: W, h: H };
}

// Half-resolution luminance mask of the artwork, so the rail light only lands on bright metal.
const FX = .5;
let mask, fx;
function frameMask() {
  if (mask || !art) return mask;
  const w = W * FX, h = H * FX;
  const make = () => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  const src = make().getContext('2d', { willReadFrequently: true });
  drawArt(src, FX);
  const d = src.getImageData(0, 0, w, h).data;
  const bright = new ImageData(w, h);
  for (let i = 0; i < d.length; i += 4) {
    const t = Math.min(1, Math.max(0, (Math.max(d[i], d[i + 1], d[i + 2]) / 255 * d[i + 3] / 255 - .2) / .5));
    bright.data.fill(255, i, i + 3); bright.data[i + 3] = t * t * (3 - 2 * t) * 255;
  }
  mask = make(); mask.getContext('2d').putImageData(bright, 0, 0);
  fx = make();
  return mask;
}
function maskedScreen(ctx, m, alpha, paint, op = 'screen') {
  const f = fx.getContext('2d');
  f.globalCompositeOperation = 'source-over';
  f.clearRect(0, 0, fx.width, fx.height);
  f.save(); f.scale(FX, FX); paint(f); f.restore();
  f.globalCompositeOperation = 'destination-in';
  f.drawImage(m, 0, 0);
  ctx.globalCompositeOperation = op; ctx.globalAlpha = alpha;
  ctx.drawImage(fx, 0, 0, W, H);
  ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
}

const hash = n => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };
// Seconds per loop, seconds the light band takes to sweep the frame, and how long a dust grain lives.
const PERIOD = 5.6, SWEEP = 3.6, LIFE = 3.2, TOP = 110, BOTTOM = 620;
// The band starts quick and eases to a stop near the lower rail.
const sweepY = s => TOP + (1 - Math.pow(1 - s, 2.2)) * (BOTTOM - TOP);
const sweepSpeed = s => 2.2 * Math.pow(1 - s, 1.2) * (BOTTOM - TOP) / SWEEP;
// One gold grain: soft halo, bright core, and a small cross flare on the largest ones.
function grain(ctx, i, px, py, r, a) {
  const behindText = px > 380 && px < 980 && py > 290 && py < 510;
  ctx.globalAlpha = a * (behindText ? .2 : .95);
  ctx.fillStyle = '#ffb83a55';
  ctx.beginPath(); ctx.arc(px, py, r * 2.6, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = i % 5 ? '#ffd77a' : '#fff4d0';
  ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.fill();
  if (r > 3.5) { ctx.fillRect(px - 10, py - 1, 20, 2); ctx.fillRect(px - 1, py - 10, 2, 20); }
}

export function monkeyEffect(ctx, time, width, height) {
  ctx.save(); ctx.scale(width / W, height / H);
  const tc = time % PERIOD, s = tc / SWEEP;
  if (s < 1 && frameMask()) {
    // A bright band sweeps down the circlet, lit only where it crosses metal, with a soft glow trailing above it.
    const y = sweepY(s), fade = Math.min(1, s * 8) * (1 - Math.max(0, (s - .75) / .25));
    maskedScreen(ctx, mask, fade, f => {
      const g = f.createLinearGradient(0, y - 130, 0, y + 16);
      g.addColorStop(0, 'rgba(255,214,120,0)'); g.addColorStop(.6, 'rgba(255,214,120,.35)');
      g.addColorStop(.9, 'rgba(255,246,214,1)'); g.addColorStop(1, 'rgba(255,246,214,0)');
      f.fillStyle = g; f.fillRect(0, y - 130, W, 146);
    }, 'lighter');
  }
  // Dust pours straight down from wherever the band passes: quick and heavy at first, then slower,
  // and since the band lingers low, the grains gather thickest over the lower half.
  ctx.globalCompositeOperation = 'screen';
  for (let i = 0; i < 380; i++) {
    const si = hash(i);
    for (const back of [0, PERIOD]) {
      const age = tc + back - si * SWEEP; if (age < 0 || age > LIFE) continue;
      const v0 = sweepSpeed(si) * .35;
      const px = 40 + hash(i + .3) * 1280 + Math.sin(time * 1.3 + i) * 5 * age;
      const py = sweepY(si) + (hash(i + .4) - .5) * 44 + v0 * age + 26 * age * age;
      const r = hash(i + .6) < .07 ? 3.8 : 1.1 + hash(i + .6) * 1.7;
      grain(ctx, i, px, py, r, Math.min(1, age * 8) * Math.pow(1 - age / LIFE, 1.3) * (.7 + .3 * Math.sin(time * 6 + i * 1.7)));
    }
  }
  // A steady drizzle off the lower rail keeps the bottom of the card dusted between sweeps.
  for (let i = 0; i < 200; i++) {
    const L = 2.4 + hash(i + .7) * 1.4, clock = time / L + hash(i + .8), cycle = Math.floor(clock), age = (clock - cycle) * L, seed = i * 13 + cycle * 7;
    const px = 90 + hash(seed) * 1180 + Math.sin(time * 1.2 + i) * 6 * age;
    const py = 565 + hash(seed + 1) * 45 + 14 * age + 20 * age * age;
    const r = hash(seed + 3) < .05 ? 3.6 : 1 + hash(seed + 3) * 1.6;
    grain(ctx, i, px, py, r, Math.min(1, age * 4) * Math.pow(1 - age / L, 1.2) * .8 * (.7 + .3 * Math.sin(time * 6 + i * 2.3)));
  }
  ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
  // Small gold/silver glints stay outside the text area.
  for (let i = 0; i < 24; i++) {
    const side = i % 2 ? 1 : -1;
    const px = W / 2 + side * (425 + (i * 37 % 205));
    const py = 170 + (i * 53 % 420);
    ctx.globalAlpha = Math.pow((Math.sin(time * 1.8 + i * 2.3) + 1) / 2, 6) * .65;
    ctx.fillStyle = i % 4 ? '#ffe2a0' : '#eff7ff';
    ctx.fillRect(px - 3, py, 6, 1); ctx.fillRect(px, py - 3, 1, 6);
  }
  ctx.restore();
}
