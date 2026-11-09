/**
 * Build seamless, forward-only loops of each clip's final shot (shown behind the winner card).
 * The calm tail of the clip is slowed down with motion interpolation, then its last seconds are
 * cross-faded into its first seconds, so the loop never reverses or visibly restarts.
 * Usage: node tools/build-idle-loops.cjs <ffmpeg> [effect-id]
 */
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const ffmpeg = process.argv[2] || 'ffmpeg';
const only = process.argv[3];

// start = first frame of the calm tail (30 fps clip frames), slow = playback slow-down factor
const TAILS = {
  'effect1-female': { start: 440, slow: 2.5 },
  'effect1-male': { start: 430, slow: 2 },
  'effect2-female': { start: 575, slow: 2 },
  'effect2-male': { start: 600, slow: 2 },
};
const FADE = 2; // seconds of cross-fade at the loop seam

function run(args) {
  const r = spawnSync(ffmpeg, args, { stdio: 'inherit' });
  if (r.error) throw r.error;
  if (r.status !== 0) process.exit(r.status || 1);
}
function frameCount(file) {
  const r = spawnSync(ffmpeg, ['-hide_banner', '-i', file, '-map', '0:v:0', '-c', 'copy', '-f', 'null', '-'], { encoding: 'utf8' });
  const m = [...(r.stderr || '').matchAll(/frame=\s*(\d+)/g)].pop();
  return m ? Number(m[1]) : 0;
}

for (const [id, tail] of Object.entries(TAILS).filter(([x]) => !only || x === only)) {
  const src = path.join('public/videos', `${id}-4k.mp4`);
  const frames = frameCount(src) - tail.start;
  const len = (frames / 30) * tail.slow; // seconds after slow-down
  // 1) slow the calm tail down with motion interpolation (high quality intermediate)
  const slowmo = path.join('public/videos', `${id}-slowmo.tmp.mp4`);
  run(['-hide_banner', '-loglevel', 'error', '-y', '-i', src, '-an', '-vf',
    `trim=start_frame=${tail.start},setpts=(PTS-STARTPTS)*${tail.slow},minterpolate=fps=60:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1`,
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '12', '-threads', '4', slowmo]);
  // 2) blend the end into the start frame by frame for an exact seam
  const master = path.join('public/videos', `${id}-4k-idle.mp4`);
  const py = spawnSync(process.env.PYTHON || 'python', ['-P', path.join('tools', 'loop_blend.py'), slowmo, master, ffmpeg, String(FADE)], { stdio: 'inherit' });
  if (py.error) throw py.error;
  if (py.status !== 0) process.exit(py.status || 1);
  fs.rmSync(slowmo, { force: true });
  run(['-hide_banner', '-loglevel', 'error', '-y', '-i', master, '-vf', 'scale=2560:1440:flags=lanczos,setsar=1', '-an',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '17', '-threads', '4', '-movflags', '+faststart',
    path.join('public/videos', `${id}-2k-idle.mp4`)]);
  console.log(`${id}: forward loop ${(len - FADE).toFixed(1)}s ready`);
}
