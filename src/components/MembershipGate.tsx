"use client";
import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

// Pages that don't require membership
const PUBLIC_PAGES = [
  '/home',
  '/signup',
  '/login',
  '/forgot-password',
  '/wait',
  '/',
];

// Pages that are public but user-specific (profile pages, creator-kits)
const PUBLIC_USER_PAGES = [
  '/profile',
  '/creator-kits',
];

export function MembershipGate({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [membershipLoading, setMembershipLoading] = useState(true);
  const [hasMembership, setHasMembership] = useState<boolean | null>(null);

  useEffect(() => {
    const checkMembership = async () => {
      // Allow public pages
      if (PUBLIC_PAGES.includes(pathname)) {
        setHasMembership(true); // Allow access
        setMembershipLoading(false);
        return;
      }

      // Allow public user pages (profile, creator-kits)
      if (PUBLIC_USER_PAGES.some(prefix => pathname.startsWith(prefix))) {
        setHasMembership(true);
        setMembershipLoading(false);
        return;
      }

      // If not logged in, redirect to login
      if (!user) {
        router.push('/login');
        return;
      }

      // Check membership status
      try {
        const idToken = await user.getIdToken(true);
        const response = await fetch('/api/auth/check-membership', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${idToken}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          const membership = Boolean(data.hasMembership);
          setHasMembership(membership);

          // If no membership and not on allowed pages, redirect to home
          if (!membership && !PUBLIC_PAGES.includes(pathname) && !PUBLIC_USER_PAGES.some(prefix => pathname.startsWith(prefix))) {
            router.push('/home');
          }
        } else {
          // On error, allow access (fail open)
          setHasMembership(true);
        }
      } catch (error) {
        console.error('Error checking membership:', error);
        // On error, allow access (fail open)
        setHasMembership(true);
      } finally {
        setMembershipLoading(false);
      }
    };

    if (!authLoading) {
      checkMembership();
    }
  }, [user, authLoading, pathname, router]);

  // Show loading state
  if (authLoading || membershipLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-neutral-950 to-black">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-ccaBlue mb-4"></div>
          <p className="text-neutral-400">Loading...</p>
        </div>
      </div>
    );
  }

  // If no membership and trying to access protected page, show nothing (redirecting)
  if (hasMembership === false && !PUBLIC_PAGES.includes(pathname) && !PUBLIC_USER_PAGES.some(prefix => pathname.startsWith(prefix))) {
    return null;
  }

  return <>{children}</>;
}

