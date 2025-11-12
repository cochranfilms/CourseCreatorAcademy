import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Course Creator Academy',
  description: 'Course Creator Academy — premium courses for filmmakers and creators.',
  openGraph: {
    title: 'Course Creator Academy',
    description: 'Premium courses for filmmakers and creators.',
    images: [{ url: '/Social-Share.JPEG', width: 1200, height: 630, alt: 'Course Creator Academy' }],
    type: 'website'
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Course Creator Academy',
    description: 'Premium courses for filmmakers and creators.',
    images: ['/Social-Share.JPEG']
  }
};

export default function LearnLayout({ children }: { children: React.ReactNode }) {
  return children as any;
}


