import '../styles/globals.css';
import type { Metadata } from 'next';
import { SiteHeader } from '@/components/SiteHeader';

export const metadata: Metadata = {
  title: 'Course Creator Academy',
  description: 'Learn to create, launch, and sell courses — plus a creator marketplace.'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="cca-gradient min-h-screen">
        <SiteHeader />
        {children}
      </body>
    </html>
  );
}


