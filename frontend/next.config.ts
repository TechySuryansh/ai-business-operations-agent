import type { NextConfig } from 'next';
import path from 'node:path';
const backendUrl = (
  process.env.BACKEND_URL ??
  (process.env.BACKEND_INTERNAL_HOST
    ? `http://${process.env.BACKEND_INTERNAL_HOST}`
    : 'http://127.0.0.1:3001')
).replace(/\/$/, '');
const config: NextConfig = {
  images: { unoptimized: true },
  turbopack: { root: path.resolve(__dirname, '..') },
  outputFileTracingRoot: path.resolve(__dirname, '..'),
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${backendUrl}/api/:path*` }];
  },
};
export default config;
