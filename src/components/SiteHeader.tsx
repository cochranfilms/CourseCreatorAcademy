"use client";
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

const links = [
  { href: '/home', label: "What's New" },
  { href: '/learn', label: 'Learn' },
  { href: '/show', label: 'FTF Show' },
  { href: '/opportunities', label: 'Opportunities' },
  { href: '/assets', label: 'Assets' },
  { href: '/marketplace', label: 'Marketplace' },
  { href: '/discounts', label: 'Discounts' }
];

export function SiteHeader() {
  const pathname = usePathname();
  const { user, loading, logout } = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await logout();
      router.push('/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  return (
    <div className="sticky top-0 z-50 backdrop-blur supports-[backdrop-filter]:bg-black/60 border-b border-neutral-900">
      <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
        <Link href="/">
          <div className="flex items-center gap-3">
            <Image src="/logo-cca.png" alt="CCA" width={140} height={36} />
            <span className="hidden md:inline text-sm text-neutral-400">Course Creator Academy</span>
          </div>
        </Link>
        <div className="flex items-center gap-4">
          <nav className="hidden md:flex gap-2">
            {links.map((l) => {
              const active = pathname === l.href;
              return (
                <Link 
                  key={l.href} 
                  href={l.href as any} 
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-200 ${
                    active 
                      ? 'bg-ccaBlue text-white shadow-lg shadow-ccaBlue/30' 
                      : 'bg-neutral-900 text-neutral-300 hover:bg-neutral-800 hover:text-white hover:border hover:border-ccaBlue/30'
                  }`}
                >
                  {l.label}
                </Link>
              );
            })}
          </nav>
          {!loading && (
            <div className="flex items-center gap-3">
              {user ? (
                <>
                  <Link
                    href="/dashboard"
                    className="hidden md:inline px-3 py-1.5 rounded-full text-sm font-medium text-neutral-400 hover:text-white hover:bg-neutral-900 transition-all duration-200"
                  >
                    {user.email}
                  </Link>
                  <Link
                    href="/dashboard"
                    className="px-4 py-1.5 rounded-full text-sm font-medium bg-ccaBlue text-white hover:opacity-90 hover:shadow-lg hover:shadow-ccaBlue/30 transition-all duration-200"
                  >
                    Dashboard
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="px-4 py-1.5 rounded-full text-sm font-medium bg-neutral-900 text-neutral-300 hover:bg-neutral-800 hover:text-white hover:border hover:border-neutral-700 transition-all duration-200"
                  >
                    Sign Out
                  </button>
                </>
              ) : (
                <>
                  <Link 
                    href="/login" 
                    className="px-4 py-1.5 rounded-full text-sm font-medium bg-neutral-900 text-neutral-300 hover:bg-neutral-800 hover:text-white hover:border hover:border-ccaBlue/30 transition-all duration-200"
                  >
                    Sign In
                  </Link>
                  <Link 
                    href="/signup" 
                    className="px-4 py-1.5 rounded-full text-sm font-medium bg-ccaBlue text-white hover:opacity-90 hover:shadow-lg hover:shadow-ccaBlue/30 transition-all duration-200"
                  >
                    Sign Up
                  </Link>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


