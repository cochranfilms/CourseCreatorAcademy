"use client";
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

const links = [
  { href: '/home', label: "What's New" },
  { href: '/learn', label: 'Learn' },
  { href: '/show', label: 'CCA Show' },
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
    <div className="sticky top-0 z-50 backdrop-blur supports-[backdrop-filter]:bg-black/60 border-b border-neutral-900 w-full overflow-x-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4 w-full">
        <Link href="/" className="flex-shrink-0">
          <Image src="/logo-hat.png" alt="Course Creator Academy" width={48} height={48} />
        </Link>
        <div className="flex items-center gap-2 sm:gap-3 flex-1 justify-end min-w-0">
          <nav className="hidden md:flex gap-2 flex-wrap">
            {links.map((l) => {
              const active = pathname === l.href;
              return (
                <Link
                  key={l.href}
                  href={l.href as any}
                  className={`px-3 py-1.5 text-sm font-medium transition-all duration-200 whitespace-nowrap ${
                    active
                      ? 'bg-white text-black border-2 border-ccaBlue'
                      : 'bg-white text-black hover:bg-neutral-100 border-2 border-transparent'
                  }`}
                >
                  {l.label}
                </Link>
              );
            })}
          </nav>
          {!loading && (
            <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
              {user ? (
                <>
                  <Link
                    href="/dashboard"
                    className="hidden lg:inline px-3 py-1.5 text-sm font-medium text-neutral-400 hover:text-white transition-all duration-200 truncate max-w-[200px]"
                    title={user.email || undefined}
                  >
                    {user.email}
                  </Link>
                  <Link
                    href="/dashboard"
                    className="px-3 sm:px-4 py-1.5 text-sm font-medium bg-white text-black hover:bg-neutral-100 border-2 border-ccaBlue transition-all duration-200 whitespace-nowrap"
                  >
                    Dashboard
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="px-3 sm:px-4 py-1.5 text-sm font-medium bg-white text-black hover:bg-neutral-100 border-2 border-transparent transition-all duration-200 whitespace-nowrap"
                  >
                    Sign Out
                  </button>
                </>
              ) : (
                <>
                  <Link
                    href="/login"
                    className="px-3 sm:px-4 py-1.5 text-sm font-medium bg-white text-black hover:bg-neutral-100 border-2 border-transparent transition-all duration-200 whitespace-nowrap"
                  >
                    Sign In
                  </Link>
                  <Link
                    href="/signup"
                    className="px-3 sm:px-4 py-1.5 text-sm font-medium bg-white text-black hover:bg-neutral-100 border-2 border-ccaBlue transition-all duration-200 whitespace-nowrap"
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
