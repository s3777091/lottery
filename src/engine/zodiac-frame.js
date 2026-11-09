// Calligraphic zodiac editions: artwork stays separate from live, fitted lettering.
export const FRAME_W = 1360, FRAME_H = 740;
const images = {};
let pending;
const themes = {
  tiger: { file: 'tiger-ember-slash-v3.webp', title: 'CRIMSON TIGER', rank: 'SOVEREIGN', ink: '#fff1ce', accent: '#edc77b', base: '#240a0b', rim: '#c39045' },
  snake: { file: 'snake-moonweave-v4.webp', title: 'CELESTIAL SERPENT', rank: 'ZODIAC', ink: '#edfff9', accent: '#abdaca', base: '#091f26', rim: '#7bafa8',
    // Baselines for title, rank, name, Vietnamese name, description and info: kept above the lower ribbons.
    rows: [238, 262, 318, 370, 418, 470] },
};
export function loadZodiacFrameAssets() {
  if (!pending) pending = Promise.all(Object.entries(themes).map(([tier, theme]) => new Promise(resolve => {
    if (images[tier]) return resolve();
    const image = new Image();
    image.onload = () => { images[tier] = image; resolve(); };
    image.onerror = () => { pending = undefined; resolve(); };
    image.src = '/brand/' + theme.file;
  })));
  return pending;
}
export function panel(x, tier) {
  x.beginPath();
  if (tier === 'tiger') {
    // A slashed lacquer silhouette follows the angular ember ornament.
    x.moveTo(236, 222); x.lineTo(1080, 180); x.lineTo(1195, 255);
    x.lineTo(1135, 560); x.lineTo(340, 595); x.lineTo(180, 477);
  } else {
    // The moon edition has a soft, flowing jade surface rather than a plaque.
    x.moveTo(235, 225); x.bezierCurveTo(435, 140, 925, 166, 1110, 218);
    x.bezierCurveTo(1220, 300, 1180, 485, 1060, 565);
    x.bezierCurveTo(835, 637, 410, 614, 230, 520);
    x.bezierCurveTo(175, 430, 180, 300, 235, 225);
  }
  x.closePath();
}
// paintBackground(x) lets an edition replace the default mineral fill inside the panel.
export function zodiacWinnerCard(o, scale = 1, paintBackground) {
  const theme = themes[o.tier], canvas = document.createElement('canvas');
  canvas.width = Math.round(FRAME_W * scale); canvas.height = Math.round(FRAME_H * scale);
  const x = canvas.getContext('2d'); x.scale(scale, scale);
  if (paintBackground) paintBackground(x); else {
    panel(x, o.tier);
    const bg = x.createRadialGradient(760, 370, 20, 710, 365, 620);
    bg.addColorStop(0, theme.base); bg.addColorStop(.65, o.tier === 'tiger' ? '#180809' : '#07171e'); bg.addColorStop(1, '#050710');
    x.fillStyle = bg; x.fill(); x.strokeStyle = theme.rim; x.lineWidth = 2; x.stroke();
    x.save(); x.clip();
    // Sparse mineral flecks at the edge keep the center quiet for editable content.
    for (let i = 0; i < 180; i++) {
      const px = 200 + (i * 137) % 1010, py = 190 + (i * 71) % 420;
      x.globalAlpha = px > 440 && px < 1080 && py > 260 && py < 510 ? .09 : .3;
      x.fillStyle = theme.accent; x.fillRect(px, py, i % 9 ? 1 : 2, i % 9 ? 1 : 2);
    }
    x.restore();
  }
  // Paint the frame into the static card too, so exports retain the full ornament.
  drawZodiacFrame(x, o.tier, 0, FRAME_W, FRAME_H);
  const cx = o.tier === 'tiger' ? 710 : 675;
  function text(value, y, size, color, max = 635, weight = 700) {
    if (!value) return;
    x.textAlign = 'center'; x.textBaseline = 'middle';
    do { x.font = `${weight} ${size}px "Be Vietnam Pro", sans-serif`; if (x.measureText(String(value)).width <= max) break; size--; } while (size > 1);
    x.fillStyle = color; x.fillText(String(value), cx, y);
  }
  x.shadowColor = '#03040bcc'; x.shadowBlur = 8;
  const rows = theme.rows || [272, 302, 365, 420, 467, 526];
  text(theme.title, rows[0], 20, theme.accent);
  text(theme.rank, rows[1], 11, theme.accent, 635, 500);
  text(o.name, rows[2], 60, theme.ink, 635, 800);
  text(o.vietnameseName, rows[3], 26, theme.accent);
  const words = String(o.description || '').trim().split(/\s+/).filter(Boolean);
  let lines = [], size = 23;
  do {
    lines = []; let line = ''; x.font = `600 ${size}px "Be Vietnam Pro", sans-serif`;
    for (const word of words) {
      const next = line ? line + ' ' + word : word;
      if (line && x.measureText(next).width > 610) { lines.push(line); line = word; } else line = next;
    }
    if (line) lines.push(line);
    if (lines.length <= 2 && lines.every(v => x.measureText(v).width <= 610)) break;
    size--;
  } while (size > 1);
  lines.forEach((line, i) => text(line, rows[4] + (i - (lines.length - 1) / 2) * 27, size, theme.ink, 610, 600));
  text(o.info, rows[5], 18, theme.accent, 610, 600);
  return { canvas, w: FRAME_W, h: FRAME_H };
}
export function drawZodiacFrame(ctx, tier, time, width, height) {
  if (!images[tier]) return;
  ctx.save(); ctx.scale(width / FRAME_W, height / FRAME_H);
  ctx.drawImage(images[tier], 8, 28, 1344, 672);
  ctx.restore();
}
