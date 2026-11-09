// Approved pearl-and-enamel artwork; lettering stays live for previews and exports.
// Motion stays where it was asked for: the top clouds, the right-hand wisps and the lower tail drift up and down
// like floating silk, and the big left flower bobs gently while shedding gold pollen. Everything else is still.
// The 3:1 artwork is stretched only partway to the collection's 2:1 footprint, centred vertically.
const W = 1360, H = 740, AX = 20, AY = 75, AW = 1320, AH = 590, TAU = Math.PI * 2;
let art, pending;
export function loadRoosterCardAssets() {
  if (!pending) pending = new Promise(resolve => {
    const image = new Image();
    image.onload = () => { art = image; resolve(); };
    image.onerror = () => { pending = undefined; resolve(); };
    image.src = '/brand/rooster-pearl-sun-v1.webp';
  });
  return pending;
}

// Quiet core around the lettering: rounded rect, signed distance in card pixels (negative inside).
const CORE = { x: 757.5, y: 411, hx: 297.5, hy: 125, r: 70 };
const ROO = { x: 1105, y: 425 };
const smooth = (a, b, v) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
function coreDist(px, py) {
  const qx = Math.abs(px - CORE.x) - (CORE.hx - CORE.r), qy = Math.abs(py - CORE.y) - (CORE.hy - CORE.r);
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - CORE.r;
}
// Floating areas as soft ellipses: centre, radii, lift in px, speed, phase drift along x, phase.
const FLOATS = [
  { x: 560, y: 155, rx: 560, ry: 91, a: 6, w: 1.15, k: .0022, ph: 0 },      // clouds and sun along the top
  { x: 1225, y: 338, rx: 135, ry: 168, a: 6, w: 1.3, k: .004, ph: 2.1 },     // wisps and leaves on the right
  { x: 880, y: 620, rx: 520, ry: 113, a: 6, w: 1.05, k: .0022, ph: 4 },      // lower border and tail
  { x: 305, y: 438, rx: 235, ry: 213, a: 4, w: .9, k: 0, ph: 1 },             // the flower, bobbing as one piece
];
const HEART = { x: 340, y: 497 };
// Same field as the shader, so the pollen leaves from where the flower currently is.
function displace(px, py, t) {
  const damp = smooth(35, 105, coreDist(px, py)) * (1 - .85 * (1 - smooth(60, 130, Math.hypot(px - ROO.x, (py - ROO.y) * .8))));
  let dx = 0, dy = 0;
  for (const f of FLOATS) {
    const e = Math.hypot((px - f.x) / f.rx, (py - f.y) / f.ry), wt = (1 - smooth(.55, 1.1, e)) * f.a * damp;
    if (!wt) continue;
    dy += wt * (Math.sin(f.w * t + f.k * px + f.ph) + .3 * Math.sin(1.7 * f.w * t + 2.1 * f.k * px + 2 * f.ph));
    dx += wt * .25 * Math.sin(.8 * f.w * t + f.ph + 1.3);
  }
  return [dx, dy];
}

// Base keeps the core (and a margin the moving layer fades in over); the moving layer is everything outside it.
let masks;
function coreMasks() {
  if (masks) return masks;
  const make = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; return c; };
  const inner = make(), outer = make(), gi = inner.getContext('2d'), go = outer.getContext('2d');
  const di = gi.createImageData(W, H), dout = go.createImageData(W, H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const d = coreDist(x + .5, y + .5), i = (y * W + x) * 4;
    di.data[i] = di.data[i + 1] = di.data[i + 2] = dout.data[i] = dout.data[i + 1] = dout.data[i + 2] = 255;
    di.data[i + 3] = 255 * (1 - smooth(20, 40, d));
    dout.data[i + 3] = 255 * smooth(0, 20, d);
  }
  gi.putImageData(di, 0, 0); go.putImageData(dout, 0, 0);
  return masks = { inner, outer };
}
function maskedArt(mask, scale) {
  const c = document.createElement('canvas'); c.width = Math.round(W * scale); c.height = Math.round(H * scale);
  const g = c.getContext('2d'); g.scale(scale, scale);
  if (art) g.drawImage(art, AX, AY, AW, AH);
  g.globalCompositeOperation = 'destination-in'; g.drawImage(mask, 0, 0, W, H);
  return c;
}

