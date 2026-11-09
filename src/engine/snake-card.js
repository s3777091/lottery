// Celestial serpent: the jade moon-weave frame filled with a violet star-dust sky, flowing liquid-silver curves,
// a glass crescent moon and a few shooting-star streaks gliding around it.
import { FRAME_W, FRAME_H, panel, zodiacWinnerCard, drawZodiacFrame } from './zodiac-frame';
export const SNAKE_W = FRAME_W, SNAKE_H = FRAME_H;
const TAU = Math.PI * 2, CX = 690, CY = 392, RX = 520, RY = 215;
const GW = 340, GH = 185, GS = GW / FRAME_W; // silhouette grid at quarter resolution

function rng(seed) { return () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
// Keep the lettering field quiet.
const inText = (px, py) => Math.abs(px - 675) < 340 && py > 210 && py < 500;
const rand = rng(29);
// Fine, faint star dust everywhere, plus a sprinkle of brighter stars.
const DUST = Array.from({ length: 4200 }, () => ({ x: rand() * FRAME_W, y: 20 + rand() * 700, r: .35 + rand() ** 3 * .8, a: .25 + rand() * .6 }));
const STARS = Array.from({ length: 520 }, () => ({ x: rand() * FRAME_W, y: 20 + rand() * 700, r: .9 + rand() ** 2 * 1.1, a: .6 + rand() * .4, hue: rand() }));
const NEBULA = Array.from({ length: 16 }, (_, i) => ({ x: 120 + rand() * 1120, y: 120 + rand() * 520, r: 140 + rand() * 200, c: ['#8a4dff', '#3a7bff', '#b04dff', '#4d5dff'][i % 4] }));
// Curving liquid-silver lines that hug the inside of the frame: [scale, from, to, width, alpha] (angles on the ellipse, 0 = right, +π/2 = down).
const SWIRLS = [
  [.98, .25, 2.95, 4.5, .8], [.94, 1.15, 3.85, 3, .65], [.91, -.95, .95, 3.4, .65], [.95, -1.25, -.15, 2.6, .6],
  [.87, 1.7, 3.3, 3.8, .8], [.82, 1.9, 3.1, 2.4, .6], [.77, 2.05, 2.9, 1.8, .5], [.86, -.7, .5, 2, .5],
  [1.0, 3.3, 4.3, 3, .6], [.89, .2, 1.4, 2.2, .5],
];
const swirlPoint = (a, k, j) => {
  const s = k + .022 * Math.sin(3 * a + j * 1.7) + .011 * Math.sin(7 * a + j);
  return { x: CX + Math.cos(a) * RX * s, y: CY + Math.sin(a) * RY * s };
};
// Two curving streams of star dust: upper right and around the moon on the lower left. [from, to, scale, spread, count]
const STREAMS = [[-1.25, .15, .8, .1, 700], [1.8, 3.1, .8, .08, 420]];
const STREAM_DUST = STREAMS.flatMap(([a0, a1, k, w, n]) => Array.from({ length: n }, () => {
  const u = rand(), off = (rand() - .5) * 2 * w * (1 - Math.abs(u - .5) * 1.2);
  return { a0, a1, u, k: k + off, r: .3 + rand() ** 4 * 1.2, a: .3 + rand() * .7, s: .012 + rand() * .01 };
}));
const TWINKLES = Array.from({ length: 120 }, () => ({ x: 120 + rand() * 1120, y: 100 + rand() * 560, r: 3 + rand() * 5, p: rand() * TAU, s: .6 + rand() * 1.2 })).filter(s => !inText(s.x, s.y)).slice(0, 22);
const MOON = { x: 432, y: 448, r: 56 };

// Filled outline of the frame: the ornament plus every enclosed gap, pulled slightly inside its outer edge.
let shape;
function grow(m, r) {
  const h = new Uint8Array(m.length), out = new Uint8Array(m.length);
  for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
    let v = 0; for (let k = Math.max(0, x - r); k <= Math.min(GW - 1, x + r) && !v; k++) v = m[y * GW + k]; h[y * GW + x] = v;
  }
  for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
    let v = 0; for (let k = Math.max(0, y - r); k <= Math.min(GH - 1, y + r) && !v; k++) v = h[k * GW + x]; out[y * GW + x] = v;
  }
  return out;
}
function silhouette() {
  if (shape) return shape;
  const c = document.createElement('canvas'); c.width = GW; c.height = GH;
  const g = c.getContext('2d', { willReadFrequently: true });
  drawZodiacFrame(g, 'snake', 0, GW, GH);
  const art = g.getImageData(0, 0, GW, GH).data.filter((v, i) => i % 4 === 3 && v > 40).length;
  // A shrunken copy of the text panel guarantees the centre is inside without poking past the top whip.
  g.save(); g.scale(GS, GS); g.translate(675, 390); g.scale(.82, .82); g.translate(-675, -390); panel(g, 'snake'); g.fillStyle = '#fff'; g.fill(); g.restore();
  const px = g.getImageData(0, 0, GW, GH).data;
  let m = new Uint8Array(GW * GH);
  for (let i = 0; i < m.length; i++) m[i] = px[i * 4 + 3] > 40 ? 1 : 0;
  m = grow(m, 6);
  // Flood the outside from the border; whatever it cannot reach is inside.
  const outside = new Uint8Array(m.length), stack = [];
  for (let x = 0; x < GW; x++) stack.push(x, (GH - 1) * GW + x);
  for (let y = 0; y < GH; y++) stack.push(y * GW, y * GW + GW - 1);
  while (stack.length) {
    const i = stack.pop(); if (outside[i] || m[i]) continue; outside[i] = 1;
    const x = i % GW;
    if (x > 0) stack.push(i - 1); if (x < GW - 1) stack.push(i + 1);
    if (i >= GW) stack.push(i - GW); if (i < (GH - 1) * GW) stack.push(i + GW);
  }
  // Off-canvas counts as outside, so the fill never runs to the card edge.
  for (let x = 0; x < GW; x++) outside[x] = outside[(GH - 1) * GW + x] = 1;
  for (let y = 0; y < GH; y++) outside[y * GW] = outside[y * GW + GW - 1] = 1;
  const grid = grow(outside, 7).map(v => 1 - v);
  const img = g.createImageData(GW, GH);
  for (let i = 0; i < grid.length; i++) { img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = 255; img.data[i * 4 + 3] = grid[i] * 255; }
  g.clearRect(0, 0, GW, GH); g.putImageData(img, 0, 0);
  // Only cache once the frame art has loaded.
  const result = { grid, canvas: c };
  if (art > 1000) shape = result;
  return result;
}
const inside = (grid, px, py) => grid[Math.min(GH - 1, Math.max(0, py * GS | 0)) * GW + Math.min(GW - 1, Math.max(0, px * GS | 0))] === 1;

