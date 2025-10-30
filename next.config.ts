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
    ],
    formats: ['image/avif', 'image/webp'],
    unoptimized: false,
  },
  reactStrictMode: true,
  compress: true,
};

export default nextConfig;


