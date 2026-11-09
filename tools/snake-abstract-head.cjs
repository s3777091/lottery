// Lightly stylise the serpent head of the jade frame: erase the forked tongue, replace the
// realistic eye with a sleek emerald gem. Usage: node tools/snake-abstract-head.cjs tools/snake-moonweave-source.webp public/brand/snake-moonweave-v4.png [previewCrop]
const sharp = require('sharp');
const [src, dst, preview] = process.argv.slice(2);
const OX = 1120, OY = 40; // crop-space offsets used while measuring
const P = pts => pts.map(([x, y]) => `${x + OX},${y + OY}`).join(' ');
const W = 1774, H = 887;

const erase = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <polygon fill="#000" points="${P([[100, 232], [120, 205], [150, 195], [186, 179], [200, 192], [170, 212], [120, 242]])}"/>
  <polygon fill="#000" points="${P([[168, 206], [186, 199], [194, 214], [152, 246], [104, 298], [14, 298], [24, 262], [58, 238], [110, 226], [150, 215]])}"/>
</svg>`;

const ex = 325 + OX, ey = 118 + OY;
const eye = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="enamel" cx="50%" cy="50%" r="50%">
      <stop offset="0" stop-color="#0a3c44"/><stop offset=".75" stop-color="#062a31"/><stop offset="1" stop-color="#062a31" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="gem" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#d8ffe9"/><stop offset=".3" stop-color="#3cf0a0"/><stop offset=".7" stop-color="#0a9a5c"/><stop offset="1" stop-color="#03482c"/>
    </linearGradient>
    <filter id="soft"><feGaussianBlur stdDeviation="4"/></filter>
    <filter id="glow" x="-50%" y="-100%" width="200%" height="300%"><feGaussianBlur stdDeviation="7"/></filter>
  </defs>
  <ellipse cx="${ex}" cy="${ey}" rx="58" ry="44" fill="url(#enamel)" filter="url(#soft)"/>
  <g transform="translate(${ex} ${ey}) rotate(-12) scale(1.12)">
    <path d="M-66 4 Q-18 -26 62 -10 Q10 18 -66 4 Z" fill="#2bff9a" opacity=".55" filter="url(#glow)"/>
    <path d="M-66 4 Q-18 -26 62 -10 Q10 18 -66 4 Z" fill="url(#gem)" stroke="#eef6f3" stroke-width="3.5"/>
    <path d="M-50 1 Q-12 -15 44 -8" fill="none" stroke="#f4fff9" stroke-width="2.4" stroke-linecap="round" opacity=".9"/>
    <circle cx="-4" cy="-4" r="3.2" fill="#ffffff"/>
  </g>
  <defs>
    <linearGradient id="silver" gradientUnits="userSpaceOnUse" x1="0" y1="${191 + OY}" x2="0" y2="${209 + OY}"><stop offset="0" stop-color="#e9ebec"/><stop offset=".55" stop-color="#868d94"/><stop offset="1" stop-color="#c4c8cc"/></linearGradient>
    <linearGradient id="fadeIn" gradientUnits="userSpaceOnUse" x1="${88 + OX}" y1="0" x2="${118 + OX}" y2="0"><stop offset="0" stop-color="#000"/><stop offset="1" stop-color="#fff"/></linearGradient>
    <mask id="whipMask" maskUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${H}"><rect x="0" y="0" width="${W}" height="${H}" fill="url(#fadeIn)"/></mask>
  </defs>
  <g mask="url(#whipMask)">
    <path d="M${80 + OX} ${206 + OY} Q${125 + OX} ${202 + OY} ${152 + OX} ${196 + OY} T${186 + OX} ${186 + OY}" fill="none" stroke="#3a4047" stroke-width="10"/>
    <path d="M${80 + OX} ${206 + OY} Q${125 + OX} ${202 + OY} ${152 + OX} ${196 + OY} T${186 + OX} ${186 + OY}" fill="none" stroke="url(#silver)" stroke-width="7.5"/>
    <path d="M${80 + OX} ${204 + OY} Q${125 + OX} ${200 + OY} ${152 + OX} ${194 + OY}" fill="none" stroke="#ffffff" stroke-width="1.4" opacity=".6"/>
  </g>
</svg>`;

(async () => {
  const out = await sharp(src)
    .composite([{ input: Buffer.from(erase), blend: 'dest-out' }, { input: Buffer.from(eye), blend: 'over' }])
    .png().toBuffer();
  await sharp(out).toFile(dst);
  if (preview) await sharp(out).extract({ left: OX, top: OY, width: 654, height: 400 }).flatten({ background: '#203040' }).png().toFile(preview);
  console.log('ok');
})();
