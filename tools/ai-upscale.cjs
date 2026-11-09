/**
 * Rebuild the 4K / 2K show clips and their idle loops with real AI upscaling (Real-ESRGAN,
 * realesr-animevideov3-x2) instead of a plain Lanczos resize of the Full HD masters.
 * The x2 model turns each 1920x1080 frame into a native 3840x2160 frame; the 2K files are
 * downscaled from that. Frame count and timing stay identical, so the tracked name cards still line up.
 *
 * Usage: node tools/ai-upscale.cjs <ffmpeg> <realesrgan-ncnn-vulkan.exe> <work-dir> [effect-id]
 */
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const [ffmpeg, esrgan, workRoot, only] = process.argv.slice(2);
if (!ffmpeg || !esrgan || !workRoot) {
  console.error('Usage: node tools/ai-upscale.cjs <ffmpeg> <realesrgan-ncnn-vulkan.exe> <work-dir> [effect-id]');
  process.exit(1);
}

// Calm tail shown behind the winner card (same cut points as build-idle-loops.cjs / build-effect3.cjs).
// start: first tail frame (30 fps) or null = `tail` seconds before the end; slow: slow-down; fade: loop seam (s).
const CLIPS = {
  'effect1-female': { start: 440, slow: 2.5, fade: 2 },
  'effect1-male': { start: 430, slow: 2, fade: 2 },
  'effect2-female': { start: 575, slow: 2, fade: 2 },
  'effect2-male': { start: 600, slow: 2, fade: 2 },
  'effect3-female': { tail: 3.2, slow: 1.5, fade: 1 },
  'effect3-male': { tail: 3.2, slow: 1.5, fade: 1 },
};
const SIZES = [['4k', 3840, 2160], ['2k', 2560, 1440]];
const videos = (f) => path.join('public/videos', f);
const h264 = (crf) => ['-c:v', 'libx264', '-preset', 'slow', '-crf', String(crf), '-tune', 'film', '-pix_fmt', 'yuv420p', '-threads', '8'];

function run(cmd, args) {
  const r = spawnSync(cmd, args, { stdio: 'inherit' });
  if (r.error) throw r.error;
  if (r.status !== 0) process.exit(r.status || 1);
}
const ff = (args) => run(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y', ...args]);
function fresh(dir) { fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true }); return dir; }
function upscale(src, dst) {
  const t = Date.now();
  run(esrgan, ['-i', src, '-o', dst, '-n', 'realesr-animevideov3-x2', '-s', '2', '-f', 'png', '-j', '2:4:4']);
  const n = fs.readdirSync(dst).length;
  console.log(`  upscaled ${n} frames in ${((Date.now() - t) / 1000).toFixed(0)}s`);
  return n;
}

for (const [id, c] of Object.entries(CLIPS).filter(([x]) => !only || x === only)) {
  console.log(`${id}:`);
  const master = videos(`${id}.mp4`);
  const work = fresh(path.join(workRoot, id));

  // 1) main clip: every master frame -> AI x2 -> 4K + 2K, soundtrack copied from the master
  const inDir = fresh(path.join(work, 'in')), outDir = fresh(path.join(work, 'out'));
  ff(['-i', master, '-map', '0:v:0', '-fps_mode', 'passthrough', path.join(inDir, '%06d.png')]);
  const frames = upscale(inDir, outDir);
  fs.rmSync(inDir, { recursive: true, force: true });
  for (const [q, w, h] of SIZES) {
    ff(['-framerate', '30', '-i', path.join(outDir, '%06d.png'), '-i', master, '-map', '0:v', '-map', '1:a?',
      '-vf', `scale=${w}:${h}:flags=lanczos,setsar=1`, ...h264(q === '4k' ? 17 : 16), '-c:a', 'copy', '-movflags', '+faststart', videos(`${id}-${q}.mp4`)]);
  }
  fs.rmSync(outDir, { recursive: true, force: true });

  // 2) idle loop: slow the calm tail down at Full HD, AI x2 it, then cross-fade its end into its start
  const start = c.start ?? frames - Math.round(c.tail * 30);
  const tailIn = fresh(path.join(work, 'tail-in')), tailOut = fresh(path.join(work, 'tail-out'));
  ff(['-i', master, '-an', '-vf', `trim=start_frame=${start},setpts=(PTS-STARTPTS)*${c.slow},minterpolate=fps=60:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1`,
    path.join(tailIn, '%06d.png')]);
  const tailFrames = upscale(tailIn, tailOut);
  const len = tailFrames / 60;
  const loop = `[0:v]trim=start=${c.fade},setpts=PTS-STARTPTS[a];[0:v]trim=end=${c.fade},setpts=PTS-STARTPTS[b];` +
    `[a][b]xfade=transition=fade:duration=${c.fade}:offset=${(len - 2 * c.fade).toFixed(3)},format=yuv420p`;
  for (const [q, w, h] of SIZES) {
    ff(['-framerate', '60', '-i', path.join(tailOut, '%06d.png'), '-filter_complex', `${loop},scale=${w}:${h}:flags=lanczos,setsar=1`, '-an',
      ...h264(q === '4k' ? 17 : 16), '-movflags', '+faststart', videos(`${id}-${q}-idle.mp4`)]);
  }
  fs.rmSync(work, { recursive: true, force: true });
  console.log(`  ${frames} frames, loop ${(len - c.fade).toFixed(1)}s ready`);
}
