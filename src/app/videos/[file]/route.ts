import { createReadStream, promises as fs } from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';

// The clips are ~1 GB, so they live outside the repo. Point MEDIA_DIR at the folder holding the
// effect*.mp4 files; small assets (posters) still ship from public/videos and are served before this route.
const MEDIA_DIR = process.env.MEDIA_DIR || 'D:\\jetsona\\storage\\Permission\\Data';

const TYPES: Record<string, string> = { '.mp4': 'video/mp4', '.webm': 'video/webm', '.jpg': 'image/jpeg', '.png': 'image/png' };

export async function GET(request: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  const name = path.basename(decodeURIComponent(file));
  const type = TYPES[path.extname(name).toLowerCase()];
  if (!type || name !== decodeURIComponent(file)) return new Response('Not found', { status: 404 });

  const full = path.join(/*turbopackIgnore: true*/ MEDIA_DIR, name);
  let size: number;
  try {
    size = (await fs.stat(full)).size;
  } catch {
    return new Response('Not found', { status: 404 });
  }

  const headers: Record<string, string> = {
    'Content-Type': type,
    'Accept-Ranges': 'bytes',
    'Cache-Control': process.env.NODE_ENV === 'production' ? 'private, max-age=31536000, immutable' : 'no-cache',
  };

  // Video elements seek with Range requests; answer them with 206 partial content.
  const range = /^bytes=(\d*)-(\d*)$/.exec(request.headers.get('range') || '');
  if (range && (range[1] || range[2])) {
    let start = range[1] ? Number(range[1]) : size - Number(range[2]);
    let end = range[1] && range[2] ? Number(range[2]) : size - 1;
    start = Math.max(0, start);
    end = Math.min(end, size - 1);
    if (start > end) return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } });
    const body = Readable.toWeb(createReadStream(full, { start, end })) as ReadableStream;
    return new Response(body, {
      status: 206,
      headers: { ...headers, 'Content-Range': `bytes ${start}-${end}/${size}`, 'Content-Length': String(end - start + 1) },
    });
  }

  const body = Readable.toWeb(createReadStream(full)) as ReadableStream;
  return new Response(body, { headers: { ...headers, 'Content-Length': String(size) } });
}
