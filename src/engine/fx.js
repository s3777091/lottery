// @ts-nocheck
/* Particle system: dust, fireworks, text-forming particles, vortex orbits, rockets. */
import { L } from './util';

const { rand, TAU } = L;

export const COLORS = {
  gold: '255,205,95',
  amber: '255,145,45',
  white: '255,248,228',
  red: '255,64,52',
  pink: '255,140,185',
  blue: '80,180,255',
  cyan: '90,255,230',
  purple: '190,110,255',
  green: '110,255,150',
};

// gacha "rarity" tiers → rocket colour sequence and burst palette
export const M = { FREE: 0, SEEK: 1, HOLD: 2, ORBIT: 3, SPIRAL: 4 };

let SPR = null;
function glowSprite(rgb, core = 0.12, size = 64) {
  const c = L.canvas(size, size), x = c.getContext('2d');
  const g = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(core, `rgba(${rgb},1)`);
  g.addColorStop(0.32, `rgba(${rgb},0.38)`);
  g.addColorStop(0.62, `rgba(${rgb},0.08)`);
  g.addColorStop(1, `rgba(${rgb},0)`);
  x.fillStyle = g;
  x.fillRect(0, 0, size, size);
  return c;
}
export function sprites() {
  if (!SPR) {
    SPR = {};
    for (const k in COLORS) SPR[k] = glowSprite(COLORS[k]);
    SPR.soft = glowSprite('255,190,90', 0.02, 128);
  }
  return SPR;
}

export class FX {
  constructor() {
    this.ps = [];
    this.rockets = [];
    this.rings = [];
    this.flash = 0;
    this.flashRGB = '255,236,200';
    this.t = 0;
    this.max = 18000;
    sprites();
  }
  add(o) {
    if (this.ps.length >= this.max) return null;
    const p = { x: 0, y: 0, vx: 0, vy: 0, g: 0, drag: 0, age: 0, life: 1, delay: 0, s: 2, c: 'gold', a: 1, m: 0, tw: 0, ph: Math.random() * TAU, grp: 0, turb: 0, fi: 0.08, fd: 0, end: 0 };
    Object.assign(p, o);
    this.ps.push(p);
    return p;
  }
  clear(keepGroups) {
    this.ps = keepGroups ? this.ps.filter((p) => keepGroups.includes(p.grp)) : [];
    this.rockets = [];
    this.rings = [];
    this.flash = 0;
  }
  // switch a group of particles to drift away and fade out
  fadeGroup(grp, dur = 1.2, o = {}) {
    for (const p of this.ps) {
      if (p.grp !== grp) continue;
      const la = Math.max(0, p.age - p.delay);
      if (p.m !== M.FREE) {
        p.m = M.FREE;
        p.vx = o.vx !== undefined ? o.vx + rand(-15, 15) : rand(-20, 20);
        p.vy = o.vy !== undefined ? o.vy + rand(-15, 15) : rand(-50, -10);
        p.turb = o.turb ?? 60;
        p.drag = 0.5;
        p.g = o.g ?? -8;
      }
      if (o.burst) {
        const dx = p.x - o.burst.x, dy = p.y - o.burst.y, d = Math.hypot(dx, dy) || 1;
        const sp = rand(0.5, 1) * o.burst.v;
        p.vx += (dx / d) * sp; p.vy += (dy / d) * sp;
        p.drag = 1.5;
      }
      p.life = Infinity;
      p.end = la + rand(0, dur * 0.4);
      p.fd = dur * rand(0.6, 1);
      p.grp = -1;
    }
  }
  count(grp) {
    let n = 0;
    for (const p of this.ps) if (p.grp === grp) n++;
    return n;
  }