function sparkle(x, px, py, r, color) {
  x.fillStyle = color; x.beginPath();
  x.moveTo(px, py - r); x.quadraticCurveTo(px, py, px + r * .28, py); x.quadraticCurveTo(px, py, px, py + r);
  x.quadraticCurveTo(px, py, px - r * .28, py); x.quadraticCurveTo(px, py, px, py - r);
  x.moveTo(px - r * .7, py); x.quadraticCurveTo(px, py, px, py - r * .2); x.quadraticCurveTo(px, py, px + r * .7, py);
  x.quadraticCurveTo(px, py, px, py + r * .2); x.quadraticCurveTo(px, py, px - r * .7, py); x.fill();
}
function swirlPath(x, [k, a0, a1], j) {
  x.beginPath();
  for (let i = 0; i <= 90; i++) { const p = swirlPoint(a0 + (a1 - a0) * i / 90, k, j); if (i) x.lineTo(p.x, p.y); else x.moveTo(p.x, p.y); }
}
// Glass crescent: cut on its own canvas so the bite is truly empty.
function crescent(x, { x: cx, y: cy, r }) {
  const t = x.getTransform(), c = document.createElement('canvas'); c.width = x.canvas.width; c.height = x.canvas.height;
  const m = c.getContext('2d'); m.setTransform(t); m.translate(cx, cy); m.rotate(-.35);
  const body = m.createRadialGradient(-r * .45, r * .4, r * .05, -r * .1, r * .1, r * 1.15);
  body.addColorStop(0, '#ffffff'); body.addColorStop(.35, '#e6edff'); body.addColorStop(.75, '#98aee8'); body.addColorStop(1, '#4a5fa8');
  m.beginPath(); m.arc(0, 0, r, 0, TAU); m.fillStyle = body; m.fill();
  m.globalCompositeOperation = 'destination-out'; m.beginPath(); m.arc(r * .42, -r * .3, r * .84, 0, TAU); m.fill();
  // Glassy reflections only where the crescent remains.
  m.globalCompositeOperation = 'source-atop';
  m.beginPath(); m.arc(0, 0, r * .9, 1.7, 3.3); m.strokeStyle = '#ffffffcc'; m.lineWidth = r * .07; m.stroke();
  m.beginPath(); m.arc(-r * .05, r * .05, r * .72, 1.9, 2.9); m.strokeStyle = '#ffffff66'; m.lineWidth = r * .05; m.stroke();
  m.beginPath(); m.arc(0, 0, r - 1.5, 0, TAU); m.strokeStyle = '#f4f8ff'; m.lineWidth = 3; m.stroke();
  x.save(); x.translate(cx, cy);
  const halo = x.createRadialGradient(0, 0, r * .3, 0, 0, r * 2.2); halo.addColorStop(0, '#c9d6ff44'); halo.addColorStop(1, '#6f8cff00');
  x.fillStyle = halo; x.fillRect(-r * 2.2, -r * 2.2, r * 4.4, r * 4.4); x.restore();
  x.save(); x.setTransform(1, 0, 0, 1, 0, 0); x.shadowColor = '#bcd0ff'; x.shadowBlur = 18 * t.a; x.drawImage(c, 0, 0); x.restore();
}
function cosmos(x) {
  const { canvas: mask } = silhouette(), t = x.getTransform();
  const sky = document.createElement('canvas'); sky.width = x.canvas.width; sky.height = x.canvas.height;
  const g = sky.getContext('2d'); g.setTransform(t);
  // Violet heart, deep indigo body and a bright blue rim, like the portal reference.
  g.save(); g.translate(CX, CY); g.scale(1, RY / RX);
  const deep = g.createRadialGradient(-40, -20, 10, 0, 0, RX * 1.25);
  deep.addColorStop(0, '#3d25c9'); deep.addColorStop(.4, '#2a19a8'); deep.addColorStop(.72, '#1a1388'); deep.addColorStop(.9, '#1f39c4'); deep.addColorStop(1, '#2d63ff');
  g.fillStyle = deep; g.fillRect(-RX * 1.5, -RX * 1.5, RX * 3, RX * 3); g.restore();
  g.globalCompositeOperation = 'screen';
  for (const n of NEBULA) {
    const r = g.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.r);
    r.addColorStop(0, n.c + '30'); r.addColorStop(1, n.c + '00'); g.fillStyle = r; g.fillRect(n.x - n.r, n.y - n.r, n.r * 2, n.r * 2);
  }
  g.fillStyle = '#ffffff';
  for (const s of DUST) { g.globalAlpha = s.a * (inText(s.x, s.y) ? .6 : 1); g.fillRect(s.x, s.y, s.r * 2, s.r * 2); }
  for (const s of STARS) {
    g.globalAlpha = s.a * (inText(s.x, s.y) ? .45 : 1); g.fillStyle = s.hue < .65 ? '#ffffff' : s.hue < .88 ? '#d6cfff' : '#a9d8ff';
    g.beginPath(); g.arc(s.x, s.y, s.r, 0, TAU); g.fill();
    if (s.hue > .8) { g.globalAlpha *= .35; g.beginPath(); g.arc(s.x, s.y, s.r * 3, 0, TAU); g.fill(); }
  }
  // Star-dust streams, resting positions (they drift in the effect pass).
  g.fillStyle = '#e8ecff';
  for (const s of STREAM_DUST) {
    const p = swirlPoint(s.a0 + (s.a1 - s.a0) * s.u, s.k, 0);
    g.globalAlpha = s.a * .5 * (inText(p.x, p.y) ? .5 : 1); g.fillRect(p.x, p.y, s.r * 1.6, s.r * 1.6);
  }
  g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
  // Darker lens behind the lettering.
  g.save(); g.translate(675, 360); g.scale(1, .45);
  const lens = g.createRadialGradient(0, 0, 40, 0, 0, 430); lens.addColorStop(0, '#0a062eb0'); lens.addColorStop(1, '#0a062e00');
  g.fillStyle = lens; g.fillRect(-440, -440, 880, 880); g.restore();
  // Liquid-silver curves: a soft glow, then a bright core.
  g.lineCap = 'round';
  SWIRLS.forEach(([k, a0, a1, w, al], j) => {
    // Each ribbon swells in the middle and tapers to fine points, like poured silver.
    for (const [mul, color, alpha] of [[3.4, '#7fa4ff', .3], [1.6, '#dfe7ff', .75], [.55, '#ffffff', 1]]) {
      g.strokeStyle = color;
      for (let i = 0; i < 90; i++) {
        const f = (i + .5) / 90, p = swirlPoint(a0 + (a1 - a0) * i / 90, k, j), q = swirlPoint(a0 + (a1 - a0) * (i + 1) / 90, k, j);
        g.globalAlpha = al * alpha; g.lineWidth = w * mul * (.15 + .85 * Math.sin(f * Math.PI));
        g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(q.x, q.y); g.stroke();
      }
    }
  });
  g.globalAlpha = 1;
  crescent(g, MOON);
  g.globalCompositeOperation = 'destination-in'; g.imageSmoothingQuality = 'high'; g.drawImage(mask, 0, 0, FRAME_W, FRAME_H);
  // Blue haze bleeding past the frame's outline.
  x.save(); x.setTransform(1, 0, 0, 1, 0, 0); x.shadowColor = '#3d6dffaa'; x.shadowBlur = 45 * t.a; x.drawImage(sky, 0, 0); x.restore();
}
export const snakeWinnerCard = (o, scale = 1) => zodiacWinnerCard({ ...o, tier: 'snake' }, scale, cosmos);

