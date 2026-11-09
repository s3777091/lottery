// Approved abstract lavender-and-jade frame; winner lettering stays editable.
const W = 1360, H = 740;
let art, pending;
export function loadOxCardAssets() {
  if (!pending) pending = new Promise(resolve => {
    const image = new Image();
    image.onload = () => { art = image; resolve(); };
    image.onerror = () => { pending = undefined; resolve(); };
    image.src = '/brand/ox-lavender-jade-v1.webp';
  });
  return pending;
}
export function oxWinnerCard(o, scale = 1) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(W * scale); canvas.height = Math.round(H * scale);
  const x = canvas.getContext('2d'); x.scale(scale, scale);
  if (art) {
    const h = W * art.naturalHeight / art.naturalWidth;
    x.drawImage(art, 0, (H - h) / 2, W, h);
  }
  function text(value, y, size, color = '#f5efff', weight = 700) {
    if (!value) return; x.textAlign = 'center'; x.textBaseline = 'middle';
    do { x.font = `${weight} ${size}px "Be Vietnam Pro", sans-serif`; if (x.measureText(String(value)).width <= 740) break; } while (--size > 1);
    x.fillStyle = color; x.fillText(String(value), 815, y);
  }
  text('CELESTIAL OX', 335, 16, '#c6b3ed', 600);
  text(o.name, 390, 54, '#faf7ff', 800); text(o.vietnameseName, 438, 26, '#ded6f4');
  let size = 24, lines;
  do {
    lines = []; let line = ''; x.font = `600 ${size}px "Be Vietnam Pro", sans-serif`;
    for (const word of String(o.description || '').trim().split(/\s+/).filter(Boolean)) {
      const next = line ? `${line} ${word}` : word;
      if (line && x.measureText(next).width > 730) { lines.push(line); line = word; } else line = next;
    }
    if (line) lines.push(line);
    if (lines.length <= 2 && lines.every(v => x.measureText(v).width <= 730)) break;
  } while (--size > 1);
  lines.forEach((line, i) => text(line, 484 + (i - (lines.length - 1) / 2) * 28, size, '#e5dbff', 600));
  text(o.info, 532, 17, '#adcfed', 600);
  return { canvas, w: W, h: H };
}

