import '../styles/globals.css';
import type { Metadata } from 'next';
import { SiteHeader } from '@/components/SiteHeader';
import { AuthProvider } from '@/contexts/AuthContext';

export const metadata: Metadata = {
  title: 'Course Creator Academy',
  description: 'Learn to create, launch, and sell courses — plus a creator marketplace.',
  icons: {
    icon: '/logo-hat.png',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="cca-gradient min-h-screen">
        <AuthProvider>
          <SiteHeader />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}


