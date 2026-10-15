import type { NextConfig } from 'next';

const rawTarget = process.env.API_PROXY_TARGET ?? 'http://127.0.0.1:8787';
const target = new URL(rawTarget);
if (!['http:', 'https:'].includes(target.protocol) || target.username || target.password) {
  throw new Error('API_PROXY_TARGET must be an HTTP(S) backend origin without credentials.');
}

const config: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  async headers() {
    return [{ source: '/:path*', headers: [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'same-origin' },
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'Permissions-Policy', value: 'camera=(), geolocation=(), microphone=(self)' },
    ] }];
  },
};
export default config;
