// @ts-nocheck
/*
 * Draws name cards ("thiệp") on top of the tracked gold-calligraphy columns of the effect video.
 * Every column of the original video gets one card; the card unrolls as the original text is
 * written, follows the camera, and dissolves into gold dust exactly when the original text does.
 * A single winner's card returns at the end, zooming out over the moon.
 */
import { winnerCard, drawWinnerCardEffect, drawWinnerCardForeground } from './winner-card';
import { L } from './util';
import { FX, M, COLORS } from './fx';

const { rand, TAU } = L;

const TIER = {
  dog: { rgb: '149,220,255', css: '#95dcff', fx: 'blue' },
  ox: { rgb: '201,181,255', css: '#c9b5ff', fx: 'blue' },
  monkey: { rgb: '232,207,148', css: '#e8cf94', fx: 'gold' },
  rooster: { rgb: '120,197,187', css: '#78c5bb', fx: 'gold' },
  tiger: { rgb: '255,106,74', css: '#ff8a5c', fx: 'gold' },
  snake: { rgb: '112,140,255', css: '#a9b6ff', fx: 'blue' },
  dragon: { rgb: '207,230,255', css: '#cfe6ff', fx: 'blue' },
  water: { rgb: '128,232,245', css: '#80e8f5', fx: 'blue' },
  blue: { rgb: '92,192,255', css: '#7cd0ff', fx: 'blue' },
  gold: { rgb: '255,207,92', css: '#ffd76e', fx: 'gold' },
};

const FONT = {
  brush: '"Dancing Script", "Segoe Script", cursive',
  serif: '"Playfair Display", Georgia, serif',
  sans: '"Be Vietnam Pro", "Segoe UI", sans-serif',
};


function goldFill(x, y0, y1) {
  const g = x.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, '#fff8d8');
  g.addColorStop(0.45, '#ffd978');
  g.addColorStop(0.8, '#e9a53a');
  g.addColorStop(1, '#b8731c');
  return g;
}

// Vertical glowing gold calligraphy (no card) — words stacked like the original columns
// Points on the visible letters of a texture, normalised to -0.5..0.5 of its size (for dust)
function glyphPoints(canvas, max = 900) {
  const w = canvas.width, h = canvas.height;
  const d = canvas.getContext('2d').getImageData(0, 0, w, h).data;
  let filled = 0;
  for (let i = 3; i < d.length; i += 64) if (d[i] > 150) filled++;
  const step = Math.max(1, Math.sqrt((filled * 16) / max));
  const pts = [];
  for (let y = 0; y < h; y += step) {
    const iy = y | 0;
    for (let x = 0; x < w; x += step) {
      const ix = x | 0;
      if (d[(iy * w + ix) * 4 + 3] > 150) pts.push(ix / w - 0.5, iy / h - 0.5);
    }
  }
  return pts;
}

// The winner's name engraved on the glowing card the character touches (effect 2)
function engravedName(text, w, h, k) {
  const c = L.canvas(w * k, h * k), x = c.getContext('2d');
  x.scale(k, k);
  const words = text.trim().split(/\s+/).filter(Boolean);
  const n = Math.max(1, words.length);
  const top = h * 0.16, bottom = h * 0.7, innerW = w * 0.8;
  // dark ink veil so the name stays readable on the white-hot glow
  // soft ellipse that stays inside the card, so no box edge shows
  const ry = (bottom - top) * 0.62, rx = w * 0.46;
  x.save();
  x.translate(w / 2, (top + bottom) / 2);
  x.scale(rx / ry, 1);
  const veil = x.createRadialGradient(0, 0, 0, 0, 0, ry);
  veil.addColorStop(0, 'rgba(40,14,4,0.5)');
  veil.addColorStop(0.6, 'rgba(40,14,4,0.3)');
  veil.addColorStop(1, 'rgba(40,14,4,0)');
  x.fillStyle = veil;
  x.beginPath();
  x.arc(0, 0, ry, 0, Math.PI * 2);
  x.fill();
  x.restore();
  x.font = `900 100px ${FONT.serif}`;
  let fs = Math.min(...words.map((wd) => (innerW / Math.max(1, x.measureText(wd).width)) * 100), ((bottom - top) / n) * 0.78);
  fs = Math.max(10, fs);
  x.font = `900 ${fs}px ${FONT.serif}`;
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  x.lineJoin = 'round';
  const slot = (bottom - top) / n;
  words.forEach((wd, i) => {
    const cy = top + slot * (i + 0.5);
    x.lineWidth = fs * 0.12;
    x.strokeStyle = 'rgba(60,18,2,0.95)';
    x.shadowColor = 'rgba(0,0,0,0.6)';
    x.shadowBlur = fs * 0.25;
    x.strokeText(wd, w / 2, cy);
    x.shadowColor = 'rgba(255,170,60,1)';
    x.shadowBlur = fs * 0.4;
    x.fillStyle = goldFill(x, cy - fs * 0.5, cy + fs * 0.5);
    x.fillText(wd, w / 2, cy);
    x.shadowBlur = 0;
    x.fillText(wd, w / 2, cy);
  });
  return c;
}

