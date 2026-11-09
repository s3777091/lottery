'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowRightIcon, GearIcon, SpeakerLoudIcon, SpeakerOffIcon, EnterFullScreenIcon, ExitFullScreenIcon } from '@radix-ui/react-icons';
import type { DrawPlan, EffectId, ShowState, VideoQuality, Winner } from '@/lib/types';
import { EFFECT_IDS, SINGLE_DRAW_CHOICES, plannedEffect, plannedWinnerCount } from '@/lib/types';
import { loadWinnerCardAssets } from '@/engine/winner-card';
import { loadCanvasFonts } from '@/engine/fonts';

type Phase = 'idle' | 'loading' | 'playing' | 'result';
type Pick = EffectId | 'random' | null;
type EffectData = { id: EffectId; video: string; vortex: number; moon: number; duration: number; fps: number; columns: unknown[] };
type OverlayApi = {
  resize(w: number, h: number, renderWidth?: number): void;
  setup(d: EffectData, p: DrawPlan, title: string, hideWinnerName?: boolean): void;
  attach(v: HTMLVideoElement): void;
  clear(): void;
  destroy(): void;
  onReveal?: () => void;
};

// Part of every /videos and /effects URL, which production serves as immutable: bump it whenever a clip,
// idle loop, poster or tracking file is re-rendered, or projectors keep playing the cached copy.
const ASSET_V = '12';

