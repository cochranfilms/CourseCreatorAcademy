import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  typedRoutes: true,
  async headers() {
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://cdn.mux.com https://www.google.com https://www.gstatic.com https://apis.google.com https://connect.facebook.net https://accounts.google.com",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https://image.mux.com https://firebasestorage.googleapis.com https://*.firebasestorage.app",
      "media-src 'self' blob: https://stream.mux.com https://*.mux.com",
      "font-src 'self' data:",
      "connect-src 'self' https://api.mux.com https://stream.mux.com https://image.mux.com https://js.stripe.com https://api.stripe.com https://firebasestorage.googleapis.com https://*.firebasestorage.app https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://firestore.googleapis.com https://www.googleapis.com https://graph.facebook.com https://content-firebaseappcheck.googleapis.com",
      "frame-src https://js.stripe.com https://www.google.com https://www.gstatic.com https://accounts.google.com https://www.facebook.com https://connect.facebook.net https://www.youtube.com https://www.youtube-nocookie.com https://*.firebaseapp.com",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; ');
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Content-Security-Policy', value: csp },
          { key: 'Referrer-Policy', value: 'no-referrer' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-XSS-Protection', value: '0' },
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
          { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
        ],
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'firebasestorage.googleapis.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'course-creator-academy-866d6.firebasestorage.app',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'image.mux.com',
        pathname: '/**',
      },
    ],
    formats: ['image/avif', 'image/webp'],
    unoptimized: false,
  },
  reactStrictMode: true,
  compress: true,
  async rewrites() {
    return [
      {
        source: '/integrations/mma/:path*',
        destination: '/api/integrations/mma/:path*',
      },
    ];
  },
};

export default nextConfig;