// Lay out names in a column. Each name stays compact (its words close together, never stretched to
// fill the column); a tall column is filled with several names instead of spreading one name out.
// `pool` supplies extra names; returns how many names were taken from it.
function nameStack(first, pool, w, h, family, single) {
  const m = L.canvas(4, 4).getContext('2d');
  const innerW = w * 0.9, innerH = h * 0.94;
  const wordsOf = (t) => t.trim().split(/\s+/).filter(Boolean);
  const fit = (names) => {
    m.font = `700 100px ${family}`;
    const widest = Math.max(...names.flatMap(wordsOf).map((wd) => m.measureText(wd).width), 1);
    return Math.max(8, Math.min((innerW / widest) * 100, w * 0.62));
  };
  const blockH = (name, fs) => wordsOf(name).length * fs * 1.0;
  const names = [first];
  let fs = fit(names);
  if (!single) {
    // add names while they fit; shrink a little if needed, never below 75% of the first size
    const minFs = fs * 0.75;
    for (let guard = 0; guard < 12 && pool.length; guard++) {
      const next = pool[guard % pool.length];
      const trial = [...names, next];
      let tfs = fit(trial);
      const total = (f) => trial.reduce((acc, n) => acc + blockH(n, f), 0) + (trial.length - 1) * f * 0.85;
      if (total(tfs) > innerH) tfs = Math.min(tfs, innerH / (total(tfs) / tfs));
      if (tfs < minFs) break;
      names.push(next);
      fs = tfs;
    }
  } else {
    fs = Math.min(fs, innerH / Math.max(1, blockH(first, 1) + 0.1));
  }
  const lines = [];
  names.forEach((n, i) => {
    if (i) lines.push(null);
    wordsOf(n).forEach((wd) => lines.push(wd));
  });
  const lineH = (l) => (l === null ? fs * 0.85 : fs);
  const total = lines.reduce((acc, l) => acc + lineH(l), 0);
  return { names, lines, fs, top: (h - total) / 2, lineH };
}

function verticalGold(text, w, h, k, family, pool = [], single = false) {
  const c = L.canvas(w * k, h * k), x = c.getContext('2d');
  x.scale(k, k);
  // Transparent texture: only gold lettering and its warm glow cover the video.
  const lay = nameStack(text, pool, w, h, family, single);
  const fs = lay.fs;
  x.font = `700 ${fs}px ${family}`;
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  let y = lay.top;
  for (const wd of lay.lines) {
    const lh = lay.lineH(wd);
    if (wd !== null) {
      const cy = y + lh / 2;
      x.fillStyle = goldFill(x, cy - fs * 0.5, cy + fs * 0.5);
      x.shadowColor = 'rgba(255,150,40,1)';
      x.shadowBlur = fs * 0.45;
      x.fillText(wd, w / 2, cy);
      x.shadowBlur = fs * 0.1;
      x.shadowColor = 'rgba(255,220,140,0.9)';
      x.fillText(wd, w / 2, cy);
      x.shadowBlur = 0;
      x.fillText(wd, w / 2, cy);
    }
    y += lh;
  }
  c.used = lay.names.length - 1;
  return c;
}

