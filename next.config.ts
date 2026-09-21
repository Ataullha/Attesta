import type { NextConfig } from 'next';

const isDev = process.env.NODE_ENV !== 'production';
const ads = !!process.env.NEXT_PUBLIC_ADSENSE_CLIENT;
const adHosts = ads
  ? ' https://pagead2.googlesyndication.com https://*.googlesyndication.com https://*.doubleclick.net https://*.google.com https://*.gstatic.com https://*.adtrafficquality.google'
  : '';

// Next.js needs inline scripts for hydration; everything else is locked to this origin.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}${adHosts}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob:${adHosts}`,
  "font-src 'self' data:",
  `connect-src 'self'${adHosts}`,
  `frame-src 'self'${adHosts}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...((process.env.APP_URL ?? '').startsWith('https://') ? ['upgrade-insecure-requests'] : []),
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  serverExternalPackages: ['sharp'],
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default nextConfig;