export function roosterWinnerCard(o, scale = 1) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(W * scale); canvas.height = Math.round(H * scale);
  const x = canvas.getContext('2d'); x.scale(scale, scale);
  // Match the other collectible cards' footprint, including room for the sun and clouds.
  if (art) x.drawImage(maskedArt(coreMasks().inner, scale), 0, 0, W, H);
  function text(value, y, size, color, weight = 700) {
    if (!value) return;
    x.textAlign = 'center'; x.textBaseline = 'middle';
    do { x.font = `${weight} ${size}px "Be Vietnam Pro", sans-serif`; if (x.measureText(String(value)).width <= 530) break; size--; } while (size > 1);
    x.fillStyle = color; x.fillText(String(value), 757, y);
  }
  x.shadowColor = '#ffffff'; x.shadowBlur = 5;
  text('DAWN ROOSTER', 306, 20, '#866330');
  text(o.name, 361, 60, '#244f50', 800);
  text(o.vietnameseName, 411, 26, '#396c69');
  const words = String(o.description || '').trim().split(/\s+/).filter(Boolean);
  let lines = [], size = 23;
  do {
    lines = []; let line = ''; x.font = `600 ${size}px "Be Vietnam Pro", sans-serif`;
    for (const word of words) {
      const next = line ? line + ' ' + word : word;
      if (line && x.measureText(next).width > 510) { lines.push(line); line = word; } else line = next;
    }
    if (line) lines.push(line);
    if (lines.length <= 2 && lines.every(v => x.measureText(v).width <= 510)) break;
    size--;
  } while (size > 1);
  lines.forEach((line, i) => text(line, 458 + (i - (lines.length - 1) / 2) * 27, size, '#244f50', 600));
  text(o.info, 512, 18, '#866330', 600);
  return { canvas, w: W, h: H };
}

// ---- Moving artwork (WebGL) ----
const fl = v => (Number.isInteger(v) ? v + '.' : String(+v.toFixed(5)));
const VERT = `attribute vec2 a;varying vec2 p;uniform vec2 s;void main(){p=vec2(a.x*.5+.5,.5-a.y*.5)*s;gl_Position=vec4(a,0.,1.);}`;
const FRAG = `precision highp float;varying vec2 p;uniform sampler2D tex;uniform float t,m;
float sm(float a,float b,float v){return smoothstep(a,b,v);}
void main(){
  vec2 q=abs(p-vec2(${CORE.x},${CORE.y}))-vec2(${CORE.hx - CORE.r},${CORE.hy - CORE.r});
  float d=length(max(q,0.))+min(max(q.x,q.y),0.)-${CORE.r}.;
  float damp=sm(35.,105.,d)*m*(1.-.85*(1.-sm(60.,130.,length((p-vec2(${ROO.x}.,${ROO.y}.))*vec2(1.,.8)))));
  float e,wt;vec2 dp=vec2(0.);
  ${FLOATS.map(f => `e=length((p-vec2(${fl(f.x)},${fl(f.y)}))/vec2(${fl(f.rx)},${fl(f.ry)}));wt=(1.-sm(.55,1.1,e))*${fl(f.a)}*damp;
  dp+=wt*vec2(.25*sin(${fl(.8 * f.w)}*t+${fl(f.ph + 1.3)}),sin(${fl(f.w)}*t+${fl(f.k)}*p.x+${fl(f.ph)})+.3*sin(${fl(1.7 * f.w)}*t+${fl(2.1 * f.k)}*p.x+${fl(2 * f.ph)}));`).join('\n  ')}
  vec2 uv=(p-dp-vec2(${AX}.,${AY}.))/vec2(${AW}.,${AH}.);
  vec4 c=(uv.x<0.||uv.y<0.||uv.x>1.||uv.y>1.)?vec4(0.):texture2D(tex,uv);
  gl_FragColor=c*sm(0.,20.,d);
}`;
let gl, glCanvas, glState;
function glInit() {
  if (gl !== undefined) return gl;
  gl = null;
  if (!art) { gl = undefined; return null; }
  glCanvas = document.createElement('canvas');
  const g = glCanvas.getContext('webgl', { premultipliedAlpha: true, preserveDrawingBuffer: true, antialias: false });
  if (!g) return null;
  const shader = (type, src) => { const s = g.createShader(type); g.shaderSource(s, src); g.compileShader(s); return s; };
  const prog = g.createProgram();
  g.attachShader(prog, shader(g.VERTEX_SHADER, VERT)); g.attachShader(prog, shader(g.FRAGMENT_SHADER, FRAG)); g.linkProgram(prog);
  if (!g.getProgramParameter(prog, g.LINK_STATUS)) return null;
  g.useProgram(prog);
  g.bindBuffer(g.ARRAY_BUFFER, g.createBuffer());
  g.bufferData(g.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), g.STATIC_DRAW);
  const loc = g.getAttribLocation(prog, 'a'); g.enableVertexAttribArray(loc); g.vertexAttribPointer(loc, 2, g.FLOAT, false, 0, 0);
  g.bindTexture(g.TEXTURE_2D, g.createTexture());
  g.pixelStorei(g.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
  g.texImage2D(g.TEXTURE_2D, 0, g.RGBA, g.RGBA, g.UNSIGNED_BYTE, art);
  for (const [k, v] of [[g.TEXTURE_MIN_FILTER, g.LINEAR], [g.TEXTURE_MAG_FILTER, g.LINEAR], [g.TEXTURE_WRAP_S, g.CLAMP_TO_EDGE], [g.TEXTURE_WRAP_T, g.CLAMP_TO_EDGE]]) g.texParameteri(g.TEXTURE_2D, k, v);
  glState = { s: g.getUniformLocation(prog, 's'), t: g.getUniformLocation(prog, 't'), m: g.getUniformLocation(prog, 'm') };
  g.uniform2f(glState.s, W, H);
  return gl = g;
}
let still;
function drawMovingArt(ctx, time, width, height) {
  if (!art) return;
  const g = glInit();
  if (!g) { still ||= maskedArt(coreMasks().outer, 1); ctx.drawImage(still, 0, 0, width, height); return; }
  // Render near the on-screen resolution, in coarse steps so a zooming card does not reallocate every frame.
  const T = ctx.getTransform(), k = Math.min(2, Math.max(.5, Math.round(Math.hypot(T.a, T.b) * width / W * 4) / 4));
  const cw = Math.round(W * k), ch = Math.round(H * k);
  if (glCanvas.width !== cw || glCanvas.height !== ch) { glCanvas.width = cw; glCanvas.height = ch; }
  g.viewport(0, 0, cw, ch);
  g.uniform1f(glState.t, time); g.uniform1f(glState.m, time === 0 ? 0 : 1);
  g.clearColor(0, 0, 0, 0); g.clear(g.COLOR_BUFFER_BIT);
  g.drawArrays(g.TRIANGLE_STRIP, 0, 4);
  ctx.drawImage(glCanvas, 0, 0, width, height);
}

