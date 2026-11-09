'use client';

import { useEffect, useRef } from 'react';
import { winnerCard, loadWinnerCardAssets, drawWinnerCardEffect, drawWinnerCardForeground, CARD_STYLES } from '@/engine/winner-card';
import { loadCanvasFonts } from '@/engine/fonts';
import type { Tier } from '@/lib/types';

// All previews share one animation loop, and only those near the viewport are drawn in it.
const visible = new Set<(now: number) => void>();
let loop = 0;
function tick(now: number) {
  visible.forEach(draw => draw(now));
  loop = visible.size ? requestAnimationFrame(tick) : 0;
}
function show(draw: (now: number) => void) {
  visible.add(draw);
  if (!loop) loop = requestAnimationFrame(tick);
}

export default function CardPreview({ name, tier, description }: { name: string; tier: Tier; description?: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const style = CARD_STYLES[tier] || CARD_STYLES.gold;
  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    let active = true, card: ReturnType<typeof winnerCard> | null = null, scale = 0, onScreen = false;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const ctx = el.getContext('2d');
    const draw = (now: number) => {
      if (!card || !ctx) return;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, el.width, el.height);
      // Card-space drawing, scaled down to the preview's on-screen pixels.
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      const seconds = motion.matches ? 0 : now / 1000;
      if(tier==='gold'&&!motion.matches){
        ctx.translate(card.w/2,card.h/2);
        ctx.rotate(Math.sin(seconds*.65)*.007);
        ctx.scale(.98,.98);
        ctx.translate(-card.w/2,-card.h/2+Math.sin(seconds*1.1)*3);
      }
      ctx.drawImage(card.canvas, 0, 0, card.w, card.h);
      if (!motion.matches) drawWinnerCardEffect(ctx, tier, now / 1000, card.w, card.h);
      drawWinnerCardForeground(ctx, tier, seconds, card.w, card.h);
    };
    const update = () => {
      if (!active || !card) return;
      if (onScreen && !motion.matches) show(draw);
      else { visible.delete(draw); draw(performance.now()); }
    };
    // Rebuild the static card at the resolution the preview is displayed at.
    const make = (k: number) => winnerCard({ name: 'Ekko Huynh', vietnameseName: 'Huỳnh Đắc Tấn Đạt', description, info: 'AI', tier }, k);
    let width = 0;
    const build = () => {
      if (!active) return;
      if (!width) width = make(1).w;
      const next = Math.min(1, Math.ceil(el.getBoundingClientRect().width * devicePixelRatio) / width) || 1;
      if (card && next === scale) return;
      scale = next;
      card = make(scale);
      el.width = Math.round(card.w * scale);
      el.height = Math.round(card.h * scale);
      draw(motion.matches ? 0 : performance.now());
      update();
    };
    const seen = new IntersectionObserver(([entry]) => { onScreen = entry.isIntersecting; update(); }, { rootMargin: '0px' });
    let resizeTimer = 0;
    const resized = new ResizeObserver(() => { clearTimeout(resizeTimer); resizeTimer = window.setTimeout(build, 150); });
    motion.addEventListener('change', update);
    Promise.all([loadCanvasFonts(), loadWinnerCardAssets()]).then(() => { build(); seen.observe(el); resized.observe(el); });
    return () => {
      active = false; visible.delete(draw); clearTimeout(resizeTimer);
      seen.disconnect(); resized.disconnect(); motion.removeEventListener('change', update);
    };
  }, [name, tier, description]);
  return <figure className={`award-preview award-preview-${tier}`}><figcaption>{style.label}<span>{style.edition} / {style.rarity}</span></figcaption><canvas ref={canvas} className="card-preview" role="img" aria-label={`Xem trước thẻ ${name}`} /></figure>;
}
