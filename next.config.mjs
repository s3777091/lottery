import { PHASE_DEVELOPMENT_SERVER } from 'next/constants.js';

// Every URL under these folders is versioned: /videos and /effects carry ?v=ASSET_V (lottery page),
// and /brand and /fonts files get a new file name when their art changes. Production can therefore
// let browsers keep them for a year without revalidating; dev keeps the default so edits show at once.
const IMMUTABLE = 'public, max-age=31536000, immutable';

/** @type {(phase: string) => import('next').NextConfig} */
export default function config(phase) {
  return {
    reactStrictMode: false,
    poweredByHeader: false,
    async redirects() {
      return [{ source: '/loterry', destination: '/lottery', permanent: false }];
    },
    async headers() {
      if (phase === PHASE_DEVELOPMENT_SERVER) return [];
      return ['videos', 'effects', 'brand', 'fonts'].map((dir) => ({
        source: `/${dir}/:path*`,
        headers: [{ key: 'Cache-Control', value: IMMUTABLE }],
      }));
    },
  };
}
