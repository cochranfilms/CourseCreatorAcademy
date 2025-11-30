import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Join the Waitlist | Course Creator Academy - Your Creative Home Base',
  description: 'Join the waitlist for Course Creator Academy - the #1 creator platform for learning, earning, and growing. Access 800+ video courses, exclusive job opportunities, marketplace, assets, discounts, and a thriving community of 50,000+ creators. Be first to access when we launch.',
  keywords: [
    'creator academy waitlist',
    'filmmaking courses waitlist',
    'video production platform',
    'creator community waitlist',
    'online filmmaking school',
    'video editing courses',
    'cinematography training',
    'creator economy platform',
    'content creator platform',
    'filmmaker community',
    'video production courses',
    'creative education platform',
    'creator marketplace',
    'job board for creators',
    'video production training',
    'filmmaking education',
    'creator opportunities',
    'video production community',
    'content creator academy',
    'professional video training'
  ],
  openGraph: {
    title: 'Join the Waitlist | Course Creator Academy - Your Creative Home Base',
    description: 'Join the waitlist for the #1 creator platform. Access 800+ video courses, exclusive job opportunities, marketplace, assets, and a thriving community of 50,000+ creators.',
    url: 'https://coursecreatoracademy.com/wait',
    siteName: 'Course Creator Academy',
    images: [
      {
        url: '/Social-Share.JPEG',
        width: 1200,
        height: 630,
        alt: 'Course Creator Academy - Join the Waitlist',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Join the Waitlist | Course Creator Academy',
    description: 'Join the waitlist for the #1 creator platform. Access 800+ video courses, exclusive opportunities, and a thriving community.',
    images: ['/Social-Share.JPEG'],
  },
  alternates: {
    canonical: 'https://coursecreatoracademy.com/wait',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
};

export default function WaitLayout({ children }: { children: React.ReactNode }) {
  return children;
}

