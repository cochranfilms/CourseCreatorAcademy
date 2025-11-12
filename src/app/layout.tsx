import '../styles/globals.css';
import type { Metadata } from 'next';
import { SiteHeader } from '@/components/SiteHeader';
import { AuthProvider } from '@/contexts/AuthContext';

export const metadata: Metadata = {
  title: 'Creator Collective',
  description: 'The creator economy platform: content, marketplace, and opportunities.',
  icons: {
    icon: '/logo-hat.png',
  },
  openGraph: {
    title: 'Creator Collective',
    description: 'The creator economy platform: content, marketplace, and opportunities.',
    images: [
      {
        url: '/Social-Share.JPEG',
        width: 1200,
        height: 630,
        alt: 'Creator Collective',
      },
    ],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Creator Collective',
    description: 'The creator economy platform: content, marketplace, and opportunities.',
    images: ['/Social-Share.JPEG'],
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="overflow-x-hidden">
      <head>
        <link rel="preconnect" href="https://firebasestorage.googleapis.com" crossOrigin="anonymous" />
        <link rel="stylesheet" href="/mma/theme.css" />
      </head>
      <body className="cca-gradient min-h-screen w-full overflow-x-hidden">
        <AuthProvider>
          <SiteHeader />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}