// ---- Pollen ----
const hash = n => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };
// Stateless: each grain is reborn every cycle at a new spot among the petals, puffs out, then sinks and sways.
function pollen(ctx, t) {
  const [fx, fy] = displace(HEART.x, HEART.y, t), LIFE = 4.5;
  ctx.save();
  for (let j = 0; j < 64; j++) {
    const clock = t / LIFE + hash(j), cycle = Math.floor(clock), life = clock - cycle, seed = j * 31 + cycle * 7;
    const ang = hash(seed) * TAU, rad = 15 + hash(seed + 1) * 80, size = 1.8 + hash(seed + 2) ** 2 * 2.8;
    const dirX = Math.cos(ang), dirY = Math.sin(ang) * .8;
    const x = HEART.x + fx + dirX * (rad + 55 * life) + Math.sin(t * 1.3 + j) * 10 * life;
    const y = HEART.y + fy + dirY * rad + dirY * 30 * life - 14 * life + 95 * life * life;
    const a = Math.pow(Math.sin(Math.PI * life), .8);
    const halo = ctx.createRadialGradient(x, y, 0, x, y, size * 4.5);
    halo.addColorStop(0, `rgba(255,200,60,${.7 * a})`); halo.addColorStop(.4, `rgba(240,170,30,${.25 * a})`); halo.addColorStop(1, 'rgba(240,170,30,0)');
    ctx.fillStyle = halo; ctx.fillRect(x - size * 4.5, y - size * 4.5, size * 9, size * 9);
    // A darker gilt rim keeps each grain readable on the pale pearl.
    ctx.beginPath(); ctx.arc(x, y, size, 0, TAU);
    ctx.fillStyle = `rgba(${hash(seed + 3) < .3 ? '255,226,110' : '236,168,24'},${a})`; ctx.fill();
    ctx.strokeStyle = `rgba(150,95,10,${.55 * a})`; ctx.lineWidth = .8; ctx.stroke();
    ctx.fillStyle = `rgba(255,250,215,${.9 * a})`; ctx.beginPath(); ctx.arc(x - size * .3, y - size * .3, size * .35, 0, TAU); ctx.fill();
  }
  ctx.restore();
}

export function roosterForeground(ctx, time, width, height) {
  drawMovingArt(ctx, time, width, height);
  if (time === 0) return;
  ctx.save(); ctx.scale(width / W, height / H);
  pollen(ctx, time);
  ctx.restore();
}