export class Overlay {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.fx = new FX();
    this.cards = [];
    this.final = null;
    this.data = null;
    this.mediaT = 0; this.stamp = 0; this.playing = false; this.endedAt = 0;
    this.last = performance.now();
    this.scale = 1; this.dpr = 1;
    L.view.W = 1920; L.view.H = 1080; L.view.u = 1; L.view.dpr = 1;
    this.raf = null;
  }
  destroy() {
    cancelAnimationFrame(this.raf);
    this.detach();
  }
  resize(cssW, cssH, renderWidth = 2560) {
    // Keep tracking in its original 1920x1080 space; scale every layer together.
    renderWidth = Math.max(1, Math.round(Math.min(renderWidth, cssW * Math.min(2, window.devicePixelRatio || 1))));
    if (this.canvas.width === renderWidth && this.scale === cssW / 1920) return;
    this.dpr = renderWidth / cssW;
    this.canvas.width = renderWidth;
    this.canvas.height = Math.round(renderWidth * 9 / 16);
    this.scale = cssW / 1920;
  }

  /* ---------- video sync ---------- */
  attach(video) {
    this.detach();
    this.video = video;
    const onFrame = (now, meta) => {
      this.mediaT = meta.mediaTime; this.stamp = now;
      if (this.video === video) this.vfc = video.requestVideoFrameCallback(onFrame);
    };
    if (video.requestVideoFrameCallback) this.vfc = video.requestVideoFrameCallback(onFrame);
  }
  detach() {
    if (this.video && this.vfc && this.video.cancelVideoFrameCallback) this.video.cancelVideoFrameCallback(this.vfc);
    this.video = null;
    this.vfc = null;
    this.stamp = 0;
  }
  time() {
    const v = this.video;
    if (!v) return 0;
    if (v.ended) return (this.data ? this.data.duration : v.duration) + (performance.now() - (this.endedAt || performance.now())) / 1000;
    if (v.paused || !v.requestVideoFrameCallback || !this.stamp) return v.currentTime;
    const t = this.mediaT + ((performance.now() - this.stamp) / 1000) * v.playbackRate;
    return Math.abs(t - v.currentTime) > 0.25 ? v.currentTime : t;
  }

  clear() {
    cancelAnimationFrame(this.raf);
    this.raf = null;
    this.detach();
    this.data = null;
    this.cards = [];
    this.shots = [];
    this.final = null;
    this.fx.clear();
    this.winTex = null;
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  /* ---------- show setup ---------- */
  setup(data, plan, title, hideWinnerName = false) {
    const groupDraw = plan.winners?.length > 1;
    hideWinnerName ||= groupDraw;
    this.data = data;
    this.plan = plan;
    this.title = title;
    this.fx.clear();
    this.final = null;
    this.revealed = false;
    this.endedAt = 0;
    const k = Math.min(2, Math.max(1, this.scale * this.dpr * 1.2));
    const small = data.columns.filter((c) => c.kind !== 'brush');
    // winner hides among the candidates in one of the columns of the main shot
    const names = plan.candidates.map((p) => p.englishName || '—');
    const heroes = small.filter((c) => c.id.startsWith('B'));
    const winCol = groupDraw ? undefined : (heroes.length ? heroes[(Math.random() * heroes.length) | 0] : small[0]);
    let ni = 0;
    this.cards = data.columns.map((col) => {
      const peak = col.frames.find((f) => f[0] === col.peak) || col.frames[0];
      const g = this.geom(peak);
      const isBrush = col.kind === 'brush';
      const isTouch = col.kind === 'card';
      const isPanel = col.id.startsWith('P');
      const winnerName = plan.winner.englishName || '—';
      const cw = isTouch ? g.w : isPanel ? g.w * 0.95 : this.cardW(g.w, isBrush);
      const ch = isTouch ? g.h : this.cardH(g.h);
      const nameAt = (j) => (names.length ? names[j % names.length] : winnerName);
      let text, tex;
      if (isTouch) {
        text = winnerName;
        tex = engravedName(text, cw, ch, k);
      } else if (isBrush) {
        text = winnerName;
        tex = verticalGold(text, cw, ch, k, FONT.brush, [], true);
      } else {
        // a column holds as many compact names as fit; the winner hides in one of them
        const pool = [];
        for (let j = 1; j <= 12; j++) pool.push(nameAt(ni + j));
        if (col === winCol) pool.splice(Math.random() < 0.5 ? 0 : 1, 0, winnerName);
        text = col === winCol && Math.random() < 0.3 ? winnerName : nameAt(ni);
        if (text === winnerName) pool.splice(pool.indexOf(winnerName), 1);
        tex = verticalGold(text, cw, ch, k, FONT.brush, pool);
        ni += 1 + tex.used;
      }
      return {
        col, text, isBrush, isTouch, isPanel, f0: col.frames[0][0], cw, ch, tex,
        // "hide" mode: the last shots (brush column, touched card) carry no name at all
        hidden: hideWinnerName && (isBrush || isTouch),
        prevI: 0, peakSeen: false, dust: 0, touched: false, pts: null,
      };
    });
    this.setupShots(data, plan, hideWinnerName);
    this.winTex = groupDraw ? null : winnerCard({ name: (plan.winner.englishName || '—'), vietnameseName: plan.winner.name, info: plan.winner.department, description: plan.description, tier: plan.cardColor, title }, Math.min(2, Math.max(1, this.scale * this.dpr)));
    this.last = performance.now();
    if (this.raf === null) this.raf = requestAnimationFrame(this.loop);
  }
  /* ---------- effect 3: fireworks that burst into names ---------- */
  // Every firework of the clip (or an extra canvas rocket in empty sky) explodes into one candidate's
  // name, written only with firework sparks (no text image): the sparks fly out of the burst, settle
  // into the letters, glitter, then fall away as embers. The big final firework spells the winner,
  // whose sparks then drift down into the character's hand.
  setupShots(data, plan, hideWinnerName) {
    this.shots = [];
    const fw = data.fireworks;
    if (!fw) return;
    const W = data.width || 1920, H = data.height || 1080;
    const names = plan.candidates.map((p) => p.englishName || p.name).filter(Boolean);
    const winner = plan.winner.englishName || plan.winner.name || '—';
    // a heavy sans keeps letters legible when they are drawn only with dots of light
    const font = { family: FONT.sans, weight: 800 };
    const make = (text, o) => {
      const size = L.fitSize(text, font, o.size, o.maxW);
      const { pts, tw } = L.samplePoints(text, font, size, o.pts);
      // keep the whole name on screen
      const half = tw / 2 + size * 0.25;
      const cx = (x) => L.clamp(x * W, half + 20, W - half - 20), cy = (y) => L.clamp(y * H, size, H - size);
      // a name can drift with its firework while the camera pans ("to": where it is at time to.t)
      const to = o.to && { t: o.to.t, x: cx(o.to.x), y: cy(o.to.y) };
      return { text, pts, size, x: cx(o.x), y: cy(o.y), to };
    };
    // the haze the burning letters light around themselves: one blurred copy of the name per shot,
    // drawn once at half resolution, instead of a glow around each of its thousands of stars
    const glow = (shot, c) => {
      if (!shot.text) return null;
      const k = 0.5, fs = shot.size * k, pad = fs * 0.8;
      const m = L.canvas(1, 1).getContext('2d');
      m.font = `800 ${fs}px ${FONT.sans}`;
      const w = Math.ceil(m.measureText(shot.text).width + pad * 2), h = Math.ceil(fs * 2.1 + pad);
      const cv = L.canvas(w, h), x = cv.getContext('2d');
      x.font = m.font;
      x.textAlign = 'center';
      x.textBaseline = 'middle';
      x.filter = `blur(${(fs * 0.12).toFixed(1)}px)`;
      x.fillStyle = `rgb(${COLORS[c] || COLORS.gold})`;
      x.fillText(shot.text, w / 2, h / 2);
      return { img: cv, w: w / k, h: h / k };
    };
    fw.shots.forEach((s, i) => {
      if (!names.length) return;
      const shot = make(names[i % names.length], { x: s.x, y: s.y, to: s.to, size: s.size || 84, maxW: 640, pts: 900 });
      // "at": where the clip's own shell breaks, when the name hangs beside it rather than on top of it
      this.shots.push({ ...s, ...shot, glow: glow(shot, s.c), at: s.at && { x: s.at.x * W, y: s.at.y * H }, grp: 100 + i, hold: s.hold || 1.5 });
    });
    const w = fw.winner;
    const win = hideWinnerName ? { text: '', pts: [], x: w.x * W, y: w.y * H }
      : make(winner, { x: w.x, y: w.y, size: 140, maxW: 1200, pts: 2200 });
    this.shots.push({ ...w, ...win, glow: glow(win, 'gold'), c: w.c || 'cyan', grp: 99, hold: (w.release ?? w.t + 1.5) - w.t, isWinner: true, hand: w.hand && { x: w.hand.x * W, y: w.hand.y * H } });
  }

  // where a shot's name is at time t (it may drift with the camera)
  shotPos(s, t) {
    if (!s.to) return { x: s.x, y: s.y };
    const k = L.ease.inOutSine(L.clamp((t - s.t) / Math.max(0.01, s.to.t - s.t), 0, 1));
    return { x: L.lerp(s.x, s.to.x, k), y: L.lerp(s.y, s.to.y, k) };
  }

  fireworks(t, dt) {
    const u = L.view.u;
    // move the sparks of drifting names along with their firework
    const shift = {};
    for (const s of this.shots || []) {
      if (!s.fired || s.done) continue;
      let dx = 0, dy = 0;
      if (s.to) {
        const p = this.shotPos(s, t);
        if (s.px !== undefined) { dx = p.x - s.px; dy = p.y - s.py; }
        s.px = p.x; s.py = p.y;
      }
      // a real shaped shell never hangs still: its stars slowly droop under gravity
      const age = t - s.t - 0.3;
      if (age > 0) {
        const sag = (s.isWinner ? 5 : 11) * u * Math.min(1, age) * dt;
        s.sag = (s.sag || 0) + sag;
        dy += sag;
      }
      if (dx || dy) shift[s.grp] = [dx, dy];
    }
    for (const p of Object.keys(shift).length ? this.fx.ps : []) {
      const d = shift[p.grp];
      if (!d) continue;
      p.x += d[0]; p.y += d[1];
      if (p.tx !== undefined) { p.tx += d[0]; p.ty += d[1]; }
      // the tail moves with the name too: only a star's own motion should streak
      if (p.hx) for (let j = 0; j < p.hx.length; j += 2) { p.hx[j] += d[0]; p.hx[j + 1] += d[1]; }
    }
    for (const s of this.shots || []) {
      if (s.rocket && !s.launched && t >= s.t - s.rocket.dur) {
        s.launched = true;
        if (t - s.t < 0.2) {
          this.fx.rocket({ x0: s.rocket.x0 * (this.data.width || 1920), y0: (s.rocket.y0 ?? 1.02) * (this.data.height || 1080), tx: s.x, ty: s.y, dur: Math.max(0.15, s.t - t), seq: [s.c] });
        }
      }
      if (!s.fired && t >= s.t) {
        s.fired = true;
        // after a skip, old shots are dropped instead of all bursting at once
        if (t - s.t > 0.6) { s.done = s.dropped = true; continue; }
        const win = s.isWinner;
        // the shell itself: streaking stars thrown out over a sphere, then the stars that spell the name
        // the stars leave from the clip's own shell, so the name is born out of a real explosion
        const o = s.at || s;
        this.fx.shell(o.x, o.y, { c: s.c, c2: 'white', n: win ? 200 : 85, spd: (win ? 520 : 290) * u, glow: win ? 70 : 34, life: win ? [1.3, 2] : [1, 1.6] });
        if (win) { this.fx.flash = 0.1; this.fx.flashRGB = '170,240,255'; }
        if (s.pts.length) {
          this.fx.textBurst(o.x, o.y, s.pts, s.x, s.y, { c: win ? 'gold' : s.c, c2: 'white', grp: s.grp, size: win ? 1.35 : 1.15, mix: s.mix ?? (win ? 0.1 : 0.15),
            // snap into the letters quickly, like a shaped shell, so the name reads while it hangs;
            // the stars streak on their way out and burn unevenly once they are in place
            spd: win ? 620 : 420, seekAt: [0.1, 0.24], ks: [2.4, 3.4], trail: 3, heat: 0.12, tw: 0, glit: 0.1 });
        }
        s.sag = 0;
      }
      // while the name hangs in the sky its letters crackle and shed tiny falling sparks
      if (s.fired && !s.done && s.pts.length && t > s.t + 0.45) {
        const pos = this.shotPos(s, t), np = s.pts.length / 2;
        let n = np * (s.isWinner ? 0.05 : 0.03) * dt * 30;
        while (n > 0 && (n >= 1 || Math.random() < n)) {
          n -= 1;
          const j = ((Math.random() * np) | 0) * 2;
          const p = this.fx.spawn();
          if (!p) break;
          p.x = pos.x + s.pts[j]; p.y = pos.y + (s.sag || 0) + s.pts[j + 1];
          p.vx = rand(-25, 25) * u; p.vy = rand(-10, 40) * u; p.g = 120 * u; p.drag = 1.2;
          p.life = rand(0.35, 0.9); p.s = rand(0.6, 1.2) * u; p.c = Math.random() < 0.6 ? 'white' : s.isWinner ? 'gold' : s.c;
          p.glit = 0.35; p.trail = 3; p.ember = true;
        }
      }
      if (s.fired && !s.done && t >= s.t + s.hold) {
        s.done = true;
        if (s.isWinner && s.hand) {
          // the name's sparks drift down into the open hand with the rest of the firework
          const dx = s.hand.x - s.x, dy = s.hand.y - s.y;
          this.fx.fadeGroup(s.grp, 1.8, { vx: dx * 0.9, vy: dy * 0.9, g: 10 * u, turb: 40 });
        } else {
          // the letters break up and rain down like the embers of a real shell
          this.fx.fadeGroup(s.grp, 1.1, { vx: 0, vy: 40 * u, g: 150 * u, turb: 25 });
        }
      }
    }
  }

  // the soft glow under each hanging name: rises as the stars settle, dies quickly once they fall
  drawShotGlows(ctx, t) {
    let on = false;
    for (const s of this.shots || []) {
      if (!s.glow || !s.fired || s.dropped) continue;
      const age = t - s.t;
      const a = (s.isWinner ? 0.55 : 0.45) * L.clamp((age - 0.2) / 0.4, 0, 1) * L.clamp(1 - (age - s.hold) / 0.5, 0, 1);
      if (a <= 0.01) continue;
      if (!on) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; on = true; }
      const p = this.shotPos(s, t), g = s.glow;
      ctx.globalAlpha = a;
      ctx.drawImage(g.img, p.x - g.w / 2, p.y + (s.sag || 0) - g.h / 2, g.w, g.h);
    }
    if (on) ctx.restore();
  }

  cardW(w, brush) { return brush ? w * 1.1 + 16 : w * 1.7 + 18; }
  cardH(h) { return h * 1.05 + 14; }
  // where the winner card lands; each effect can override it (e.g. beside the character)
  cardPos() {
    const c = (this.data && this.data.card) || {};
    return { x: c.x ?? 960, y: c.y ?? 700, s: c.s ?? 1 };
  }
  geom(fr) {
    const [, x0, y0, x1, y1, x2, y2, x3, y3] = fr;
    const ux = x1 - x0, uy = y1 - y0, vx = x3 - x0, vy = y3 - y0;
    return { cx: (x0 + x2) / 2, cy: (y0 + y2) / 2, w: Math.hypot(ux, uy), h: Math.hypot(vx, vy), ang: Math.atan2(uy, ux) };
  }
  sample(card, t) {
    const fr = card.col.frames, fp = t * this.data.fps;
    const i = Math.floor(fp) - card.f0;
    if (i < 0 || i >= fr.length) return null;
    const a = fr[i], b = fr[Math.min(fr.length - 1, i + 1)], u = fp - Math.floor(fp);
    const m = a.map((v, j) => (j === 0 ? v : v + (b[j] - v) * u));
    return { g: this.geom(m), i: m[9], rev: m[10] };
  }

  /* ---------- per frame ---------- */
  loop = () => {
    this.raf = requestAnimationFrame(this.loop);
    if (document.hidden || !this.data) { this.last = performance.now(); return; }
    const now = performance.now();
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    if (this.video && this.video.ended && !this.endedAt) this.endedAt = now;
    // Keep the revealed card's timeline moving when the background video loops.
    if (this.final) this.final.elapsed += dt;
    const t = this.final ? this.final.t0 + this.final.elapsed : this.time();
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    if (!this.data) return;
    const s = this.scale * this.dpr;
    ctx.setTransform(s, 0, 0, s, 0, 0);
    for (const c of this.cards) this.drawCard(ctx, c, t);
    this.fireworks(t, dt);
    this.finale(t, dt);
    this.fx.update(dt);
    this.drawShotGlows(ctx, t);
    this.fx.draw(ctx);
    if (this.final && this.winTex) this.drawFinal(ctx, t);
    this.fx.drawFlash(ctx);
  };

  drawCard(ctx, card, t) {
    const sm = this.sample(card, t);
    if (!sm) return;
    const { g, i, rev } = sm;
    if (card.isTouch) return this.drawTouchCard(ctx, card, g, t);
    if (card.hidden) return;
    if (i >= 0.92) card.peakSeen = true;
    // after the peak the original text breaks apart quickly, so the card fades on a steeper curve
    let alpha = card.peakSeen ? L.clamp((i - 0.45) / 0.4, 0, 1) : L.clamp((i - 0.06) * 1.7, 0, 1);
    // dissolve over ~0.6s even when the source text vanishes in a couple of frames
    const fdt = card.lastT === undefined ? 0 : Math.max(0, t - card.lastT);
    card.lastT = t;
    if (card.peakSeen && fdt < 0.2) alpha = Math.max(alpha, card.prevI - fdt * 1.7);
    const cw = card.isPanel ? g.w * 0.95 : this.cardW(g.w, card.isBrush), ch = this.cardH(g.h);
    // dissolve: every drop in visibility after the peak turns into gold dust
    if (card.peakSeen && alpha < card.prevI) this.dust(card, g, cw, ch, card.prevI - alpha);
    card.prevI = alpha;
    if (alpha <= 0.01) return;
    const rv = L.clamp(rev, 0, 1);
    ctx.save();
    ctx.translate(g.cx, g.cy);
    ctx.rotate(g.ang);
    ctx.globalAlpha = alpha;
    const tex = card.tex, vis = Math.max(0.001, rv);
    ctx.drawImage(tex, 0, 0, tex.width, tex.height * vis, -cw / 2, -ch / 2, cw, ch * vis);
    // extra additive bloom so the names glow like the original light-writing
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = alpha * 0.45;
    ctx.drawImage(tex, 0, 0, tex.width, tex.height * vis, -cw / 2, -ch / 2, cw, ch * vis);
    ctx.restore();
    // brush tip / unrolling edge sparkle
    if (rv > 0.02 && rv < 0.995 && alpha > 0.2) {
      const ey = -ch / 2 + ch * rv;
      const n = card.isBrush ? 6 : 2;
      for (let k = 0; k < n; k++) {
        const ex = rand(-cw / 2, cw / 2);
        const wx = g.cx + Math.cos(g.ang) * ex - Math.sin(g.ang) * ey;
        const wy = g.cy + Math.sin(g.ang) * ex + Math.cos(g.ang) * ey;
        this.fx.add({ x: wx, y: wy, vx: rand(-30, 30), vy: rand(-20, 60), g: 90, drag: 1.5, life: rand(0.3, 0.8), s: rand(0.8, 2), c: Math.random() < 0.3 ? 'white' : 'gold' });
      }
    }
  }

  // Effect 2: the touched card carries the winner's name; it lights up when the hand touches it
  drawTouchCard(ctx, card, g, t) {
    const local = t - card.f0 / this.data.fps;
    const touch = this.data.touch ?? Infinity;
    const write = L.clamp((local - 0.15) / 0.9, 0, 1);
    if (write <= 0) return;
    const glow = t >= touch ? Math.max(0, 1 - (t - touch) / 0.9) : 0;
    if (!card.hidden) this.drawTouchName(ctx, card, g, write, glow);
    // the moment of touch: burst of light (kept in "hide" mode, only the name is left out)
    if (t >= touch && !card.touched) {
      card.touched = true;
      const tier = TIER[this.plan.cardColor] || TIER.gold;
      this.fx.flash = 0.25;
      this.fx.ring(g.cx, g.cy, tier.fx, 620, 1.1, 6);
      this.fx.burst(g.cx, g.cy, { c: tier.fx, c2: 'gold', n: 360, spd: 820, tw: 1, g: 40, life: [1.2, 2.2], s: [1.6, 3] });
    }
  }

  drawTouchName(ctx, card, g, write, glow) {
    const cw = g.w, ch = g.h;
    ctx.save();
    ctx.translate(g.cx, g.cy);
    ctx.rotate(g.ang);
    const tex = card.tex;
    ctx.drawImage(tex, 0, 0, tex.width, tex.height * write, -cw / 2, -ch / 2, cw, ch * write);
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.25 + glow * 0.75;
    ctx.drawImage(tex, 0, 0, tex.width, tex.height * write, -cw / 2, -ch / 2, cw, ch * write);
    ctx.restore();
    // writing sparkle at the reveal edge
    if (write < 1) {
      const ey = -ch / 2 + ch * (0.16 + 0.54 * write);
      for (let k = 0; k < 5; k++) {
        const ex = rand(-cw * 0.35, cw * 0.35);
        this.fx.add({ x: g.cx + Math.cos(g.ang) * ex - Math.sin(g.ang) * ey, y: g.cy + Math.sin(g.ang) * ex + Math.cos(g.ang) * ey, vx: rand(-40, 40), vy: rand(-30, 60), g: 80, drag: 1.4, life: rand(0.3, 0.8), s: rand(0.9, 2.2), c: Math.random() < 0.3 ? 'white' : 'gold' });
      }
    }
  }

  // the letters break apart into gold dust: particles start on the glyph strokes and drift up
  dust(card, g, cw, ch, drop) {
    if (!card.pts) card.pts = glyphPoints(card.tex);
    const pts = card.pts, np = pts.length / 2;
    if (!np) return;
    card.dust += drop * np * 1.4;
    const cos = Math.cos(g.ang), sin = Math.sin(g.ang);
    const size = Math.max(0.8, Math.min(2.2, Math.sqrt(cw * ch) / 160));
    while (card.dust >= 1) {
      card.dust -= 1;
      const j = ((Math.random() * np) | 0) * 2;
      const lx = pts[j] * cw + rand(-1.5, 1.5), ly = pts[j + 1] * ch + rand(-1.5, 1.5);
      this.fx.add({
        x: g.cx + cos * lx - sin * ly, y: g.cy + sin * lx + cos * ly,
        vx: rand(-15, 40), vy: rand(-60, -8), turb: rand(50, 120), drag: 0.8, g: -14,
        life: rand(1.2, 2.6), s: rand(0.6, 1.4) * size, c: Math.random() < 0.18 ? 'white' : Math.random() < 0.3 ? 'amber' : 'gold', fi: 0.05, tw: rand(4, 9),
      });
    }
  }

  finale(t, dt) {
    const d = this.data;
    // golden dust sucked into the centre during the vortex
    if (t > d.vortex - 0.4 && t < d.moon) {
      const n = Math.round(420 * dt);
      for (let k = 0; k < n; k++) {
        const a = rand(TAU), r = rand(380, 900);
        this.fx.add({ m: M.SPIRAL, x: this.cardPos().x + Math.cos(a) * r, y: this.cardPos().y - 140 + Math.sin(a) * r * 0.6, cx: this.cardPos().x, cy: this.cardPos().y - 100, pull: rand(160, 280), swirl: rand(260, 420), life: 3, s: rand(1, 2.4), c: Math.random() < 0.25 ? 'white' : 'gold' });
      }
    }
    if (t >= d.moon && !this.final) {
      const tier = TIER[this.plan.cardColor] || TIER.gold;
      this.final = { t0: t, elapsed: 0 };
      this.fx.flash = 0.75;
      this.fx.flashRGB = '255,236,200';
      const cp = this.cardPos();
      this.fx.ring(cp.x, cp.y, tier.fx, 700 * cp.s, 1.2, 6);
      this.fx.ring(cp.x, cp.y, 'white', 460 * cp.s, 0.9, 4);
      this.fx.burst(cp.x, cp.y, { c: tier.fx, c2: 'gold', n: 420, spd: 900 * cp.s, tw: 1, g: 60, life: [1.4, 2.6], s: [1.6, 3.2] });
      this.fx.willow(cp.x, cp.y, 'gold', 220);
      this.onReveal && this.onReveal();
    }
  }

  drawFinal(ctx, t) {
    const e = Math.min(1, (t - this.final.t0) / 1.25);
    const sc = 0.06 + 0.94 * L.ease.outBack(e);
    const W = this.winTex;
    const cp = this.cardPos();
    const fit = Math.min(0.86, 650 / W.h);
    const w = W.w * fit * cp.s, h = W.h * fit * cp.s;
    const fl = Math.sin(t * 1.4) * 6 * e;
    const cx = cp.x, cy = cp.y + fl;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate((1 - e) * -0.25 + (this.plan.cardColor === 'gold' && !window.matchMedia('(prefers-reduced-motion: reduce)').matches ? Math.sin(t * .65) * .007 * e : 0));
    ctx.scale(sc, sc);
    ctx.shadowColor = `rgba(${(TIER[this.plan.cardColor] || TIER.gold).rgb},0.9)`;
    ctx.shadowBlur = 60 * this.scale * this.dpr;
    ctx.globalAlpha = Math.min(1, e * 2.5);
    ctx.drawImage(W.canvas, -w / 2, -h / 2, w, h);
    ctx.shadowBlur = 0;
    ctx.save();
    ctx.translate(-w / 2, -h / 2);
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) drawWinnerCardEffect(ctx, this.plan.cardColor, t, w, h);
    drawWinnerCardForeground(ctx, this.plan.cardColor, window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : t, w, h);
    ctx.restore();
    ctx.restore();
    if (e >= 1 && Math.random() < 0.6) {
      const a = rand(TAU);
      this.fx.add({ x: cx + Math.cos(a) * w * 0.52, y: cy + Math.sin(a) * h * 0.56, vx: 0, vy: -rand(20, 60), life: rand(0.8, 1.6), s: rand(1, 2.2), c: 'gold', tw: 8 });
    }
  }
}