let star;
function starSprite() {
  if (star) return star;
  star = document.createElement('canvas'); star.width = star.height = 40;
  sparkle(star.getContext('2d'), 20, 20, 19, '#eef1ff');
  return star;
}
// Light glides along the silver curves, the dust streams drift, and a few stars breathe.
export function snakeEffect(ctx, time, width, height) {
  const { grid } = silhouette();
  ctx.save(); ctx.scale(width / SNAKE_W, height / SNAKE_H); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
  SWIRLS.forEach((sw, j) => {
    swirlPath(ctx, sw, j);
    ctx.setLineDash([26 + j * 6, 320 + j * 40]); ctx.lineDashOffset = -(time * (55 + j * 7) + j * 97);
    ctx.globalAlpha = .75; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = sw[3] * 1.3; ctx.stroke();
  });
  ctx.setLineDash([]);
  ctx.fillStyle = '#f2f4ff';
  for (const s of STREAM_DUST) {
    const f = (s.u + time * s.s) % 1, p = swirlPoint(s.a0 + (s.a1 - s.a0) * f, s.k, 0);
    if (!inside(grid, p.x, p.y)) continue;
    ctx.globalAlpha = s.a * Math.sin(f * Math.PI) * .6 * (inText(p.x, p.y) ? .4 : 1); ctx.fillRect(p.x, p.y, s.r * 1.8, s.r * 1.8);
  }
  const sprite = starSprite();
  for (const s of TWINKLES) {
    if (!inside(grid, s.x, s.y)) continue;
    ctx.globalAlpha = Math.pow(.5 + .5 * Math.sin(time * s.s + s.p), 5) * .7; ctx.drawImage(sprite, s.x - s.r, s.y - s.r, s.r * 2, s.r * 2);
  }
  ctx.restore();
}

