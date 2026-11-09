// Tiger head as abstract cloisonné: smooth gold cells and gold wire over demon-blood enamel.
// The tone map is simplified hard (big median, then a median on the cell map) so small islands merge into flowing shapes.
const sharp = require(process.cwd() + '/node_modules/sharp');
const [src, out, preview] = process.argv.slice(2);
(async () => {
  const W = 1774, H = 887, raw = img => img.ensureAlpha().raw().toBuffer();
  const o = await raw(sharp(src)), s = await raw(sharp(src).median(13).blur(2)), soft = await raw(sharp(src).median(15).blur(6));
  const lum = (b, i) => (b[i] * .3 + b[i + 1] * .59 + b[i + 2] * .11) / 255;
  const HEAD = [[0, 40], [240, 0], [440, 20], [560, 120], [650, 240], [640, 300], [560, 360], [520, 440], [470, 470], [380, 420], [300, 330], [200, 262], [90, 205], [0, 175]];
  const inside = (x, y) => { let c = false; for (let a = 0, b = HEAD.length - 1; a < HEAD.length; b = a++) { const [xa, ya] = HEAD[a], [xb, yb] = HEAD[b]; if ((ya > y) !== (yb > y) && x < (xb - xa) * (y - ya) / (yb - ya) + xa) c = !c; } return c; };
  const hm = Buffer.alloc(W * H); for (let y = 0; y < 520; y++) for (let x = 0; x < 700; x++) hm[y * W + x] = inside(x, y) ? 255 : 0;
  const hb = await sharp(hm, { raw: { width: W, height: H, channels: 1 } }).blur(5).extractChannel(0).raw().toBuffer();
  // Four tone cells, then smooth the cell map itself.
  const cells = Buffer.alloc(W * H);
  for (let p = 0; p < W * H; p++) { const L = lum(s, p * 4); cells[p] = (L > .62 ? 3 : L > .3 ? 2 : L > .14 ? 1 : 0) * 85; }
  const cm = await sharp(cells, { raw: { width: W, height: H, channels: 1 } }).median(7).extractChannel(0).raw().toBuffer();
  const level = p => o[p * 4 + 3] < 30 ? 255 : Math.round(cm[p] / 85);
  const ramp = (stops, t) => { t = Math.max(0, Math.min(.999, t)) * (stops.length - 1); const k = t | 0, f = t - k, a = stops[k], b = stops[k + 1]; return [0, 1, 2].map(c => a[c] + (b[c] - a[c]) * f); };
  const GOLD = [[80, 40, 6], [160, 100, 24], [222, 170, 66], [248, 214, 130], [255, 240, 190]];
  const BLOOD = [[34, 0, 5], [96, 0, 12], [170, 4, 20], [232, 40, 36]];
  const res = Buffer.from(o);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const p = y * W + x, i = p * 4, m = hb[p] / 255, lv = level(p); if (!m || lv === 255) continue;
    const fine = lum(o, i), sm = lum(soft, i);
    let edge = false;
    if (lv < 3) for (let dy = -1; dy <= 1 && !edge; dy++) for (let dx = -1; dx <= 1; dx++) { const q = (y + dy) * W + x + dx, l2 = level(q); if (l2 !== lv) { edge = true; break; } }
    let c;
    // Gold keeps a little of the original sheen; enamel is shaded only by the smoothed light, so it reads as flat glaze.
    if (lv === 3) c = ramp(GOLD, .3 + sm * .5 + fine * .3);
    else if (edge) c = ramp(GOLD, .35 + fine * .4);
    else if (lv === 2) c = ramp(BLOOD, .45 + sm * .6);
    else if (lv === 1) c = ramp(BLOOD, .2 + sm * .6);
    else c = ramp(BLOOD, .05 + sm * .4);
    const e = Math.hypot(x - 478, y - 186);
    if (e < 16) c = ramp([[150, 0, 8], [255, 40, 16], [255, 130, 70], [255, 230, 180]], (1 - e / 16) * .85 + fine * .2);
    for (let k = 0; k < 3; k++) res[i + k] = Math.round(o[i + k] * (1 - m) + c[k] * m);
  }
  const img = () => sharp(res, { raw: { width: W, height: H, channels: 4 } });
  await img().png().toFile(out);
  await img().extract({ left: 0, top: 0, width: 720, height: 560 }).flatten({ background: '#1a0607' }).png().toFile(preview);
  console.log('ok');
})();
