// Silver and cobalt guardian hound; lettering stays editable. The glowing water and cobalt enamel
// run through a WebGL liquid pass like the tidal goat: water streams around the frame with
// refraction, caustics and crests, while frost creeps along its outer edge and light snow drifts
// past. Falls back to plain 2D without WebGL.
import { LIQUID_VERT, LIQUID_GLSL } from './water-card';
const W = 1360, H = 740;
let art, pending, aura, mask, flake, layers, renderer;
export function loadDogCardAssets() {
  if (!pending) pending = new Promise(resolve => {
    const image = new Image();
    image.onload = () => { art = image; classify(); resolve(); };
    image.onerror = () => { pending = undefined; resolve(); };
    image.src = '/brand/dog-water-abstract-v4.webp';
  });
  return pending;
}
const clamp = v => Math.max(0, Math.min(1, v));
// Quarter-resolution classification of the artwork: glowing cyan water and cobalt enamel.
// `aura` holds the water as alpha; `mask` is the blurred red/green weight map the shader refracts by.
function classify() {
  const w = W / 4, h = Math.round(H / 4);
  const src = document.createElement('canvas'); src.width = w; src.height = h;
  const g = src.getContext('2d', { willReadFrequently: true });
  g.drawImage(art, 0, 0, w, h);
  const pixels = g.getImageData(0, 0, w, h), weights = g.createImageData(w, h);
  for (let i = 0; i < w * h; i++) {
    const r = pixels.data[i * 4], green = pixels.data[i * 4 + 1], b = pixels.data[i * 4 + 2], a = pixels.data[i * 4 + 3] / 255;
    const wet = clamp((green - 95) / 55) * clamp((b - 165) / 60) * clamp((green - r - 30) / 60) * a;
    const enamel = clamp((b - 110) / 60) * (1 - clamp((green - 90) / 40)) * a;
    weights.data.set([wet * 255, enamel * 255, 0, 255], i * 4);
    pixels.data.set([255, 255, 255, wet * 255], i * 4);
  }
  g.putImageData(pixels, 0, 0);
  aura = document.createElement('canvas'); aura.width = w; aura.height = h;
  aura.getContext('2d').drawImage(src, 0, 0);
  g.putImageData(weights, 0, 0);
  mask = document.createElement('canvas'); mask.width = W / 2; mask.height = H / 2;
  const m = mask.getContext('2d'); m.filter = 'blur(5px)'; m.drawImage(src, 0, 0, W / 2, H / 2);
}
export function dogWinnerCard(o, scale = 1) {
  const layer = () => {
    const c = document.createElement('canvas');
    c.width = Math.round(W * scale); c.height = Math.round(H * scale);
    const x = c.getContext('2d'); x.scale(scale, scale);
    return [c, x];
  };
  // Back only the text area so transparent ornament keeps its silhouette.
  const [frame, fx] = layer();
  fx.fillStyle = '#081b35'; fx.fillRect(440, 290, 650, 255);
  if (art) fx.drawImage(art, 0, 0, W, H);
  const [lettering, x] = layer();
  function text(value, y, size, color = '#eafaff', weight = 700, max = 600) {
    if (!value) return;
    x.textAlign = 'center'; x.textBaseline = 'middle';
    do {
      x.font = `${weight} ${size}px "Be Vietnam Pro", sans-serif`;
      if (x.measureText(String(value)).width <= max) break;
    } while (--size > 1);
    x.fillStyle = color; x.fillText(String(value), 790, y);
  }
  x.shadowColor = '#000'; x.shadowBlur = 8;
  text('FROST HOUND', 315, 14, '#94d9f4', 600);
  text(o.name, 376, 57, '#eafaff', 800);
  text(o.vietnameseName, 430, 25);
  const words = String(o.description || '').trim().split(/\s+/).filter(Boolean);
  let lines = [], size = 22;
  do {
    lines = []; let line = '';
    x.font = `600 ${size}px "Be Vietnam Pro", sans-serif`;
    for (const word of words) {
      const next = line ? `${line} ${word}` : word;
      if (line && x.measureText(next).width > 600) { lines.push(line); line = word; }
      else line = next;
    }
    if (line) lines.push(line);
    if (lines.length <= 2 && lines.every(line => x.measureText(line).width <= 600)) break;
  } while (--size > 1);
  lines.forEach((line, i) => text(line, 477 + (i - (lines.length - 1) / 2) * 26, size, '#d3ecfa', 600));
  text(o.info, 526, 16, '#8ac7e9', 600);
  // The static card keeps only the solid frame; the water itself is drawn live by dogForeground.
  const [canvas, cx] = layer();
  cx.drawImage(frame, 0, 0, W, H);
  if (aura) { cx.globalCompositeOperation = 'destination-out'; cx.drawImage(aura, 0, 0, W, H); cx.globalCompositeOperation = 'source-over'; }
  cx.drawImage(lettering, 0, 0, W, H);
  layers = { frame, lettering, scale };
  return { canvas, w: W, h: H };
}
const FRAG = `precision highp float;
varying vec2 vUv;
uniform sampler2D uArt,uText,uMask;
uniform float uTime;
const vec2 SIZE=vec2(${W}.,${H}.),C=vec2(690.,380.);
const vec3 V=vec3(0.,0.,1.);
${LIQUID_GLSL}
vec4 tex(sampler2D s,vec2 p){return texture2D(s,p/SIZE);}
// Water circulates around the frame along the tangent of the ellipse through p.
vec2 flow(vec2 p){vec2 d=p-C;return normalize(vec2(-d.y/6.25,d.x/38.44)+1e-4);}
// Two noise layers advected along the flow and cross-faded, so the streams run without a seam.
float height(vec2 p){
 vec2 T=flow(p)*1.7;float ph=uTime*.32,f1=fract(ph),f2=fract(ph+.5);vec2 q=p/90.;
 return mix(fbm(q-T*f1),fbm(q-T*f2+vec2(4.3,2.1)),abs(1.-2.*f1))*36.;
}
void main(){
 vec2 p=vUv*SIZE;
 vec4 m=tex(uMask,p);
 float h=height(p),e=2.;
 vec3 N=normalize(vec3(-(height(p+vec2(e,0.))-h)/e,-(height(p+vec2(0.,e))-h)/e,1.));
 vec2 off=N.xy*(m.r*30.+m.g*10.);
 // Chromatic refraction of the artwork itself; the glow's own edge ripples with it.
 vec4 col=tex(uArt,p+off);col.r=tex(uArt,p+off*.88).r;col.b=tex(uArt,p+off*1.15).b;
 vec3 c=col.rgb/max(col.a,.001);
 float lo=min(c.r,min(c.g,c.b)),hi=max(c.r,max(c.g,c.b));
 float wet=smoothstep(.37,.6,c.g)*smoothstep(.65,.88,c.b)*clamp((c.g-c.r-.12)*4.,0.,1.);
 float enamel=smoothstep(.43,.66,c.b)*(1.-smoothstep(.35,.5,c.g));
 float silver=smoothstep(.55,.78,lo)*(1.-smoothstep(.12,.26,hi-lo));
 float deep=(1.-smoothstep(.1,.28,dot(c,vec3(.3,.55,.15))))*step(c.r,c.b);
 float liquid=max(wet,enamel*.65);
 vec3 L1=normalize(vec3(-.28,-.38,1.)),L2=normalize(vec3(.45,.3,1.));
 col.rgb*=1.+liquid*clamp((dot(N,L1)-L1.z)*2.4,-.35,.4);
 // Moving caustic net, strongest in the glowing water, a faint glimmer under the text field.
 vec2 cq=p/72.+N.xy*1.4;
 float cs=pow(1.-smoothstep(0.,.16,voronoi(cq,uTime*.9)),3.)+.6*pow(1.-smoothstep(0.,.14,voronoi(cq*1.7+3.1,-uTime*.7)),3.);
 col.rgb+=cs*vec3(.55,.93,1.)*(wet*.6+enamel*.4+deep*.06)*col.a;
 // Current lines riding the flowing swell.
 float f=fract(h/36.*6.);
 col.rgb+=vec3(.75,.96,1.)*smoothstep(0.,.05,f)*smoothstep(.14,.05,f)*wet*.3*col.a;
 // Surface: hard glints and white crests on the steepest faces.
 float slope=length(N.xy),s1=max(dot(N,normalize(L1+V)),0.),s2=max(dot(N,normalize(L2+V)),0.);
 vec3 light=vec3(1.)*(pow(s1,420.)*1.6+pow(s1,60.)*.12)+vec3(.75,.92,1.)*pow(s2,220.)*.5+vec3(.82,.97,1.)*smoothstep(.22,.5,slope)*.32;
 col.rgb+=light*liquid*col.a;
 // Silver: relief picks up a slowly orbiting light and a passing sheen.
 vec3 W3=vec3(.3,.5,.2);
 vec2 gr=vec2(dot(tex(uArt,p+vec2(1.5,0.)).rgb-tex(uArt,p-vec2(1.5,0.)).rgb,W3),dot(tex(uArt,p+vec2(0.,1.5)).rgb-tex(uArt,p-vec2(0.,1.5)).rgb,W3));
 vec3 On=normalize(vec3(-gr*3.2,1.)),Lm=normalize(vec3(cos(uTime*.45)*.55,-.3+sin(uTime*.37)*.4,1.));
 float band=exp(-pow((p.x+p.y*.6-mod(uTime*380.,2900.)+300.)/70.,2.));
 col.rgb+=(pow(max(dot(On,normalize(Lm+V)),0.),80.)*.8+band*.4)*silver*col.a*vec3(.94,.98,1.);
 vec4 t=tex(uText,p);col=t+(1.-t.a)*col;
 // Frost: crystalline rime along the outer edge of the water, slowly freezing and thawing,
 // with tiny ice glints that twinkle.
 float rim=smoothstep(.02,.16,m.r)*(1.-smoothstep(.38,.7,m.r));
 float grow=smoothstep(.3,.62,fbm(p/70.+vec2(uTime*.025,-uTime*.018))+rim*.3);
 // Two scales of crystal edges read as feathery rime rather than a regular net.
 float crystal=max(1.-smoothstep(0.,.09,voronoi(p/15.+N.xy*.3,1.7)),.7*(1.-smoothstep(0.,.12,voronoi(p/6.5+4.2,.9))));
 float facet=hash(floor(p/15.+.5))*.35+.65;
 // The water itself frosts over in slowly drifting patches.
 col.rgb=mix(col.rgb,vec3(.86,.96,1.)*col.a,wet*grow*(.18+.22*crystal));
 float frost=rim*grow*(.45+crystal*.55*facet);
 float glint=pow(hash(floor(p/3.)),60.)*(.5+.5*sin(uTime*2.6+hash(floor(p/3.)+7.)*40.))*rim*grow;
 float fa=clamp(frost+glint*1.5,0.,1.);
 col=vec4(mix(vec3(.82,.94,1.),vec3(1.),crystal)*fa,fa)+(1.-fa)*col;
 col.rgb=min(col.rgb,vec3(col.a));
 gl_FragColor=col;
}`;
function createRenderer() {
  const canvas = document.createElement('canvas');
  const g = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false, preserveDrawingBuffer: true });
  if (!g) return null;
  const shader = (type, source) => {
    const s = g.createShader(type); g.shaderSource(s, source); g.compileShader(s);
    if (!g.getShaderParameter(s, g.COMPILE_STATUS)) throw new Error(g.getShaderInfoLog(s));
    return s;
  };
  const prog = g.createProgram();
  g.attachShader(prog, shader(g.VERTEX_SHADER, LIQUID_VERT)); g.attachShader(prog, shader(g.FRAGMENT_SHADER, FRAG)); g.linkProgram(prog);
  if (!g.getProgramParameter(prog, g.LINK_STATUS)) throw new Error(g.getProgramInfoLog(prog));
  g.useProgram(prog);
  g.bindBuffer(g.ARRAY_BUFFER, g.createBuffer()); g.bufferData(g.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), g.STATIC_DRAW);
  const a = g.getAttribLocation(prog, 'a'); g.enableVertexAttribArray(a); g.vertexAttribPointer(a, 2, g.FLOAT, false, 0, 0);
  g.pixelStorei(g.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
  const units = {};
  ['uArt', 'uText', 'uMask'].forEach((name, i) => {
    const t = g.createTexture(); g.activeTexture(g.TEXTURE0 + i); g.bindTexture(g.TEXTURE_2D, t);
    for (const [k, v] of [[g.TEXTURE_MIN_FILTER, g.LINEAR], [g.TEXTURE_MAG_FILTER, g.LINEAR], [g.TEXTURE_WRAP_S, g.CLAMP_TO_EDGE], [g.TEXTURE_WRAP_T, g.CLAMP_TO_EDGE]]) g.texParameteri(g.TEXTURE_2D, k, v);
    g.uniform1i(g.getUniformLocation(prog, name), i); units[name] = i;
  });
  const r = { canvas, g, units, uTime: g.getUniformLocation(prog, 'uTime'), layers: null };
  canvas.addEventListener('webglcontextlost', event => { event.preventDefault(); renderer = undefined; });
  return r;
}
function upload(r, name, source) {
  const g = r.g; g.activeTexture(g.TEXTURE0 + r.units[name]);
  g.texImage2D(g.TEXTURE_2D, 0, g.RGBA, g.RGBA, g.UNSIGNED_BYTE, source);
}
// One six-armed flake with a soft halo, drawn once and stamped for every snowflake.
function snowflake() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const x = c.getContext('2d'); x.translate(32, 32);
  const halo = x.createRadialGradient(0, 0, 0, 0, 0, 30);
  halo.addColorStop(0, '#dff6ff66'); halo.addColorStop(1, '#dff6ff00');
  x.fillStyle = halo; x.fillRect(-32, -32, 64, 64);
  x.strokeStyle = '#f4fcff'; x.lineCap = 'round';
  for (let k = 0; k < 6; k++) {
    x.save(); x.rotate(k * Math.PI / 3);
    x.lineWidth = 2.4; x.beginPath(); x.moveTo(0, 0); x.lineTo(0, -21); x.stroke();
    x.lineWidth = 1.6; x.beginPath();
    for (const [y, l] of [[-9, 6], [-15, 4.5]]) { x.moveTo(0, y); x.lineTo(-l, y - l); x.moveTo(0, y); x.lineTo(l, y - l); }
    x.stroke(); x.restore();
  }
  return c;
}
// Light snow drifting down past the card, swaying and slowly turning.
function drawSnow(x, time) {
  flake ||= snowflake();
  for (let i = 0; i < 46; i++) {
    const h1 = (i * .618034) % 1, h2 = (i * .414214 + .3) % 1, h3 = (i * .732051 + .6) % 1;
    const size = 5 + h3 * h3 * 15, fall = 14 + size * 1.6 + h2 * 10;
    const y = ((time * fall + h2 * (H + 160)) % (H + 160)) - 80;
    const px = h1 * (W + 80) - 40 + Math.sin(time * (.35 + h3 * .4) + i * 2.1) * (18 + h2 * 22);
    const fade = Math.min(1, (y + 80) / 120, (H + 80 - y) / 120);
    x.save(); x.translate(px, y); x.rotate(time * (h1 - .5) * .8 + i);
    x.globalAlpha *= fade * (.4 + h2 * .45);
    x.drawImage(flake, -size, -size, size * 2, size * 2); x.restore();
  }
}
// Draws the whole animated frame (water, frost, silver, lettering, snow) over the static base.
export function dogForeground(ctx, time, width, height) {
  if (!art || !layers) return;
  if (renderer === undefined) {
    try { renderer = createRenderer(); } catch (error) { console.warn('Dog card shader unavailable', error); renderer = null; }
  }
  ctx.save(); ctx.scale(width / W, height / H);
  if (!renderer) {
    ctx.drawImage(layers.frame, 0, 0, W, H); ctx.drawImage(layers.lettering, 0, 0, W, H);
  } else {
    const r = renderer, g = r.g, m = ctx.getTransform();
    // Render at roughly the on-screen resolution, stepped so the intro zoom rarely reallocates.
    const scale = Math.min(layers.scale, Math.max(.4, Math.ceil(Math.hypot(m.a, m.b) * 5) / 5));
    const cw = Math.round(W * scale), ch = Math.round(H * scale);
    if (r.canvas.width !== cw || r.canvas.height !== ch) { r.canvas.width = cw; r.canvas.height = ch; }
    g.viewport(0, 0, cw, ch);
    if (r.layers !== layers) { upload(r, 'uArt', layers.frame); upload(r, 'uText', layers.lettering); upload(r, 'uMask', mask); r.layers = layers; }
    g.uniform1f(r.uTime, time);
    g.clearColor(0, 0, 0, 0); g.clear(g.COLOR_BUFFER_BIT); g.drawArrays(g.TRIANGLE_STRIP, 0, 4);
    ctx.drawImage(r.canvas, 0, 0, W, H);
  }
  drawSnow(ctx, time);
  ctx.restore();
}