  update(dt) {
    this.t += dt;
    const t = this.t, ps = this.ps, u = L.view.u;
    for (let i = ps.length - 1; i >= 0; i--) {
      const p = ps[i];
      p.age += dt;
      if (p.age < p.delay) continue;
      const la = p.age - p.delay;
      if (p.fd ? la > p.end + p.fd : la > p.life) {
        ps[i] = ps[ps.length - 1];
        ps.pop();
        continue;
      }
      switch (p.m) {
        case M.FREE: {
          p.vy += p.g * dt;
          if (p.turb) {
            p.vx += Math.sin(p.y * 0.012 + t * 1.6 + p.ph) * p.turb * dt;
            p.vy += Math.cos(p.x * 0.011 + t * 1.25 + p.ph) * p.turb * dt;
          }
          if (p.drag) {
            const d = Math.exp(-p.drag * dt);
            p.vx *= d; p.vy *= d;
          }
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          break;
        }
        case M.SEEK: {
          const d = Math.exp(-3.5 * dt);
          p.vx *= d; p.vy *= d;
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          if (la > p.seekAt) {
            p.k = Math.min(1, (p.k || 0) + dt * p.ks);
            const f = 1 - Math.exp(-dt * 16 * p.k * p.k);
            p.x += (p.tx - p.x) * f;
            p.y += (p.ty - p.y) * f;
            if (p.k >= 1 && Math.abs(p.tx - p.x) + Math.abs(p.ty - p.y) < 0.8) {
              p.m = M.HOLD; p.x = p.tx; p.y = p.ty;
            }
          }
          break;
        }
        case M.ORBIT: {
          const vo = p.vo;
          p.ang += ((p.av * vo.spin * 260 * u) / (p.rad + 140 * u)) * dt;
          p.rad = Math.max(0, p.rad + (p.rv + vo.pull * (p.rad * 0.002 + 0.4)) * dt * u);
          p.x = vo.cx + Math.cos(p.ang) * p.rad;
          p.y = vo.cy + Math.sin(p.ang) * p.rad * vo.tilt;
          if (p.rad < 3) { p.fd = 0.01; p.end = la; }
          break;
        }
        case M.SPIRAL: {
          const dx = p.cx - p.x, dy = p.cy - p.y, d = Math.hypot(dx, dy) || 1;
          const nx = dx / d, ny = dy / d;
          const pull = p.pull * (1 + la * 2.5);
          p.vx += (nx * pull - ny * p.swirl) * dt;
          p.vy += (ny * pull + nx * p.swirl) * dt;
          const dr = Math.exp(-2.2 * dt);
          p.vx *= dr; p.vy *= dr;
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          if (d < 6 * u) { p.fd = 0.01; p.end = la; }
          break;
        }
      }
    }

    for (let i = this.rockets.length - 1; i >= 0; i--) {
      const r = this.rockets[i];
      r.age += dt;
      const k = Math.min(1, r.age / r.dur);
      const e = L.ease.outCubic(k);
      const px = r.x, py = r.y;
      r.x = L.lerp(r.x0, r.tx, e) + Math.sin(r.age * 9) * 3 * u * (1 - k);
      r.y = L.lerp(r.y0, r.ty, e);
      // colour upgrades along the flight (gacha fake-out)
      const idx = Math.min(r.seq.length - 1, Math.floor(k * r.seq.length * 1.05));
      if (idx !== r.idx) {
        r.idx = idx;
        r.c = r.seq[idx];
        if (idx > 0) {
          this.burst(r.x, r.y, { c: r.c, n: 60, spd: 170 * u, life: [0.4, 0.8], s: [1.4, 2.4], g: 0 });
          this.ring(r.x, r.y, r.c, 70 * u, 0.5);
          r.onUpgrade && r.onUpgrade(idx, r.c);
        }
      }
      const steps = 4;
      for (let s = 0; s < steps; s++) {
        const f = s / steps;
        this.add({
          x: L.lerp(px, r.x, f) + rand(-2, 2), y: L.lerp(py, r.y, f) + rand(-2, 2),
          vx: rand(-25, 25) * u, vy: rand(10, 60) * u, drag: 2.5, g: 40 * u,
          life: rand(0.35, 0.9), s: rand(1.2, 2.6) * u, c: Math.random() < 0.3 ? 'white' : r.c,
        });
      }
      if (k >= 1) {
        this.rockets.splice(i, 1);
        r.onBurst && r.onBurst(r);
      }
    }

    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.age += dt;
      if (r.age > r.life) this.rings.splice(i, 1);
    }
    this.flash *= Math.exp(-dt * 3.2);
  }

  draw(ctx) {
    const spr = SPR, t = this.t, ps = this.ps;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < ps.length; i++) {
      const p = ps[i];
      if (p.age < p.delay) continue;
      const la = p.age - p.delay;
      let al = p.a * (la < p.fi ? la / p.fi : 1);
      if (p.fd) {
        const k = (la - p.end) / p.fd;
        if (k > 0) al *= 1 - k;
      } else if (p.life !== Infinity && p.m !== M.HOLD && p.m !== M.SEEK && p.m !== M.ORBIT) {
        const r = la / p.life;
        if (r > 0.55) al *= (1 - r) / 0.45;
      }
      if (p.tw) al *= 0.55 + 0.45 * Math.sin(t * p.tw + p.ph);
      if (al <= 0.01) continue;
      let x = p.x, y = p.y;
      if (p.m === M.HOLD) { x += Math.sin(t * 2.1 + p.ph) * 0.7; y += Math.cos(t * 1.7 + p.ph) * 0.7; }
      const s = p.s * 4;
      ctx.globalAlpha = al > 1 ? 1 : al;
      ctx.drawImage(spr[p.c], x - s / 2, y - s / 2, s, s);
    }
    for (const r of this.rockets) {
      const s = 46 * L.view.u;
      ctx.globalAlpha = 1;
      ctx.drawImage(spr[r.c], r.x - s / 2, r.y - s / 2, s, s);
      ctx.drawImage(spr.white, r.x - s / 4, r.y - s / 4, s / 2, s / 2);
    }
    for (const r of this.rings) {
      const k = r.age / r.life, e = L.ease.outCubic(k);
      ctx.globalAlpha = (1 - k) * 0.9;
      ctx.strokeStyle = `rgb(${COLORS[r.c]})`;
      ctx.lineWidth = Math.max(0.5, r.w * (1 - k));
      ctx.beginPath();
      ctx.ellipse(r.x, r.y, r.r * e, r.r * e * r.tilt, 0, 0, TAU);
      ctx.stroke();
    }
    ctx.restore();
  }
  drawFlash(ctx) {
    if (this.flash < 0.01) return;
    const { W, H } = L.view;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = Math.min(1, this.flash);
    ctx.fillStyle = `rgb(${this.flashRGB})`;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  /* ---------- emitters ---------- */
  burst(x, y, o = {}) {
    const n = o.n || 160, spd = o.spd || 300, life = o.life || [1.2, 2.1], s = o.s || [1.6, 2.8];
    for (let i = 0; i < n; i++) {
      const a = (TAU * i) / n + rand(-0.08, 0.08);
      const v = o.ring ? spd * rand(0.92, 1.05) : spd * Math.pow(Math.random(), 0.35);
      this.add({
        x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v,
        g: o.g ?? 70 * L.view.u, drag: o.drag ?? 1.3, life: rand(life[0], life[1]),
        s: rand(s[0], s[1]) * L.view.u, c: o.c2 && Math.random() < (o.mix ?? 0.3) ? o.c2 : o.c || 'gold',
        tw: o.tw ? rand(10, 22) : 0, grp: o.grp || 0,
      });
    }
  }
  willow(x, y, c = 'gold', n = 140) {
    const u = L.view.u;
    for (let i = 0; i < n; i++) {
      const a = rand(TAU), v = rand(60, 230) * u;
      this.add({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 30 * u, g: 55 * u, drag: 1.1, life: rand(2.2, 3.4), s: rand(1.2, 2.2) * u, c, tw: rand(5, 12) });
    }
  }
  ring(x, y, c, r, life = 0.9, w = 3, tilt = 1) {
    this.rings.push({ x, y, c, r, life, w: w * L.view.u, tilt, age: 0 });
  }
  rocket(o) {
    const r = Object.assign({ age: 0, idx: -1, seq: [o.c || 'gold'], dur: 1.2 }, o);
    r.x = r.x0; r.y = r.y0; r.c = r.seq[0];
    this.rockets.push(r);
    return r;
  }
  // a random festive firework somewhere in the sky
  ambient(palette) {
    const { W, H, u } = L.view;
    const x = W * rand(0.08, 0.92), ty = H * rand(0.1, 0.42);
    const c = L.pick(palette || ['red', 'gold', 'pink', 'cyan', 'green', 'purple', 'blue']);
    const c2 = Math.random() < 0.5 ? 'white' : L.pick(['gold', 'red', 'cyan']);
    const kind = Math.random();
    this.rocket({
      x0: x + rand(-60, 60) * u, y0: H * 0.92, tx: x, ty, dur: rand(0.9, 1.4), seq: [c],
      onBurst: (r) => {
        if (kind < 0.25) this.willow(r.x, r.y, 'gold', 120);
        else if (kind < 0.45) this.burst(r.x, r.y, { c, c2, n: 120, spd: 210 * u, ring: true, tw: 1 });
        else this.burst(r.x, r.y, { c, c2, n: 150, spd: 240 * u, tw: kind > 0.8 ? 1 : 0 });
      },
    });
  }
  // particles burst outward from (x, y) then gather into the given text points
  textBurst(x, y, pts, cx, cy, o = {}) {
    const u = L.view.u, sc = o.scale || 1;
    for (let i = 0; i < pts.length; i += 2) {
      const a = rand(TAU), v = rand(80, o.spd || 520) * u;
      const [s0, s1] = o.seekAt || [0.22, 0.5], [k0, k1] = o.ks || [1.1, 1.8];
      this.add({
        m: M.SEEK, x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v,
        tx: cx + pts[i] * sc, ty: cy + pts[i + 1] * sc,
        seekAt: rand(s0, s1), ks: rand(k0, k1), life: Infinity,
        s: rand(1.1, 1.9) * u * (o.size || 1), c: Math.random() < (o.mix ?? 0.22) ? o.c2 || 'white' : o.c || 'gold',
        tw: rand(2, 7), grp: o.grp || 0, delay: o.delay || 0,
      });
    }
  }
  // particles fly in from scattered positions and settle into text points
  textGather(pts, cx, cy, o = {}) {
    const { W, H, u } = L.view;
    for (let i = 0; i < pts.length; i += 2) {
      this.add({
        m: M.SEEK, x: rand(W), y: rand(H), vx: rand(-40, 40) * u, vy: rand(-40, 40) * u,
        tx: cx + pts[i], ty: cy + pts[i + 1], seekAt: rand(0, 0.3), ks: rand(0.7, 1.2), life: Infinity,
        s: rand(1.0, 1.8) * u, c: Math.random() < 0.2 ? 'white' : 'gold', tw: rand(2, 6), grp: o.grp || 0, fi: 0.5,
      });
    }
  }
}