// Loop after the reference blade: a slow ring of light (streaks, suns, moons, stars) orbits the
// left horn in 3D, spirals slowly down into the jewel at the horn's root, the jewel flares, then light runs out
// along both rims opening blossoms whose petals fall back toward the jewel.
const P = 11.8, MERGE = 2.6, FLASH = 5.4, RUN = 5.6, RUN_T = 2.4, FALL = 2.4;
const J = [190, 232]; // jewel at the root of the left horn
const RING = { x: 232, y: 210, r: 220, tilt: -.6 };
const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const alpha = (v) => clamp(v, 0, 1).toFixed(3);
const outCubic = (t) => 1 - Math.pow(1 - t, 3), inOutSine = (t) => (1 - Math.cos(Math.PI * t)) / 2;
const outBack = (t) => 1 + 2.70158 * Math.pow(t - 1, 3) + 1.70158 * Math.pow(t - 1, 2);
const dots = {};
function glowDot(ice) {
  const key = ice === 'sun' ? 'sun' : ice ? 'ice' : 'lav';
  if (dots[key]) return dots[key];
  const c = dots[key] = document.createElement('canvas'); c.width = c.height = 64;
  const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(.18, { sun: '#fff0cc', ice: '#d8ecff', lav: '#e2d8ff' }[key]);
  g.addColorStop(.4, { sun: 'rgba(255,206,140,.35)', ice: 'rgba(150,200,255,.35)', lav: 'rgba(190,168,255,.35)' }[key]);
  g.addColorStop(1, 'rgba(170,150,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  return c;
}
function spark(x, cx, cy, s, a, ice) {
  if (a <= .01) return;
  x.globalAlpha = Math.min(1, a);
  x.drawImage(glowDot(ice), cx - s / 2, cy - s / 2, s, s);
  x.globalAlpha = 1;
}
function flare(x, cx, cy, len, th, a, rot) {
  if (len < 1 || a <= .005) return;
  x.save(); x.translate(cx, cy); x.rotate(rot);
  const g = x.createLinearGradient(-len, 0, len, 0);
  g.addColorStop(0, 'rgba(180,170,255,0)'); g.addColorStop(.5, `rgba(255,255,255,${alpha(a)})`); g.addColorStop(1, 'rgba(180,170,255,0)');
  x.fillStyle = g;
  x.beginPath(); x.moveTo(-len, 0); x.lineTo(0, -th); x.lineTo(len, 0); x.lineTo(0, th); x.closePath(); x.fill();
  x.restore();
}
// Rim tracks measured on the artwork: over the top edge, and down the left side then along the bottom.
const RIMS = [
  [J, [300, 262], [413, 293], [543, 330], [717, 315], [870, 298], [1022, 326], [1152, 352], [1217, 326], [1304, 370]],
  [J, [205, 300], [185, 413], [217, 522], [435, 543], [652, 533], [826, 522], [978, 543], [1152, 543], [1261, 489], [1315, 413]],
];
let tracks;
// Catmull-Rom through the measured points, resampled evenly so heads move at a steady speed.
function rimTracks() {
  if (tracks) return tracks;
  tracks = RIMS.map((p) => {
    const raw = [];
    for (let i = 0; i < p.length - 1; i++) {
      const a = p[Math.max(0, i - 1)], b = p[i], c = p[i + 1], d = p[Math.min(p.length - 1, i + 2)];
      for (let s = 0; s < 1; s += .05) {
        const s2 = s * s, s3 = s2 * s;
        raw.push([0, 1].map((k) => .5 * (2 * b[k] + (c[k] - a[k]) * s + (2 * a[k] - 5 * b[k] + 4 * c[k] - d[k]) * s2 + (3 * b[k] - a[k] - 3 * c[k] + d[k]) * s3)));
      }
    }
    raw.push(p[p.length - 1]);
    const len = [0];
    for (let i = 1; i < raw.length; i++) len.push(len[i - 1] + Math.hypot(raw[i][0] - raw[i - 1][0], raw[i][1] - raw[i - 1][1]));
    const total = len[len.length - 1], out = [];
    for (let i = 0, j = 0; i <= 240; i++) {
      const L = total * i / 240;
      while (j < len.length - 2 && len[j + 1] < L) j++;
      const u = (L - len[j]) / (len[j + 1] - len[j] || 1);
      out.push([raw[j][0] + (raw[j + 1][0] - raw[j][0]) * u, raw[j][1] + (raw[j + 1][1] - raw[j][1]) * u]);
    }
    return out;
  });
  return tracks;
}
// interpolated, so slow drifts glide instead of stepping from sample to sample
function at(track, f) {
  const p = clamp(f, 0, 1) * (track.length - 1), i = Math.min(track.length - 2, p | 0), u = p - i, a = track[i], b = track[i + 1];
  return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u];
}
let clouds, anchors;
// Soft lavender cloud puffs, each built once from overlapping radial blobs.
function cloudSprites() {
  if (clouds) return clouds;
  let n = 7;
  const r = () => ((n = (n * 16807) % 2147483647) - 1) / 2147483646;
  clouds = [0, 1, 2].map(() => {
    // built small: it is only ever stamped into the third-resolution haze layer
    const c = document.createElement('canvas'); c.width = 96; c.height = 60;
    const x = c.getContext('2d');
    x.scale(.375, .375);
    for (let i = 0; i < 16; i++) {
      const a = r() * TAU, d = Math.sqrt(r()), px = 128 + Math.cos(a) * d * 80, py = 84 + Math.sin(a) * d * 34 - (1 - d) * 10, s = 26 + r() * 30 * (1 - d * .5);
      const g = x.createRadialGradient(px, py, 0, px, py, s);
      g.addColorStop(0, 'rgba(222,212,255,.5)'); g.addColorStop(.5, 'rgba(172,156,252,.26)'); g.addColorStop(1, 'rgba(150,140,255,0)');
      x.fillStyle = g; x.fillRect(px - s, py - s, s * 2, s * 2);
    }
    return c;
  });
  return clouds;
}
// Where the artwork's mist already sits: just outside both rims, plus the cradle between the horns.
function cloudAnchors() {
  if (anchors) return anchors;
  anchors = [[230, 178, -.4], [310, 190, -.2], [150, 120, -.9], [270, 150, -.3], [110, 200, -1.1]];
  rimTracks().forEach((track, side) => {
    for (let f = .05; f < .99; f += .065) {
      const [px, py, ang, out] = rimFrame(track, side, f);
      anchors.push([px + out[0] * 18, py + out[1] * 18, ang]);
    }
  });
  return anchors;
}
// point on a rim, its upright-ish tangent angle and the outward normal
function rimFrame(track, side, f) {
  const [qx, qy] = at(track, f - .02), [nx, ny] = at(track, f + .02), [px, py] = at(track, f);
  const tl = Math.hypot(nx - qx, ny - qy) || 1, tx = (nx - qx) / tl, ty = (ny - qy) / tl;
  let ang = Math.atan2(ty, tx);
  if (ang > Math.PI / 2) ang -= Math.PI; else if (ang < -Math.PI / 2) ang += Math.PI;
  return [px, py, ang, side ? [-ty, tx] : [ty, -tx]];
}
function puff(x, img, px, py, ang, s, a) {
  x.save(); x.translate(px, py); x.rotate(ang); x.scale(s, s);
  x.globalAlpha = clamp(a, 0, 1);
  x.drawImage(img, -128, -84, 256, 160);
  x.restore();
}
// Resting puffs drift, bob, tilt and breathe on their own rhythms, while a second layer streams
// steadily along both rims back toward the horns, so the mist visibly flows.
// They are painted into a third-resolution haze layer (with a margin, since mist spills past the card)
// and composited once: dozens of large soft sprites are the costliest part of the frame otherwise.
const HK = 1 / 3, HM = 140;
// The mist moves under a pixel per frame, so the layer is only repainted 30 times a second.
let haze, hazeTick = NaN;
function drawClouds(x, time) {
  if (!haze) { haze = document.createElement('canvas'); haze.width = Math.ceil((W + HM * 2) * HK); haze.height = Math.ceil((H + HM * 2) * HK); }
  const tick = Math.floor(time * 30);
  if (tick !== hazeTick) { hazeTick = tick; paintHaze(haze.getContext('2d'), tick / 30); }
  // plain alpha blending: an upscaled 'screen' composite costs over twice as much
  x.globalCompositeOperation = 'source-over';
  x.drawImage(haze, -HM, -HM, W + HM * 2, H + HM * 2);
}
function paintHaze(h, time) {
  const S = cloudSprites();
  h.setTransform(1, 0, 0, 1, 0, 0); h.clearRect(0, 0, haze.width, haze.height);
  h.setTransform(HK, 0, 0, HK, HM * HK, HM * HK);
  cloudAnchors().forEach(([ax, ay, ang], i) => {
    const ph = i * 2.39;
    const dx = Math.sin(time * .42 + ph) * 26 + Math.sin(time * .19 + ph * 1.7) * 12, dy = Math.cos(time * .35 + ph) * 11;
    const s = (.5 + (i * .37 % 1) * .45) * (1 + .14 * Math.sin(time * .5 + ph));
    puff(h, S[i % 3], ax + dx, ay + dy, ang * .8 + Math.sin(time * .23 + ph) * .16, s, .42 + .2 * Math.sin(time * .45 + ph * 1.3));
  });
  rimTracks().forEach((track, side) => {
    for (let i = 0; i < 12; i++) {
      const f = 1 - ((i / 12 + time * .014 + side * .04) % 1), [px, py, ang, out] = rimFrame(track, side, f);
      const lift = 24 + Math.sin(time * .6 + i * 1.9) * 10, s = .55 + (i * .53 % 1) * .4;
      puff(h, S[(i + side) % 3], px + out[0] * lift, py + out[1] * lift, ang + Math.sin(time * .4 + i) * .15, s, .5 * Math.sin(Math.PI * f));
    }
  });
}
// The ring is a circle in 3D, inclined along the horns' diagonal and slowly rocking and rolling, so
// it reads as an orbit seen at an angle. To merge, it spirals gently inward and back into depth.
function ringAt(c) {
  const f = clamp((c - MERGE) / (FLASH - MERGE), 0, 1), m = inOutSine(f);
  return {
    f, m, spin: .45 * c + 2.2 * f * f,
    x: RING.x + (J[0] - RING.x) * m, y: RING.y + (J[1] - RING.y) * m, R: RING.r * Math.pow(1 - f, .7),
    incl: .95 + .25 * Math.sin(c * .7) + .3 * m, yaw: .4 * Math.sin(c * .45 + 1), depth: -200 * m,
  };
}
// point on the ring, how far in front of the horn it is (0 behind … 1 in front), and its perspective scale
function onRing(r, a, lift = 0) {
  const R = r.R + lift * (1 - r.m), px = Math.cos(a) * R, py = Math.sin(a) * R;
  const y1 = py * Math.cos(r.incl), z1 = py * Math.sin(r.incl);
  const x2 = px * Math.cos(r.yaw) + z1 * Math.sin(r.yaw), z2 = z1 * Math.cos(r.yaw) - px * Math.sin(r.yaw);
  const k = 900 / (900 - z2 - r.depth), sx = x2 * k, sy = y1 * k, ct = Math.cos(RING.tilt), st = Math.sin(RING.tilt);
  return [r.x + sx * ct - sy * st, r.y + sx * st + sy * ct, .5 + .5 * z2 / (R || 1), k];
}
function moon(x, cx, cy, s, rot, a) {
  x.save(); x.translate(cx, cy); x.rotate(rot);
  x.fillStyle = `rgba(248,246,255,${alpha(a)})`;
  x.beginPath(); x.arc(0, 0, s, -Math.PI / 2, Math.PI / 2); x.ellipse(0, 0, s * .45, s, 0, Math.PI / 2, -Math.PI / 2, true); x.fill();
  x.restore();
}
function orb(x, cx, cy, s, a, sun) {
  const g = x.createRadialGradient(cx - s * .3, cy - s * .3, 0, cx, cy, s);
  g.addColorStop(0, `rgba(255,255,255,${alpha(a)})`);
  g.addColorStop(.7, sun ? `rgba(255,226,170,${alpha(a * .9)})` : `rgba(214,220,255,${alpha(a * .85)})`);
  g.addColorStop(1, sun ? `rgba(255,170,90,${alpha(a * .45)})` : `rgba(170,160,240,${alpha(a * .4)})`);
  x.fillStyle = g; x.beginPath(); x.arc(cx, cy, s, 0, TAU); x.fill();
}
// One cherry-blossom petal with the notched tip of a sakura petal, baked once at 2× and stamped,
// base at the origin; flip squeezes it sideways so a falling petal seems to turn over in the air.
const PL = 48, SL = 28;
let petalImg, stamenImg;
function petalSprite() {
  if (petalImg) return petalImg;
  const c = petalImg = document.createElement('canvas'), len = PL, w = len * .5;
  c.width = Math.ceil((len * 1.1 + 6) * 2); c.height = Math.ceil((len + 6) * 2);
  const x = c.getContext('2d');
  x.scale(2, 2); x.translate(c.width / 4, len + 3);
  const g = x.createRadialGradient(0, 0, 0, 0, 0, len);
  g.addColorStop(0, 'rgba(238,128,170,1)'); g.addColorStop(.28, 'rgba(255,232,242,1)'); g.addColorStop(.75, 'rgba(255,220,235,.95)'); g.addColorStop(1, 'rgba(248,186,214,.9)');
  x.beginPath(); x.moveTo(0, 0);
  x.bezierCurveTo(w * .9, -len * .15, w * 1.05, -len * .75, w * .42, -len);
  x.quadraticCurveTo(w * .18, -len * .98, 0, -len * .84);
  x.quadraticCurveTo(-w * .18, -len * .98, -w * .42, -len);
  x.bezierCurveTo(-w * 1.05, -len * .75, -w * .9, -len * .15, 0, 0);
  x.fillStyle = g; x.fill();
  x.strokeStyle = 'rgba(226,150,188,.55)'; x.lineWidth = 1; x.stroke();
  x.beginPath(); x.moveTo(0, -len * .1); x.lineTo(0, -len * .62);
  x.strokeStyle = 'rgba(240,168,200,.35)'; x.lineWidth = .8; x.stroke();
  return c;
}
function petal(x, px, py, len, rot, a, flip = 1) {
  if (a <= .01 || len < .5) return;
  const p = petalSprite(), k = len / PL / 2;
  x.save(); x.translate(px, py); x.rotate(rot); x.scale(flip * k, k);
  x.globalAlpha = Math.min(1, a);
  x.drawImage(p, -p.width / 2, -(PL + 3) * 2);
  x.restore();
}
// fine stamens with pollen tips at the heart of a blossom, baked the same way
function stamenSprite() {
  if (stamenImg) return stamenImg;
  const c = stamenImg = document.createElement('canvas'), half = Math.ceil(SL * 1.2 + 4);
  c.width = c.height = half * 4;
  const x = c.getContext('2d');
  x.scale(2, 2); x.translate(half, half);
  for (let i = 0; i < 11; i++) {
    const ang = i * TAU / 11 + Math.sin(i * 3.7) * .15, l = SL * (.75 + (i * .29 % 1) * .35);
    const ex = Math.cos(ang) * l, ey = Math.sin(ang) * l;
    x.strokeStyle = 'rgba(232,150,186,.8)'; x.lineWidth = .8;
    x.beginPath(); x.moveTo(0, 0); x.lineTo(ex, ey); x.stroke();
    x.fillStyle = `rgb(255,${i % 3 ? 214 : 182},${i % 3 ? 130 : 200})`;
    x.beginPath(); x.arc(ex, ey, SL * .09, 0, TAU); x.fill();
  }
  return c;
}
function stamens(x, cx, cy, len, a, turn) {
  if (a <= .01 || len < .5) return;
  const p = stamenSprite(), k = len / SL / 2;
  x.save(); x.translate(cx, cy); x.rotate(turn); x.scale(k, k);
  x.globalAlpha = Math.min(1, a);
  x.drawImage(p, -p.width / 2, -p.height / 2);
  x.restore();
}
const STREAKS = [[0, 1.5, 1], [2.1, .9, 1.25], [3.6, 1.2, .85], [5, .6, 1.4]]; // offset, length, speed
// the moon-and-orb procession riding the ring: angle behind the lead, kind, radius
// suns and moons spaced round the ring (angle, kind, radius); small orbs ride between them
const BODIES = [0, 1, 2, 3, 4, 5].flatMap((i) => [[i * TAU / 6, i % 2 ? 'moon' : 'sun', 12 + i % 3 * 3], [i * TAU / 6 + .5, 'orb', 3.5]]);
const BLOSSOMS = [.1, .24, .38, .52, .66, .8, .93];
export function oxEffect(x, time, width, height) {
  const c = ((time % P) + P) % P;
  x.save();
  x.scale(width / W, height / H);
  drawClouds(x, time);
  x.globalCompositeOperation = 'lighter';
  x.lineCap = 'round';
  // 1. the ring of light orbiting the left horn in 3D, then spiralling slowly down into the jewel
  if (c < FLASH) {
    const r = ringAt(c), vis = clamp(c / .8, 0, 1), shrink = 1 - r.m * .25;
    for (let i = 0; i < 36; i++) {
      const [ax, ay, d] = onRing(r, i / 36 * TAU), [bx, by] = onRing(r, (i + 1) / 36 * TAU);
      x.strokeStyle = `rgba(206,196,255,${alpha(vis * (.06 + .14 * d))})`; x.lineWidth = 1.2;
      x.beginPath(); x.moveTo(ax, ay); x.lineTo(bx, by); x.stroke();
    }
    for (const [off, len, speed] of STREAKS) {
      const head = r.spin * speed * 2.2 + off;
      for (let i = 0; i < 12; i++) {
        const k = (i + 1) / 12, [ax, ay, d] = onRing(r, head - len * (1 - i / 12)), [bx, by] = onRing(r, head - len * (1 - k));
        const a = vis * k * k * (.3 + .7 * d);
        x.beginPath(); x.moveTo(ax, ay); x.lineTo(bx, by);
        x.strokeStyle = `rgba(190,176,255,${alpha(a * .3)})`; x.lineWidth = 6 * k; x.stroke();
        x.strokeStyle = `rgba(255,255,255,${alpha(a)})`; x.lineWidth = .8 + 1.6 * k; x.stroke();
      }
    }
    // as the ring spirals in, the suns and moons drift together little by little until they meet as one;
    // nearer bodies are drawn larger and over the farther ones
    const lead = r.spin * 1.6 + 1.2, merge = 1 - r.f * r.f;
    const placed = BODIES.map(([da, kind, s]) => { const ang = lead + da * merge; return [ang, kind, s, ...onRing(r, ang)]; });
    placed.sort((p, q) => p[5] - q[5]);
    for (const [ang, kind, s, bx, by, d, k] of placed) {
      const a = vis * (.4 + .6 * d), z = s * k * shrink;
      spark(x, bx, by, z * (kind === 'sun' ? 9 : 6), a * .85, kind === 'sun' ? 'sun' : true);
      if (kind === 'sun') flare(x, bx, by, z * 2.4, 1.3, a * .8, ang * .5);
      if (kind === 'moon') moon(x, bx, by, z, RING.tilt + ang, a); else orb(x, bx, by, z, a, kind === 'sun');
    }
    for (let i = 0; i < 18; i++) {
      const [sx, sy, d, k] = onRing(r, i * .349 + r.spin * .7, Math.sin(i * 5.3) * 10);
      spark(x, sx, sy, (5 + i % 4 * 3) * k * shrink, vis * (.3 + .7 * d) * Math.pow(.5 + .5 * Math.sin(time * 3 + i * 1.9), 3), i % 2 === 0);
    }
  }
  // the merged bodies burst: a shockwave and a spray of sun, moon and star fragments
  if (c >= FLASH && c < FLASH + 1.1) {
    const e = (c - FLASH) / 1.1, q = outCubic(e);
    for (let i = 0; i < 48; i++) {
      const a = i / 48 * TAU + Math.sin(i * 7.3) * .2, d = (120 + (i * 37 % 140)) * q;
      spark(x, J[0] + Math.cos(a) * d, J[1] + Math.sin(a) * d * .8, 10 + i % 3 * 6, (1 - e) * 1.2, i % 3 === 0 ? 'sun' : i % 3 === 1);
    }
    const w = clamp(e / .65, 0, 1);
    x.strokeStyle = `rgba(236,228,255,${alpha((1 - w) * .9)})`; x.lineWidth = 2 + 4 * (1 - w);
    x.beginPath(); x.ellipse(J[0], J[1], 30 + 230 * outCubic(w), (30 + 230 * outCubic(w)) * .62, RING.tilt, 0, TAU); x.stroke();
  }
  // 2. the jewel: dim while the ring circles, blazing as it closes, then a soft resting glow
  const spike = c < MERGE ? 0 : c < FLASH ? .55 * Math.pow((c - MERGE) / (FLASH - MERGE), 4) : Math.exp(-(c - FLASH) * 2.2);
  const I = .3 + .7 * spike, cr = (9 + 22 * I) * (1 + .08 * Math.sin(time * 4));
  const g = x.createRadialGradient(J[0], J[1], 0, J[0], J[1], cr * 3.2);
  g.addColorStop(0, `rgba(255,255,255,${alpha(I)})`);
  g.addColorStop(.15, `rgba(205,232,255,${alpha(I * .9)})`);
  g.addColorStop(.4, `rgba(190,170,255,${alpha(I * .38)})`);
  g.addColorStop(1, 'rgba(160,140,255,0)');
  x.fillStyle = g; x.beginPath(); x.arc(J[0], J[1], cr * 3.2, 0, TAU); x.fill();
  flare(x, J[0], J[1], 34 + 170 * spike, 1.8 + 2.4 * spike, I * .9, RING.tilt);
  flare(x, J[0], J[1], 22 + 80 * spike, 1.4 + 1.6 * spike, I * .7, RING.tilt + Math.PI / 2);
  flare(x, J[0], J[1], 16 + 44 * spike, 1.2, I * .45, time * .5);
  // 3. light runs out along both rims; blossoms open where it passes and their petals fall back
  if (c >= RUN) {
    const b = clamp((c - RUN) / RUN_T, 0, 1), head = 1 - (1 - b) * (1 - b), fade = 1 - clamp((c - RUN - RUN_T + .3) / .6, 0, 1);
    rimTracks().forEach((track, side) => {
      for (let i = 0; i < 14; i++) {
        const f0 = head - .25 * (1 - i / 14), f1 = head - .25 * (1 - (i + 1) / 14);
        if (f1 <= 0) continue;
        const [ax, ay] = at(track, Math.max(0, f0)), [bx, by] = at(track, f1), k = (i + 1) / 14;
        x.beginPath(); x.moveTo(ax, ay); x.lineTo(bx, by);
        x.strokeStyle = `rgba(170,150,255,${alpha(fade * k * .35)})`; x.lineWidth = 8 + 14 * k; x.stroke();
        x.strokeStyle = `rgba(${k > .8 ? '255,255,255' : '226,214,255'},${alpha(fade * k * 1.1)})`; x.lineWidth = 2 + 4 * k; x.stroke();
      }
      const [hx, hy] = at(track, head);
      spark(x, hx, hy, 100 * (1 - b * .4), fade * (1 - b * .5), false);
      spark(x, hx, hy, 40 * (1 - b * .4), fade, true);
      BLOSSOMS.forEach((f, n) => {
        const age = c - (RUN + RUN_T * (1 - Math.sqrt(1 - f)));
        if (age < 0) return;
        const [px, py] = at(track, f), [qx, qy] = at(track, f - .02), [nx, ny] = at(track, f + .02);
        const tl = Math.hypot(nx - qx, ny - qy) || 1, tx = (nx - qx) / tl, ty = (ny - qy) / tl;
        // blossoms sit just outside the rim: above the top edge, outside the left and bottom edges
        const out = side ? [-ty, tx] : [ty, -tx], bx = px + out[0] * 20, by = py + out[1] * 20;
        const size = 17 + n % 3 * 4, open = outBack(clamp(age / .6, 0, 1)), turn = n * 1.3 + side;
        const shown = Math.min(1, age * 4), held = 1 - clamp((age - .8) / .5, 0, 1);
        spark(x, bx, by, size * 3.2, shown * .55 * (1 - clamp((age - .8) / .9, 0, 1)), false);
        x.globalCompositeOperation = 'source-over';
        // 5 petals on the blossom, plus 4 loose ones shaken off with them so the drift reads clearly
        for (let i = 0; i < 9; i++) {
          const pa = age - (.8 + i * .09), loose = i >= 5, rot = turn + i * TAU / 5;
          if (pa < 0) { if (!loose) petal(x, bx, by, size * open, rot, shown * .96); continue; }
          if (pa > FALL) continue;
          // detached petals float back along the rim toward the jewel: slow, light, swaying and turning over
          const sx = loose ? Math.cos(rot) * size * .7 : 0, sy = loose ? Math.sin(rot) * size * .7 : 0;
          const back = 72 * pa, sway = Math.sin(pa * 2.2 + i * 1.7) * 13, sink = 6 * pa + 3 * pa * pa;
          const end = Math.min(1, (FALL - pa) / (FALL * .4)), a = .9 * Math.min(1, pa * 6, end);
          petal(x, bx + sx - tx * back - ty * sway, by + sy - ty * back + tx * sway + sink, size * (loose ? .72 : .88) * (.4 + .6 * end),rot + pa * 1.1 * (i % 2 ? 1 : -1), a, Math.cos(pa * 3 + i * 1.3));
        }
        stamens(x, bx, by, size * .42 * open, shown * held, turn);
        x.globalCompositeOperation = 'lighter';
      });
    });
  }
  x.restore();
}
