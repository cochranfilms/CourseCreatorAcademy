"use client";
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useEffect, useState, useRef } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db, firebaseReady } from '@/lib/firebaseClient';

const links = [
  { href: '/home', label: "What's New" },
  { href: '/learn', label: 'Learn' },
  { href: '/show', label: 'CCA Show' },
  { href: '/opportunities', label: 'Opportunities' },
  { href: '/assets', label: 'Assets' },
  { href: '/marketplace', label: 'Marketplace' },
  { href: '/discounts', label: 'Discounts' }
];

type UserProfile = {
  displayName?: string;
  handle?: string;
  photoURL?: string;
};

export function SiteHeader() {
  const pathname = usePathname();
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch user profile from Firestore
  useEffect(() => {
    if (user && firebaseReady && db) {
      const fetchProfile = async () => {
        try {
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists()) {
            const data = userDoc.data();
            setProfile({
              displayName: data.displayName || user.displayName,
              handle: data.handle,
              photoURL: data.photoURL || user.photoURL
            });
          } else {
            setProfile({
              displayName: user.displayName || user.email?.split('@')[0] || 'Creator',
              handle: undefined,
              photoURL: user.photoURL || undefined
            });
          }
        } catch (error) {
          console.error('Error fetching profile:', error);
          setProfile({
            displayName: user.displayName || user.email?.split('@')[0] || 'Creator',
            handle: undefined,
            photoURL: user.photoURL || undefined
          });
        }
      };
      fetchProfile();
    } else {
      setProfile(null);
    }
  }, [user]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };

    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showDropdown]);

  const handleLogout = async () => {
    try {
      await logout();
      router.push('/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const displayName = profile?.displayName || user?.displayName || user?.email?.split('@')[0] || 'Creator';
  const handle = profile?.handle;
  const photoURL = profile?.photoURL || user?.photoURL;

  return (
    <>
      {/* Top Menu Bar with Profile */}
      <div className="sticky top-0 z-50 bg-gradient-to-r from-neutral-950 via-neutral-900 to-neutral-950 border-b border-red-800/30 w-full overflow-x-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4 w-full">
          <Link href="/" className="flex-shrink-0">
            <Image src="/logo-hat.png" alt="Course Creator Academy" width={48} height={48} />
          </Link>

          {!loading && (
            <div className="flex items-center gap-4 flex-shrink-0">
              {user ? (
                <>
                  {/* Your Creator label */}
                  <span className="hidden md:inline text-sm text-neutral-400">Your Creator:</span>
                  
                  {/* Upgrade Button */}
                  <button className="hidden md:flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-orange-500 to-red-500 text-white hover:from-orange-600 hover:to-red-600 transition font-medium text-sm rounded-lg whitespace-nowrap">
                    Upgrade to Legacy+
                  </button>

                  {/* Icons */}
                  <div className="hidden md:flex items-center gap-3">
                    <button className="text-neutral-400 hover:text-white transition">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    </button>
                    <button className="text-neutral-400 hover:text-white transition">
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                      </svg>
                    </button>
                    <button className="text-neutral-400 hover:text-white transition">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                      </svg>
                    </button>
                    <button className="text-neutral-400 hover:text-white transition">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                    </button>
                  </div>

                  {/* Profile Image with Dropdown */}
                  <div className="relative" ref={dropdownRef}>
                    <button
                      onClick={() => setShowDropdown(!showDropdown)}
                      className="flex items-center gap-2 hover:opacity-80 transition"
                    >
                      <div className="relative w-10 h-10 rounded-full overflow-hidden bg-neutral-800 border-2 border-neutral-700 flex-shrink-0">
                        {photoURL ? (
                          <img
                            src={photoURL}
                            alt={displayName}
                            className="w-full h-full object-cover"
                            loading="lazy"
                            decoding="async"
                            sizes="40px"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                            }}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-lg font-semibold bg-ccaBlue text-white">
                            {displayName.charAt(0).toUpperCase()}
                          </div>
                        )}
                      </div>
                    </button>

                    {/* Dropdown Menu */}
                    {showDropdown && (
                      <div className="absolute right-0 mt-2 w-48 bg-neutral-900 border border-neutral-800 rounded-lg shadow-xl overflow-hidden z-50">
                        <div className="p-3 border-b border-neutral-800">
                          <div className="font-semibold text-white truncate">{displayName}</div>
                          {handle && <div className="text-sm text-neutral-400 truncate">@{handle}</div>}
                        </div>
                        <Link
                          href="/dashboard"
                          className="block px-4 py-2 text-white hover:bg-neutral-800 transition text-sm"
                          onClick={() => setShowDropdown(false)}
                        >
                          Your Profile
                        </Link>
                        <a
                          href="mailto:support@coursecreatoracademy.com"
                          className="block px-4 py-2 text-white hover:bg-neutral-800 transition text-sm"
                          onClick={() => setShowDropdown(false)}
                        >
                          Support
                        </a>
                        <button
                          onClick={() => {
                            setShowDropdown(false);
                            handleLogout();
                          }}
                          className="w-full text-left px-4 py-2 text-white hover:bg-neutral-800 transition text-sm"
                        >
                          Sign Out
                        </button>
                      </div>
                    )}
                  </div>
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

      {/* Navigation Bar Below */}
      {user && (
        <div className="sticky top-[60px] z-40 bg-gradient-to-r from-red-950 via-red-900 to-red-950 border-b border-red-800/50 w-full overflow-x-hidden">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2 flex items-center gap-2 overflow-x-auto scrollbar-hide">
            {links.map((l) => {
              const active = pathname === l.href;
              return (
                <Link
                  key={l.href}
                  href={l.href as any}
                  className={`px-4 py-2 text-sm font-medium transition-all duration-200 whitespace-nowrap flex-shrink-0 ${
                    active
                      ? 'bg-white text-black border-2 border-ccaBlue'
                      : 'bg-white text-black hover:bg-neutral-100 border-2 border-transparent'
                  }`}
                >
                  {l.label}
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