// Each streak loops around the frame on its own wobbling orbit, dipping in and out as it goes.
function flight(i, u) {
  const k = i % 2 ? .9 : 1;
  return { x: CX + Math.cos(u) * (580 + 40 * Math.sin(2.3 * u + i)) * k, y: CY - 12 + Math.sin(u) * (300 + 30 * Math.cos(1.7 * u + i) + 24 * Math.sin(3.1 * u + i * 2)) * k };
}
const STREAKS = [['#ffffff', '#9fc4ff'], ['#fff3c8', '#ffcf6a'], ['#ffffff', '#b9a8ff'], ['#ffffff', '#9fc4ff'], ['#fff3c8', '#ffcf6a']];
// The frame is redrawn here so the moving sky stays beneath it; the star streaks glide above.
export function snakeForeground(ctx, time, width, height) {
  drawZodiacFrame(ctx, 'snake', time, width, height);
  ctx.save(); ctx.scale(width / SNAKE_W, height / SNAKE_H); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
  const sprite = starSprite();
  STREAKS.forEach(([core, tint], i) => {
    const dir = i === 2 ? -1 : 1, u = dir * time * (.17 + (i % 3) * .035) + i * TAU / 5, len = .7 + (i % 3) * .15;
    // Tapered tail as one filled sliver per layer, so nothing doubles up at the joins.
    const pts = Array.from({ length: 29 }, (_, j) => flight(i, u - dir * len * j / 28));
    const end = pts[28], head = pts[0];
    for (const [width, color, alpha] of [[10, tint, .4], [2.8, core, .95]]) {
      const left = [], right = [];
      pts.forEach((p, j) => {
        const q = pts[Math.min(28, j + 1)], o = pts[Math.max(0, j - 1)], dx = q.x - o.x, dy = q.y - o.y, l = Math.hypot(dx, dy) || 1;
        const w = width * (1 - j / 28) ** 1.2 / 2 + .2;
        left.push([p.x - dy / l * w, p.y + dx / l * w]); right.push([p.x + dy / l * w, p.y - dx / l * w]);
      });
      ctx.beginPath(); left.forEach(([x, y], j) => j ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); right.reverse().forEach(([x, y]) => ctx.lineTo(x, y)); ctx.closePath();
      const fade = ctx.createLinearGradient(head.x, head.y, end.x, end.y);
      fade.addColorStop(0, color); fade.addColorStop(1, color + '00');
      ctx.globalAlpha = alpha; ctx.fillStyle = fade; ctx.fill();
    }
    // Sparks shed along the tail.
    for (let j = 0; j < 8; j++) {
      const f = ((j / 8 + time * .6 + i * .13) % 1), p = flight(i, u - dir * len * f), drift = f * 14;
      ctx.globalAlpha = (1 - f) * .8; ctx.fillStyle = tint;
      ctx.beginPath(); ctx.arc(p.x + Math.sin(j * 2.4 + i) * drift, p.y + Math.cos(j * 1.7 + i) * drift, 1.4 * (1 - f) + .4, 0, TAU); ctx.fill();
    }
    // Bright head with a soft halo and a gently pulsing four-point flare.
    const h = flight(i, u), pulse = .85 + .15 * Math.sin(time * 5 + i * 1.3), r = 15 * pulse;
    const halo = ctx.createRadialGradient(h.x, h.y, 0, h.x, h.y, r * 2.4);
    halo.addColorStop(0, core); halo.addColorStop(.2, tint + 'cc'); halo.addColorStop(1, tint + '00');
    ctx.globalAlpha = .9; ctx.fillStyle = halo; ctx.fillRect(h.x - r * 2.4, h.y - r * 2.4, r * 4.8, r * 4.8);
    ctx.globalAlpha = 1; ctx.drawImage(sprite, h.x - r * 1.6, h.y - r * 1.6, r * 3.2, r * 3.2);
  });
  ctx.restore();
}
