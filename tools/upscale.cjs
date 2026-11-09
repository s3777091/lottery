/** Build 4K clips directly from the cleaned Full HD masters. Usage: node tools/upscale.cjs <ffmpeg-path> */
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const ffmpeg = process.argv[2] || 'ffmpeg';
for (const id of ['effect1-female', 'effect1-male', 'effect2-female', 'effect2-male']) {
  const result = spawnSync(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y', '-i', path.join('public/videos', `${id}.mp4`), '-map', '0:v:0', '-map', '0:a?', '-vf', 'scale=3840:2160:flags=lanczos,setsar=1', '-c:v', 'libx264', '-preset', 'fast', '-crf', '18', '-pix_fmt', 'yuv420p', '-threads', '4', '-c:a', 'copy', '-movflags', '+faststart', path.join('public/videos', `${id}-4k.mp4`)], { stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
  console.log(`${id}: 4K complete`);
}
