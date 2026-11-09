// Crimson tiger edition: a gold-cloisonné tiger on the ember frame, over the reference fan's gilt lacquer,
// with a crimson fire that runs along the frame's edge. Lettering stays in the quiet centre.
// The canvas carries a small margin (OX, OY) for the edge glow; artwork uses the inner 1360×740 space.
const OX = 30, OY = 30;
export const TIGER_W = 1360 + OX * 2, TIGER_H = 740 + OY * 2;
const TAU = Math.PI * 2, CX = 745, CY = 335;
const FRAME = [8, 28, 1344, 672];
// Text box the fire must never reach.
const QUIET = { l: 510, r: 990, t: 195, b: 480 };
let frame, art, emitters = [], hull = null, outline = [], glow, wisps, pending;
export function loadTigerCardAssets() {
  if (!pending) pending = new Promise(resolve => {
    const image = new Image();
    image.onload = () => { frame = image; try { emitters = findEmitters(image); hull = findHull(image); outline = findOutline(image); art = armour(image); } catch { emitters = []; } resolve(); };
    image.onerror = () => { pending = undefined; resolve(); };
    image.src = '/brand/tiger-cloisonne-head-v9.webp';
  });
  return pending;
}
// Samples the ornament's outer silhouette so flames rise from the frame itself, never from the open centre.
function findEmitters(image) {
  const gw = 224, gh = 112, c = document.createElement('canvas'); c.width = gw; c.height = gh;
  const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(image, 0, 0, gw, gh);
  const a = x.getImageData(0, 0, gw, gh).data, solid = (i, j) => i >= 0 && j >= 0 && i < gw && j < gh && a[(j * gw + i) * 4 + 3] > 60;
  const out = [];
  for (let j = 1; j < gh - 1; j++) for (let i = 1; i < gw - 1; i++) {
    if (!solid(i, j) || (solid(i - 1, j) && solid(i + 1, j) && solid(i, j - 1) && solid(i, j + 1))) continue;
    const px = FRAME[0] + (i + .5) / gw * FRAME[2], py = FRAME[1] + (j + .5) / gh * FRAME[3];
    let dx = px - 690, dy = (py - 370) * 1.7; const d = Math.hypot(dx, dy) || 1; dx /= d; dy /= d;
    // Keep only edges that face away from the centre.
    if (solid(Math.round(i + dx * 3), Math.round(j + dy * 3))) continue;
    if (px > QUIET.l - 30 && px < QUIET.r + 30 && py > QUIET.t && py < QUIET.b) continue;
    out.push({ x: px, y: py, dx, dy });
  }
  const pick = [];
  for (let k = 0; k < out.length; k += Math.max(1, Math.floor(out.length / 90))) pick.push(out[k]);
  return pick;
}
// Casts rays from the centre until they meet the ornament, so the lacquer fills exactly the frame's opening
// and tucks a little under its rails. Gaps in the ornament fall back to a soft oval.
function findHull(image) {
  const w = 680, h = 340, c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(image, 0, 0, w, h);
  const a = x.getImageData(0, 0, w, h).data, sx = w / FRAME[2], sy = h / FRAME[3], pts = [];
  for (let k = 0; k < 120; k++) {
    const ang = k / 120 * TAU, dx = Math.cos(ang), dy = Math.sin(ang), cap = 1 / Math.hypot(dx / 400, dy / 190);
    let r = 40;
    for (; r < cap; r += 2) {
      const i = Math.round((CX + dx * r - FRAME[0]) * sx), j = Math.round((CY + dy * r - FRAME[1]) * sy);
      if (i < 0 || j < 0 || i >= w || j >= h || a[(j * w + i) * 4 + 3] > 120) break;
    }
    r = Math.min(r, cap) + 10; pts.push([CX + dx * r, CY + dy * r]);
  }
  return pts;
}
// Outer silhouette of the whole ornament, found by casting rays inward from beyond the frame, then smoothed
// so the aura flows around it instead of tracing every crystal tip.
function findOutline(image) {
  const w = 444, h = 222, c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(image, 0, 0, w, h);
  const a = x.getImageData(0, 0, w, h).data, sx = w / FRAME[2], sy = h / FRAME[3], n = 160, ox = 680, oy = 370, radii = [];
  for (let k = 0; k < n; k++) {
    const ang = k / n * TAU, dx = Math.cos(ang), dy = Math.sin(ang);
    let r = 760;
    for (; r > 60; r -= 3) {
      const i = Math.round((ox + dx * r - FRAME[0]) * sx), j = Math.round((oy + dy * r - FRAME[1]) * sy);
      if (i >= 0 && j >= 0 && i < w && j < h && a[(j * w + i) * 4 + 3] > 60) break;
    }
    radii.push(r);
  }
  const pts = radii.map((_, k) => {
    let sum = 0; for (let d = -4; d <= 4; d++) sum += radii[(k + d + n) % n];
    const r = sum / 9, ang = k / n * TAU; return { x: ox + Math.cos(ang) * r, y: oy + Math.sin(ang) * r };
  });
  return pts.map((p, k) => {
    const a0 = pts[(k + n - 1) % n], a1 = pts[(k + 1) % n];
    let nx = a1.y - a0.y, ny = -(a1.x - a0.x); const d = Math.hypot(nx, ny) || 1; nx /= d; ny /= d;
    if (nx * (p.x - ox) + ny * (p.y - oy) < 0) { nx = -nx; ny = -ny; }
    return { x: p.x, y: p.y, nx, ny };
  });
}
function panel(x) {
  x.beginPath();
  if (hull) hull.forEach(([u, v], i) => i ? x.lineTo(u, v) : x.moveTo(u, v));
  else x.ellipse(CX, CY, 420, 200, 0, 0, TAU);
  x.closePath();
}
function linear(x, colors, ax, ay, bx, by) {
  const g = x.createLinearGradient(ax, ay, bx, by);
  colors.forEach((c, i) => g.addColorStop(i / (colors.length - 1), c));
  return g;
}
function spiral(x, cx, cy, r, turns, dir, start) {
  for (let k = 0; k <= 36; k++) {
    const f = k / 36, a = start + dir * f * turns * TAU, rr = r * (1 - f * .8);
    k ? x.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr) : x.moveTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
  }
}
// Auspicious cloud: maroon body on the ground, gold double rule on the gilt layer.
function cloud(fx, gx, cx, cy, s, flip) {
  for (const x of [fx, gx]) { x.save(); x.translate(cx, cy); x.scale(s * flip, s); x.lineCap = 'round'; x.lineJoin = 'round'; }
  const body = x => {
    x.beginPath(); x.moveTo(-70, 18); x.bezierCurveTo(-94, 14, -92, -24, -62, -22); x.bezierCurveTo(-58, -52, -14, -58, -6, -30);
    x.bezierCurveTo(6, -60, 54, -54, 50, -20); x.bezierCurveTo(80, -22, 86, 16, 58, 18); x.closePath();
  };
  const curls = x => {
    x.beginPath(); spiral(x, -60, -2, 17, 1.1, 1, Math.PI * .9); spiral(x, -10, -16, 20, 1.15, -1, Math.PI * .1); spiral(x, 44, -2, 15, 1.05, 1, Math.PI * 1.1);
    x.moveTo(58, 18); x.bezierCurveTo(100, 24, 132, 4, 176, 14); x.moveTo(40, 28); x.bezierCurveTo(80, 36, 118, 26, 150, 32);
  };
  body(fx); fx.fillStyle = '#240706'; fx.fill();
  gx.strokeStyle = '#f3cf7e'; gx.lineWidth = 7; body(gx); gx.stroke(); curls(gx); gx.stroke();
  gx.globalCompositeOperation = 'destination-out'; gx.lineWidth = 2; body(gx); gx.stroke(); curls(gx); gx.stroke();
  for (const x of [fx, gx]) x.restore();
}
// A bundle of parallel gold streams that ends in a tight curl, like the flowing lines across the fan leaf.
function streams(gx, y0, amp, phase, count, curlLeft) {
  for (let n = 0; n < count; n++) {
    const yy = y0 + n * 9; gx.beginPath();
    for (let px = 300; px <= 1160; px += 8) { const py = yy + Math.sin(px * .006 + phase) * amp + Math.sin(px * .017 + phase * 2) * amp * .25; px === 300 ? gx.moveTo(px, py) : gx.lineTo(px, py); }
    gx.strokeStyle = '#f0c873'; gx.lineWidth = n % 2 ? 1.6 : 2.6; gx.stroke();
  }
  const ex = curlLeft ? 360 : 1100, ey = y0 + Math.sin(ex * .006 + phase) * amp + count * 4;
  gx.beginPath(); spiral(gx, ex, ey, count * 7 + 8, 1.3, curlLeft ? -1 : 1, curlLeft ? 0 : Math.PI); gx.lineWidth = 2.6; gx.stroke();
}
let glitter;
function glitterPattern() {
  if (glitter) return glitter;
  glitter = document.createElement('canvas'); glitter.width = glitter.height = 96;
  const g = glitter.getContext('2d'), img = g.createImageData(96, 96), d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const r = Math.random(), lit = r > .82 ? 1 : r > .45 ? .62 : .3;
    d[i] = 255 * Math.min(1, lit + .05); d[i + 1] = 214 * lit + 20; d[i + 2] = 120 * lit; d[i + 3] = 255;
  }
  g.putImageData(img, 0, 0); return glitter;
}
// Fan-leaf lacquer: oxblood-brown ground with diagonal folds, flowing gilt streams and dense clouds, all
// gilt dusted with glitter. A dark veil keeps the lettering readable.
function lacquer(x) {
  const ground = x.createLinearGradient(300, 160, 1140, 560);
  ground.addColorStop(0, '#4c1613'); ground.addColorStop(.45, '#36100d'); ground.addColorStop(.7, '#45140f'); ground.addColorStop(1, '#270908');
  x.fillStyle = ground; x.fillRect(0, 0, 1360, 740);
  for (let i = -12; i < 30; i++) {
    const px = i * 64; x.beginPath(); x.moveTo(px, 0); x.lineTo(px + 32, 0); x.lineTo(px + 32 - 380, 740); x.lineTo(px - 380, 740); x.closePath();
    x.fillStyle = i % 2 ? '#ffd0b00a' : '#0000001e'; x.fill();
  }
  const layer = document.createElement('canvas'); layer.width = 2720; layer.height = 1480;
  const gx = layer.getContext('2d'); gx.scale(2, 2);
  streams(gx, 196, 12, .4, 4, false); streams(gx, 300, 20, 2.1, 3, true); streams(gx, 420, 16, 4.2, 3, false); streams(gx, 520, 12, 1.3, 4, true);
  for (const [cx, cy, sc, fl] of [[440, 240, .72, -1], [640, 196, .5, 1], [905, 200, .55, 1], [1075, 270, .74, 1], [415, 470, .66, -1], [620, 528, .5, 1], [880, 522, .55, -1], [1080, 470, .72, 1]]) cloud(x, gx, cx, cy, sc, fl);
  gx.globalCompositeOperation = 'source-atop'; gx.setTransform(1, 0, 0, 1, 0, 0);
  gx.fillStyle = gx.createPattern(glitterPattern(), 'repeat'); gx.fillRect(0, 0, layer.width, layer.height);
  x.save(); x.shadowColor = '#00000099'; x.shadowBlur = 3; x.shadowOffsetY = 1; x.drawImage(layer, 0, 0, 1360, 740); x.restore();
  const veil = x.createRadialGradient(CX, 345, 40, CX, 345, 290); veil.addColorStop(0, '#1a0404e6'); veil.addColorStop(.6, '#1a0404a0'); veil.addColorStop(1, '#1a040400');
  x.save(); x.translate(CX, 345); x.scale(1, .62); x.translate(-CX, -345); x.fillStyle = veil; x.fillRect(0, 0, 1360, 740); x.restore();
}
/** @returns {{canvas: HTMLCanvasElement, w: number, h: number}} */
export function tigerWinnerCard(o, scale = 1) {
  const canvas = document.createElement('canvas'); canvas.width = Math.round(TIGER_W * scale); canvas.height = Math.round(TIGER_H * scale);
  const x = canvas.getContext('2d'); x.scale(scale, scale); x.translate(OX, OY);
  panel(x);
  x.save(); x.clip(); lacquer(x);
  x.restore();
  drawFrame(x);
  function text(value, y, size, color, max = 440, weight = 700) {
    if (!value) return; x.textAlign = 'center'; x.textBaseline = 'middle';
    do { x.font = `${weight} ${size}px "Be Vietnam Pro", sans-serif`; if (x.measureText(String(value)).width <= max) break; size--; } while (size > 1);
    x.fillStyle = color; x.fillText(String(value), CX, y);
  }
  x.shadowColor = '#000000d8'; x.shadowBlur = 10;
  text('HỎA HỔ', 232, 22, '#f2c46b'); text('CRIMSON TIGER · SOVEREIGN', 259, 11, '#d6955a', 440, 600);
  text(o.name, 309, 56, '#fff1ce', 440, 800); text(o.vietnameseName, 358, 25, '#edc77b');
  const words = String(o.description || '').trim().split(/\s+/).filter(Boolean); let lines = [], size = 22;
  do {
    lines = []; let line = ''; x.font = `600 ${size}px "Be Vietnam Pro", sans-serif`;
    for (const word of words) { const next = line ? line + ' ' + word : word; if (line && x.measureText(next).width > 420) { lines.push(line); line = word; } else line = next; }
    if (line) lines.push(line);
    if (lines.length <= 2 && lines.every(v => x.measureText(v).width <= 420)) break; size--;
  } while (size > 1);
  lines.forEach((v, i) => text(v, 401 + (i - (lines.length - 1) / 2) * 25, size, '#fff1ce', 420, 600));
  text(o.info, 446, 17, '#edc77b', 420, 600);
  x.shadowBlur = 0;
  return { canvas, w: TIGER_W, h: TIGER_H };
}
// Hooked thorns cased in gold with a blood-dark underside; some carry a ruby at the root, like the fan's crown.
function thorn(x, px, py, dx, dy, len, w, bend, gem) {
  x.save(); x.translate(px, py); x.rotate(Math.atan2(dy, dx));
  x.beginPath(); x.moveTo(0, -w); x.quadraticCurveTo(len * .55, -w * .7 + bend * .5, len, bend); x.quadraticCurveTo(len * .5, w * .55 + bend * .4, 0, w); x.closePath();
  x.shadowColor = '#000000c0'; x.shadowBlur = 8;
  x.fillStyle = linear(x, ['#fff0b8', '#d49a3a', '#7a0010', '#2a0004'], 0, -w, 0, w); x.fill(); x.shadowBlur = 0;
  x.strokeStyle = '#ffd47a'; x.lineWidth = 1.4; x.stroke();
  x.beginPath(); x.moveTo(4, -w * .35); x.quadraticCurveTo(len * .5, -w * .3 + bend * .45, len * .92, bend * .95); x.strokeStyle = '#fff6d0aa'; x.lineWidth = 1; x.stroke();
  if (gem) {
    const gx = len * .2, r = w * .55;
    x.beginPath(); x.arc(gx, 0, r + 2.5, 0, TAU); x.fillStyle = '#c99436'; x.fill();
    const g = x.createRadialGradient(gx - r * .3, -r * .3, .5, gx, 0, r); g.addColorStop(0, '#ffe2c0'); g.addColorStop(.35, '#ff2a14'); g.addColorStop(1, '#5a0006');
    x.beginPath(); x.arc(gx, 0, r, 0, TAU); x.fillStyle = g; x.fill();
  }
  x.restore();
}
// The frame artwork plus its crown of thorns, composed once at 2x so both card and fire pass reuse it.
function armour(image) {
  const c = document.createElement('canvas'); c.width = 1360 * 2; c.height = 740 * 2;
  const x = c.getContext('2d'); x.scale(2, 2);
  const spots = [];
  for (const e of emitters) {
    const head = e.x < 560 && e.y < 330 && e.dy < .3, rail = e.x >= 560 && e.x < 1100 && e.y < 230 && e.dy < -.4;
    if (!head && !rail) continue;
    if (spots.some(p => Math.hypot(p.x - e.x, p.y - e.y) < (head ? 34 : 70))) continue;
    spots.push(e);
  }
  spots.forEach((e, i) => {
    let dx = e.dx, dy = e.dy - .5; const d = Math.hypot(dx, dy); dx /= d; dy /= d;
    const room = Math.max(24, (e.y - 6) / Math.max(.2, -dy));
    const len = Math.min(room, (e.x < 560 ? 46 : 34) + (i * 29) % 36), w = e.x < 560 ? 9 + i % 3 * 2 : 7;
    thorn(x, e.x - dx * 12, e.y - dy * 12, dx, dy, len + 12, w, (i % 2 ? 1 : -1) * len * .16, i % 3 === 0);
  });
  x.drawImage(image, FRAME[0], FRAME[1], FRAME[2], FRAME[3]);
  return c;
}
function drawFrame(ctx) {
  if (art) ctx.drawImage(art, 0, 0, 1360, 740);
  else if (frame) ctx.drawImage(frame, FRAME[0], FRAME[1], FRAME[2], FRAME[3]);
}
const hash = n => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };
let perimeter = 0;
// Point on the smoothed silhouette at u ∈ [0, 1), with its outward normal.
function at(u) {
  const n = outline.length, f = (((u % 1) + 1) % 1) * n, k = Math.floor(f) % n, q = f - Math.floor(f), a = outline[k], b = outline[(k + 1) % n];
  return { x: a.x + (b.x - a.x) * q, y: a.y + (b.y - a.y) * q, nx: a.nx + (b.nx - a.nx) * q, ny: a.ny + (b.ny - a.ny) * q };
}
// One flame streak: it runs along the silhouette like a current in the rim, hugging the edge rather than flaring out.
function wisp(j, time) {
  if (!perimeter) outline.forEach((p, i) => { const q = outline[(i + 1) % outline.length]; perimeter += Math.hypot(q.x - p.x, q.y - p.y); });
  const h1 = hash(j), h2 = hash(j + 50), life = (time * (.32 + h1 * .2) + h2) % 1, fade = Math.sin(Math.PI * life);
  const u0 = j / 46 + time * (.008 + h1 * .008) * (j % 3 ? 1 : -1), len = (60 + h2 * 90) * Math.pow(fade, .5), w0 = 4 + h1 * 6, pts = [];
  for (let t = 0; t <= 1.0001; t += 1 / 16) {
    const p = at(u0 + t * len / perimeter), off = 2 + Math.sin(t * 5 + time * 3 + j) * 4 * t;
    pts.push({ x: p.x + p.nx * off, y: p.y + p.ny * off, nx: p.nx, ny: p.ny, w: w0 * Math.pow(Math.sin(Math.PI * t), .7) });
  }
  return { pts, fade };
}
function ribbon(g, pts) {
  g.beginPath();
  pts.forEach((p, i) => i ? g.lineTo(p.x + p.nx * p.w, p.y + p.ny * p.w) : g.moveTo(p.x + p.nx * p.w, p.y + p.ny * p.w));
  for (let i = pts.length - 1; i >= 0; i--) { const p = pts[i]; g.lineTo(p.x - p.nx * p.w, p.y - p.ny * p.w); }
  g.closePath();
}
// Crimson rim glow hugging the frame, painted at third resolution with a light blur.
function aura(g, time) {
  if (!outline.length) return;
  g.save(); g.globalCompositeOperation = 'lighter'; g.lineJoin = 'round';
  g.beginPath(); outline.forEach((p, i) => i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)); g.closePath();
  g.filter = 'blur(3px)'; g.strokeStyle = `rgba(200,0,14,${.5 + .1 * Math.sin(time * 1.4)})`; g.lineWidth = 18; g.stroke();
  g.filter = 'blur(1px)'; g.strokeStyle = 'rgba(255,40,22,.4)'; g.lineWidth = 5; g.stroke();
  // The wisps add up, so they are summed unblurred on a scratch layer and blurred once together.
  if (!wisps || wisps.width !== g.canvas.width || wisps.height !== g.canvas.height) { wisps = document.createElement('canvas'); wisps.width = g.canvas.width; wisps.height = g.canvas.height; }
  const w = wisps.getContext('2d');
  w.setTransform(1, 0, 0, 1, 0, 0); w.clearRect(0, 0, wisps.width, wisps.height); w.setTransform(g.getTransform()); w.globalCompositeOperation = 'lighter';
  for (let j = 0; j < 46; j++) {
    const { pts, fade } = wisp(j, time); if (fade < .02) continue;
    ribbon(w, pts); w.fillStyle = `rgba(255,30,18,${.85 * fade})`; w.fill();
  }
  g.setTransform(1, 0, 0, 1, 0, 0); g.filter = 'blur(1.5px)'; g.drawImage(wisps, 0, 0);
  g.restore();
}
// Crisp silk threads inside the brightest wisps give the fire its streaked, satin look from the clip.
function threads(ctx, time) {
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
  for (let j = 0; j < 46; j += 2) {
    const { pts, fade } = wisp(j, time); if (fade < .05) continue;
    for (const [width, color] of [[2.4, `rgba(255,70,40,${.45 * fade})`], [1, `rgba(255,210,180,${.4 * fade})`]]) {
      ctx.beginPath(); pts.slice(2, -2).forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y));
      ctx.strokeStyle = color; ctx.lineWidth = width; ctx.stroke();
    }
  }
  ctx.restore();
}
// The aura sits behind the ornament: paint it, then repaint the frame on top.
export function tigerEffect(ctx, time, width, height) {
  if (!glow) { glow = document.createElement('canvas'); glow.width = Math.round(TIGER_W / 3); glow.height = Math.round(TIGER_H / 3); }
  const g3 = glow.getContext('2d'); g3.setTransform(1, 0, 0, 1, 0, 0); g3.clearRect(0, 0, glow.width, glow.height); g3.scale(1 / 3, 1 / 3); g3.translate(OX, OY);
  aura(g3, time);
  ctx.save(); ctx.scale(width / TIGER_W, height / TIGER_H);
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(glow, 0, 0, TIGER_W, TIGER_H);
  ctx.restore();
  ctx.translate(OX, OY); threads(ctx, time); drawFrame(ctx);
  ctx.restore();
}
