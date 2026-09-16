import type { NextConfig } from 'next';

const demo = process.env.NEXT_PUBLIC_APP_VARIANT === 'employer-demo';
const nextConfig: NextConfig = demo ? {
  // Never inline real connection values into a demo build.
  env: { NEXT_PUBLIC_SUPABASE_URL: '', NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: '' },
  turbopack: { rules: {
    '*.{ts,tsx}': { loaders: ['./scripts/demo-branding-loader.cjs'] },
  } },
  async headers() { return [{ source: '/:path*', headers: [
    { key: 'Content-Security-Policy', value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; worker-src 'self' blob:; frame-src 'self' blob:; object-src 'self' blob:; base-uri 'self'; form-action 'self'" },
    { key: 'X-Demo-Storage', value: 'browser-local-only' },
  ] }] },
} : {};

export default nextConfig;
