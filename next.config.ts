import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  typedRoutes: true,
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


