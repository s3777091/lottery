/**
 * Cut the fireworks finale of the source film into effect 3 (female + male), remove the corner
 * watermarks, and build every file the show needs: Full HD master, 4K and 2K clips, plus a seamless 4K/2K loop of the calm tail.
 * Usage: node tools/build-effect3.cjs <ffmpeg> <FirstVide.mp4> [effect-id]
 */
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const ffmpeg = process.argv[2] || 'ffmpeg';
const source = process.argv[3];
const only = process.argv[4];
if (!source) { console.error('Usage: node tools/build-effect3.cjs <ffmpeg> <FirstVide.mp4> [effect-id]'); process.exit(1); }

// Scene cuts of the source film (30 fps): 2413 → 3148 → 3892 frames.
const CLIPS = {
  'effect3-female': { start: 2413 / 30, frames: 3148 - 2413, tail: 3.2, slow: 1.5 },
  'effect3-male': { start: 3148 / 30, frames: 3892 - 3148, tail: 3.2, slow: 1.5 },
};
const FADE = 1; // seconds of cross-fade at the loop seam
// corner watermarks of the source film (same boxes as tools/erase.py): top-left figure, bottom-left ID
const DELOGO = 'delogo=x=4:y=2:w=76:h=108,delogo=x=4:y=1038:w=114:h=38';
const out = (f) => path.join('public/videos', f);

function run(args) {
  const r = spawnSync(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y', ...args], { stdio: 'inherit' });
  if (r.error) throw r.error;
  if (r.status !== 0) process.exit(r.status || 1);
}
const h264 = (crf) => ['-c:v', 'libx264', '-preset', 'medium', '-crf', String(crf), '-pix_fmt', 'yuv420p', '-threads', '4'];

for (const [id, c] of Object.entries(CLIPS).filter(([x]) => !only || x === only)) {
  const dur = c.frames / 30;
  // 1) Full HD master, frame-exact cut with its soundtrack
  run(['-ss', c.start.toFixed(4), '-i', source, '-t', dur.toFixed(4), '-map', '0:v:0', '-map', '0:a?', '-vf', DELOGO, ...h264(16),
    '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', out(`${id}.mp4`)]);
  // 2) 4K and 2K show clips
  for (const [q, w, h, crf] of [['4k', 3840, 2160, 18], ['2k', 2560, 1440, 18]]) {
    run(['-i', out(`${id}.mp4`), '-map', '0:v:0', '-map', '0:a?', '-vf', `scale=${w}:${h}:flags=lanczos,setsar=1`, ...h264(crf),
      '-c:a', 'copy', '-movflags', '+faststart', out(`${id}-${q}.mp4`)]);
  }
  // 3) forward-only loop of the calm tail: slow it down, then cross-fade its end into its start
  const tail = out(`${id}-tail.tmp.mp4`);
  run(['-ss', (dur - c.tail).toFixed(3), '-i', out(`${id}.mp4`), '-an', '-vf',
    `setpts=(PTS-STARTPTS)*${c.slow},minterpolate=fps=60:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1`, ...h264(12), tail]);
  const len = c.tail * c.slow;
  const loopFilter = `[0:v]trim=start=${FADE},setpts=PTS-STARTPTS[a];[0:v]trim=end=${FADE},setpts=PTS-STARTPTS[b];` +
    `[a][b]xfade=transition=fade:duration=${FADE}:offset=${(len - 2 * FADE).toFixed(3)},format=yuv420p`;
  for (const [q, w, h, crf] of [['4k', 3840, 2160, 17], ['2k', 2560, 1440, 17]]) {
    run(['-i', tail, '-filter_complex', `${loopFilter},scale=${w}:${h}:flags=lanczos,setsar=1`, '-an', ...h264(crf),
      '-movflags', '+faststart', out(`${id}-${q}-idle.mp4`)]);
  }
  fs.rmSync(tail, { force: true });
  console.log(`${id}: clip ${dur.toFixed(2)}s, loop ${(len - FADE).toFixed(1)}s ready`);
}