export default function LotteryPage() {
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRefs = useRef<Record<string, HTMLVideoElement | null>>({});
  const idleVideoRef = useRef<HTMLVideoElement>(null);
  const overlay = useRef<OverlayApi | null>(null);
  const effects = useRef<Record<string, EffectData>>({});
  const refreshPending = useRef<Promise<ShowState | null> | null>(null);
  const lastCmd = useRef<string | null | undefined>(undefined);
  const phaseRef = useRef<Phase>('idle');
  const absentPending = useRef(false);

  const [show, setShow] = useState<ShowState | null>(null);
  const [phase, setPhaseState] = useState<Phase>('idle');
  const [plan, setPlan] = useState<DrawPlan | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [effectFailed, setEffectFailed] = useState(false);
  const [absentIds, setAbsentIds] = useState<string[]>([]);
  const [markingAbsent, setMarkingAbsent] = useState(false);
  const [idleLoopPlaying, setIdleLoopPlaying] = useState(false);
  const [active, setActive] = useState<EffectId>('effect1-female');
  const [toast, setToast] = useState('');
  const [muted, setMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  useEffect(() => {
    const sync = () => setIsFullscreen(Boolean(document.fullscreenElement));
    sync();
    document.addEventListener('fullscreenchange', sync);
    return () => document.removeEventListener('fullscreenchange', sync);
  }, []);
  const [videoQuality, setVideoQuality] = useState<VideoQuality>('2k');
  const qualityRef = useRef<VideoQuality>('2k');
  useEffect(() => {
    if (phase !== 'idle' || !show) return;
    qualityRef.current = show.settings.videoQuality || '2k';
    setVideoQuality(qualityRef.current);
  }, [show, phase]);
  useEffect(() => { window.dispatchEvent(new Event('resize')); }, [videoQuality]);

  /* ---------- effect for the next draw ---------- */
  // Optimistic copy of settings.nextEffect while the PUT is in flight; spin() waits for it.
  const [pendingPick, setPendingPick] = useState<{ value: Pick } | null>(null);
  const pickSaving = useRef<Promise<unknown> | null>(null);
  const liveSettings = show ? { ...show.settings, nextEffect: pendingPick ? pendingPick.value : show.settings.nextEffect ?? null } : null;
  const nextPlan = liveSettings && show ? plannedEffect(liveSettings, show.drawCount) : null;
  const nextCount = show ? Math.min(plannedWinnerCount(show.settings, show.drawCount), show.eligible) : 0;

  const setPhase = (p: Phase) => { phaseRef.current = p; setPhaseState(p); };
  const flash = (m: string) => { setToast(m); window.setTimeout(() => setToast(''), 3200); };
  const reveal = useCallback(() => { setRevealed(true); setPhase('result'); }, []);
  const revealWithoutEffect = useCallback(() => {
    overlay.current?.clear();
    setEffectFailed(true);
    reveal();
  }, [reveal]);

  /* ---------- engine + layout ---------- */
  useEffect(() => {
    let alive = true;
    const fit = () => {
      const el = stageRef.current;
      if (!el) return;
      const vw = window.innerWidth, vh = window.innerHeight;
      const w = Math.min(vw, (vh * 16) / 9), h = (w * 9) / 16;
      el.style.width = `${w}px`;
      el.style.height = `${h}px`;
      overlay.current?.resize(w, h, qualityRef.current === '4k' ? 3840 : 2560);
    };
    import('@/engine/overlay').then(({ Overlay }) => {
      if (!alive || !canvasRef.current) return;
      overlay.current = new Overlay(canvasRef.current) as OverlayApi;
      fit();
    });
    fit();
    // Warm shared artwork and fonts while idle, before a winner is selected.
    Promise.all([loadCanvasFonts(), loadWinnerCardAssets()]).catch(() => {});
    window.addEventListener('resize', fit);
    EFFECT_IDS.forEach((id) =>
      fetch(`/effects/${id}.json?v=${ASSET_V}`).then((r) => r.json()).then((d) => { if (d.id === id) effects.current[id] = d; }).catch(() => {}),
    );
    return () => {
      alive = false;
      window.removeEventListener('resize', fit);
      overlay.current?.destroy();
    };
  }, []);

  /* ---------- state polling + remote commands ---------- */
  const refresh = useCallback(() => {
    if (refreshPending.current) return refreshPending.current;
    refreshPending.current = (async () => {
      try {
        const r = await fetch('/api/state?view=show', { cache: 'no-cache' });
        if (!r.ok) return null;
        const s = await r.json() as ShowState;
        setShow((previous) => previous?.version === s.version && previous.drawCount === s.drawCount ? previous : s);
        return s;
      } catch {
        return null;
      } finally {
        refreshPending.current = null;
      }
    })();
    return refreshPending.current;
  }, []);

  const choose = useCallback((value: Pick) => {
    if (phaseRef.current !== 'idle') return;
    setPendingPick({ value });
    const req: Promise<void> = fetch('/api/state', { method: 'PUT', cache: 'no-store', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ settings: { nextEffect: value } }) })
      .then(async (r) => { if (!r.ok) throw new Error(); await refresh(); })
      .catch(() => flash('Không lưu được hiệu ứng, thử lại.'))
      .finally(() => { if (pickSaving.current === req) { pickSaving.current = null; setPendingPick(null); } });
    pickSaving.current = req;
  }, [refresh]);

  // While idle, point the preloading video at the effect the next draw will use.
  const nextConcrete = phase === 'idle' && nextPlan && nextPlan.effect !== 'random' ? nextPlan.effect : null;
  useEffect(() => { if (nextConcrete) setActive(nextConcrete); }, [nextConcrete]);

  const spin = useCallback(async () => {
    if (phaseRef.current !== 'idle') return;
    setPhase('loading');
    if (pickSaving.current) await pickSaving.current;
    let p: DrawPlan;
    try {
      const res = await fetch('/api/draw', { method: 'POST' });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Không quay được.');
      p = body;
    } catch (error) {
      flash((error as Error).message || 'Không quay được.');
      setPhase('idle');
      return;
    }
    setActive(p.effect);
    setPlan(p);
    void refresh();
    try {
      const engine = overlay.current;
      const video = videoRefs.current[p.effect];
      if (!engine || !video) throw new Error('Effect unavailable');
      let data = effects.current[p.effect];
      if (!data) {
        const response = await fetch(`/effects/${p.effect}.json?v=${ASSET_V}`);
        if (!response.ok) throw new Error('Effect unavailable');
        data = effects.current[p.effect] = await response.json();
      }
      await loadCanvasFonts();
      if (p.winners.length === 1) await loadWinnerCardAssets();
      engine.setup(data, p, show?.settings.title || '', Boolean(show?.settings.hideWinnerName));
      engine.attach(video);
      engine.onReveal = p.winners.length === 1 ? reveal : undefined;
      video.currentTime = 0;
      video.muted = muted;
      try {
        await video.play();
      } catch {
        video.muted = true;
        setMuted(true);
        await video.play();
      }
      setPhase('playing');
    } catch {
      revealWithoutEffect();
    }
  }, [show, muted, refresh, reveal, revealWithoutEffect]);

  const next = useCallback(() => {
    if (absentPending.current) return;
    if (phaseRef.current !== 'result' && phaseRef.current !== 'playing') return;
    if (phaseRef.current === 'playing' && !revealed) return;
    Object.values(videoRefs.current).forEach((v) => v?.pause());
    idleVideoRef.current?.pause();
    setIdleLoopPlaying(false);
    overlay.current?.clear();
    setPlan(null);
    setRevealed(false);
    setEffectFailed(false);
    setAbsentIds([]);
    setPhase('idle');
    refresh();
  }, [revealed, refresh]);

  const commandHandlers = useRef({ spin, next });
  useEffect(() => { commandHandlers.current = { spin, next }; }, [spin, next]);
  useEffect(() => {
    let stopped = false;
    let timer: number;
    const poll = async () => {
      const s = await refresh();
      if (stopped) return;
      if (s) {
        const cmd = s.command;
        if (lastCmd.current === undefined) lastCmd.current = cmd?.id ?? null;
        else if (cmd && cmd.id !== lastCmd.current) {
          lastCmd.current = cmd.id;
          if (cmd.type === 'spin') commandHandlers.current.spin();
          if (cmd.type === 'continue') commandHandlers.current.next();
        }
      }
      timer = window.setTimeout(poll, document.hidden ? 5000 : 1500);
    };
    poll();
    return () => { stopped = true; window.clearTimeout(timer); };
  }, [refresh]);

  const skip = useCallback(() => {
    if (phaseRef.current !== 'playing' || !plan) return;
    const d = effects.current[plan.effect];
    const v = videoRefs.current[plan.effect];
    if (v && d && v.currentTime < d.vortex - 0.6) v.currentTime = d.vortex - 0.6;
  }, [plan]);

  const absent = async (winner: Winner) => {
    if (!plan || phaseRef.current !== 'result' || absentPending.current || absentIds.includes(winner.drawId)) return;
    absentPending.current = true;
    setMarkingAbsent(true);
    try {
      const response = await fetch('/api/action', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'absent', drawId: winner.drawId }) });
      if (!response.ok) throw new Error('Unable to mark winner absent');
    } catch {
      flash('Không lưu được trạng thái vắng mặt. Vui lòng thử lại.');
      return;
    } finally {
      absentPending.current = false;
      setMarkingAbsent(false);
    }
    setAbsentIds((ids) => [...ids, winner.drawId]);
    if (plan.winners.length === 1) {
      flash(`${winner.name} vắng mặt, hãy quay người tiếp theo.`);
      next();
    } else {
      void refresh();
    }
  };

  const fullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else document.documentElement.requestFullscreen().catch(() => {});
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (e.code === 'Space' || e.code === 'Enter') {
        if (e.target instanceof HTMLElement && e.target.closest('button, a, .batch-winner-list')) return;
        e.preventDefault();
        if (phaseRef.current === 'idle') spin();
        else next();
      } else if (e.key === 's' || e.key === 'S') skip();
      else if (/^[0-7]$/.test(e.key) && phaseRef.current === 'idle') choose(e.key === '0' ? null : SINGLE_DRAW_CHOICES[Number(e.key) - 1]);
      else if (e.key === 'f' || e.key === 'F') fullscreen();
      else if (e.key === 'm' || e.key === 'M') setMuted((m) => !m);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [spin, next, skip, choose]);

  useEffect(() => {
    Object.values(videoRefs.current).forEach((v) => { if (v) v.muted = muted; });
  }, [muted]);

  const groupDraw = Boolean(plan && plan.winners.length > 1);
  const showWinnerList = groupDraw || effectFailed;
  return (
    <div className={`show phase-${phase}${revealed ? ' revealed' : ''}`}>
      <div className="stage" ref={stageRef}>
        {EFFECT_IDS.map((id) => (
          <video
            key={id}
            ref={(el) => { videoRefs.current[id] = el; }}
            className={`fx-video${active === id && phase !== 'idle' ? ' on' : ''}`}
            src={`/videos/${id}-${videoQuality}.mp4?v=${ASSET_V}`}
            preload={active === id ? 'auto' : 'metadata'}
            playsInline
            onError={() => {
              if (phaseRef.current === 'playing' && active === id) revealWithoutEffect();
            }}
            onEnded={() => {
              if (active !== id) return;
              if (groupDraw && phaseRef.current === 'playing') reveal();
              if (phaseRef.current !== 'result') return;
              const idleVideo = idleVideoRef.current;
              if (!idleVideo) return;
              idleVideo.currentTime = 0;
              void idleVideo.play().catch(() => {});
            }}
          />
        ))}
        <video
          ref={idleVideoRef}
          className={`fx-video idle-loop${idleLoopPlaying && phase !== 'idle' ? ' on' : ''}`}
          src={`/videos/${active}-${videoQuality}-idle.mp4?v=${ASSET_V}`}
          preload="auto"
          playsInline
          muted
          loop
          onPlaying={() => {
            if (phaseRef.current === 'result') setIdleLoopPlaying(true);
            else idleVideoRef.current?.pause();
          }}
        />
        <canvas ref={canvasRef} className="fx-canvas" />

        <div className="idle-screen" style={{ backgroundImage: `url(/videos/effect1-female.jpg?v=${ASSET_V})` }}>
          <div className="idle-veil" />
          <div className="idle-title">
            <h1>{show?.settings.title ?? 'YEAR END PARTY 2026'}</h1>
            <p>{show?.settings.subtitle ?? 'Tất niên · Đón Xuân Đinh Mùi 2027'}</p>
          </div>
          <div className="dock">
            <button className="spin" disabled={!show?.eligible || phase !== 'idle'} onClick={() => spin()}>
              <span>{phase === 'loading' ? '...' : 'QUAY'}</span>
              {nextCount > 1 && <small>{nextCount} người</small>}
            </button>
          </div>
        </div>

        {plan && revealed && !showWinnerList && (
          <div className="result-bar">
            <button className="btn gold" disabled={markingAbsent} onClick={next}>Quay tiếp</button>
            <button className="btn gold" disabled={markingAbsent} onClick={() => absent(plan.winners[0])}>Vắng mặt</button>
          </div>
        )}
      </div>

      {plan && revealed && showWinnerList && (
        <section className="batch-result" aria-labelledby="batch-result-title">
          <header className="batch-result-header">
            <div>
              <p className="batch-result-eyebrow">Kết quả lượt quay</p>
              <h2 id="batch-result-title">Chúc mừng người trúng giải!</h2>
              {!groupDraw && plan.description && <p className="batch-prize" title={plan.description}>{plan.description}</p>}
            </div>
            <span className="batch-result-count">{plan.winners.length} người</span>
          </header>

          <ol className={`batch-winner-list${plan.winners.length > 6 ? ' batch-winner-list-wide' : ''}`} role="list" tabIndex={0} aria-label="Danh sách người trúng">
            {plan.winners.map((winner, index) => {
              const isAbsent = absentIds.includes(winner.drawId);
              const details = [winner.englishName, winner.department].filter(Boolean).join(' · ');
              return <li key={winner.drawId}>
                <span className="batch-winner-number" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
                <div className="batch-winner-identity">
                  <strong>{winner.name}</strong>
                  {details && <small>{details}</small>}
                </div>
                {isAbsent ? <span className="batch-winner-absent">Đã báo vắng</span> :
                  <button type="button" className="btn ghost small batch-winner-action" aria-label={`Báo vắng ${winner.name}`} disabled={markingAbsent} onClick={() => absent(winner)}>Vắng mặt</button>}
              </li>;
            })}
          </ol>

          <footer className="batch-result-footer">
            <span className="batch-result-status" aria-live="polite">{absentIds.length > 0 && `${absentIds.length} người đã báo vắng`}</span>
            <button type="button" className="btn gold" disabled={markingAbsent} onClick={next}>
              Quay tiếp <ArrowRightIcon aria-hidden="true" />
            </button>
          </footer>
        </section>
      )}

      <div className="show-controls" role="group" aria-label="Điều khiển màn chiếu">
        <button type="button" className="show-admin-link" onClick={() => setMuted((m) => !m)} aria-label={muted ? 'Bật loa' : 'Tắt loa'} title={muted ? 'Bật loa (M)' : 'Tắt loa (M)'} aria-pressed={muted}>
          {muted ? <SpeakerOffIcon width={23} height={23} aria-hidden="true" /> : <SpeakerLoudIcon width={23} height={23} aria-hidden="true" />}
        </button>
        <button type="button" className="show-admin-link" onClick={fullscreen} aria-label={isFullscreen ? 'Thoát toàn màn hình' : 'Toàn màn hình'} title={isFullscreen ? 'Thoát toàn màn hình (F)' : 'Toàn màn hình (F)'} aria-pressed={isFullscreen}>
          {isFullscreen ? <ExitFullScreenIcon width={23} height={23} aria-hidden="true" /> : <EnterFullScreenIcon width={23} height={23} aria-hidden="true" />}
        </button>
        <Link href="/admin" className="show-admin-link" aria-label="Quay về Admin" title="Quay về Admin">
          <GearIcon width={23} height={23} aria-hidden="true" />
        </Link>
      </div>
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
