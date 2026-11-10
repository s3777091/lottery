import { PHASE_DEVELOPMENT_SERVER } from 'next/constants.js';

// Every URL under these folders is versioned: /videos and /effects carry ?v=ASSET_V (lottery page),
// and /brand and /fonts files get a new file name when their art changes. Production can therefore
// let browsers keep them for a year without revalidating; dev keeps the default so edits show at once.
const IMMUTABLE = 'public, max-age=31536000, immutable';
// /videos and /effects need a signed-in user, so only the browser (never a shared cache) may keep them.
const IMMUTABLE_PRIVATE = 'private, max-age=31536000, immutable';

// Browser-side protection for every page and API response. Everything the app loads comes from its own
// origin; Next.js injects inline bootstrap scripts, hence 'unsafe-inline' for scripts (no eval allowed).
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "media-src 'self' blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

const SECURITY_HEADERS = [
  { key: 'Content-Security-Policy', value: CSP },
  { key: 'Strict-Transport-Security', value: 'max-age=31536000' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'same-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
  { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
];

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
      return [
        { source: '/:path*', headers: SECURITY_HEADERS },
        ...['brand', 'fonts'].map((dir) => ({ source: `/${dir}/:path*`, headers: [{ key: 'Cache-Control', value: IMMUTABLE }] })),
        ...['videos', 'effects'].map((dir) => ({ source: `/${dir}/:path*`, headers: [{ key: 'Cache-Control', value: IMMUTABLE_PRIVATE }] })),
      ];
    },
  };
}
