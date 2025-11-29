"use client";
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db, firebaseReady } from '@/lib/firebaseClient';
import { SupportChat } from './SupportChat';
import { Messages } from './Messages';
import { useUnreadMessagesCount } from '@/hooks/useUnreadMessagesCount';
import { NotificationBell } from './NotificationBell';
import { Search } from './Search';
import { SavedItems } from './SavedItems';
import { LegacyUpgradeModal } from './LegacyUpgradeModal';
import { PricingModal } from './PricingModal';

const links = [
  { href: '/home', label: "What's New" },
  { href: '/learn', label: 'Learn' },
  { href: '/show', label: 'Show' },
  { href: '/opportunities', label: 'Opportunities' },
  { href: '/assets', label: 'Assets' },
  { href: '/marketplace', label: 'Marketplace' },
  { href: '/discounts', label: 'Discounts' }
];

type UserProfile = {
  displayName?: string;
  handle?: string;
  photoURL?: string;
  isLegacyCreator?: boolean;
};

export function SiteHeader() {
  const pathname = usePathname();
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const unreadCount = useUnreadMessagesCount();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showSupportChat, setShowSupportChat] = useState(false);
  const [showMessages, setShowMessages] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showSavedItems, setShowSavedItems] = useState(false);
  const [showLegacy, setShowLegacy] = useState(false);
  const [showPricing, setShowPricing] = useState(false);
  const [hasLegacySub, setHasLegacySub] = useState(false);
  const [membershipPlan, setMembershipPlan] = useState<string | null>(null);
  const [membershipActive, setMembershipActive] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const mobileMenuRef = useRef<HTMLDivElement>(null);
  const portalDropdownRef = useRef<HTMLDivElement>(null);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, right: 0 });

  // Fetch user profile from Firestore and check membership
  useEffect(() => {
    if (user && firebaseReady && db) {
      const fetchProfile = async () => {
        try {
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          let isLegacy = false;
          let base = {
            displayName: user.displayName || user.email?.split('@')[0] || 'Creator',
            handle: undefined as string | undefined,
            photoURL: user.photoURL || undefined,
          };
          if (userDoc.exists()) {
            const data = userDoc.data() as any;
            base = {
              displayName: data.displayName || base.displayName,
              handle: data.handle || base.handle,
              photoURL: data.photoURL || base.photoURL,
            };
            isLegacy = Boolean(data.isLegacyCreator || data.roles?.legacyCreator);
            // Track membership plan and status from Firestore
            setMembershipPlan(data.membershipPlan || null);
            setMembershipActive(Boolean(data.membershipActive));
          }
          // Fallback: if user doc doesn't say legacy, check legacy_creators mapping via API
          if (!isLegacy) {
            try {
              const res = await fetch(`/api/legacy/creators/${encodeURIComponent(user.uid)}?soft=1`, { cache: 'no-store' });
              const j = res.ok ? await res.json() : null;
              if (j?.creator) isLegacy = true;
            } catch {}
          }
          setProfile({ ...base, isLegacyCreator: isLegacy });

          // Also check membership via API for accuracy
          try {
            const idToken = await user.getIdToken(true);
            const membershipRes = await fetch('/api/auth/check-membership', {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${idToken}`,
              },
            });
            if (membershipRes.ok) {
              const membershipData = await membershipRes.json();
              setMembershipActive(Boolean(membershipData.hasMembership));
            }
          } catch (error) {
            // If API check fails, keep Firestore value
            console.error('Error checking membership via API:', error);
          }
        } catch (error) {
          console.error('Error fetching profile:', error);
          // Last-resort: treat as non-legacy
          setProfile({
            displayName: user.displayName || user.email?.split('@')[0] || 'Creator',
            handle: undefined,
            photoURL: user.photoURL || undefined,
            isLegacyCreator: false
          });
          setMembershipPlan(null);
          setMembershipActive(false);
        }
      };
      fetchProfile();
    } else {
      setProfile(null);
      setMembershipPlan(null);
      setMembershipActive(false);
    }
  }, [user]);

  // Detect active Legacy+ subscription for the signed-in user
  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      if (!user) { setHasLegacySub(false); return; }
      try {
        let active = false;
        try {
          const res = await fetch(`/api/legacy/subscriptions?userId=${user.uid}`, { cache: 'no-store' });
          const json = await res.json();
          if (res.ok && Array.isArray(json.subscriptions)) {
            active = json.subscriptions.length > 0;
          }
        } catch {}

        // Fallback to client query if API not available in local dev
        if (firebaseReady && db && !active) {
          try {
            const { collection, query, where, getDocs } = await import('firebase/firestore');
            const q = query(collection(db, 'legacySubscriptions'), where('userId', '==', user.uid));
            const snap = await getDocs(q);
            active = snap.docs.some(d => ['active','trialing'].includes(String((d.data() as any)?.status || '')));
          } catch {}
        }

        if (!cancelled) setHasLegacySub(active);
      } catch {
        if (!cancelled) setHasLegacySub(false);
      }
    };
    check();
    return () => { cancelled = true; };
  }, [user]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      
      // Check if click is outside dropdown portal
      if (showDropdown && portalDropdownRef.current) {
        const isClickInsideDropdown = portalDropdownRef.current.contains(target);
        const isClickOnButton = buttonRef.current?.contains(target);
        
        // Only close if click is outside both dropdown and button
        if (!isClickInsideDropdown && !isClickOnButton) {
          setShowDropdown(false);
        }
      }
      
      // Handle mobile menu
      if (mobileMenuOpen && mobileMenuRef.current && !mobileMenuRef.current.contains(target)) {
        const targetElement = target as HTMLElement;
        if (targetElement && !targetElement.closest('[data-mobile-menu-button]')) {
          setMobileMenuOpen(false);
        }
      }
    };

    if (showDropdown || mobileMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showDropdown, mobileMenuOpen]);

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileMenuOpen]);

  const handleLogout = async () => {
    try {
      await logout();
      router.push('/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  // Calculate dropdown position when opening
  useEffect(() => {
    if (showDropdown && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + 8,
        right: window.innerWidth - rect.right
      });
    }
  }, [showDropdown]);

  const displayName = profile?.displayName || user?.displayName || user?.email?.split('@')[0] || 'Creator';
  const handle = profile?.handle;
  const photoURL = profile?.photoURL || user?.photoURL;
  const isLegacyCreator = Boolean(profile?.isLegacyCreator);
  const profileHref = isLegacyCreator ? '/creator/legacy/profile' : '/dashboard';
  const profileLabel = isLegacyCreator ? 'Legacy Profile' : 'Your Profile';

  // Hide header on waitlist page
  if (pathname === '/wait') {
    return null;
  }

  return (
    <>
      {/* Top Menu Bar with Profile */}
      <div className="sticky top-0 z-[60] bg-neutral-950/90 backdrop-blur-sm border-b border-neutral-800 w-full overflow-x-hidden overflow-y-visible pt-safe">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 py-2.5 sm:py-3 flex items-center justify-between gap-2 sm:gap-4 w-full relative">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        <Link href={user ? "/home" : "/"} className="flex-shrink-0">
          <Image 
            src="/CC-Logo-White.png" 
            alt="Creator Collective" 
            width={1447} 
            height={190} 
            className="h-[21px] w-auto sm:h-[26px] object-contain" 
          />
        </Link>
          
          {/* Mobile Hamburger Menu Button */}
          {user && (
            <button
              data-mobile-menu-button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden text-white p-2.5 hover:bg-neutral-800 active:bg-neutral-700 rounded-lg transition touch-manipulation"
              aria-label="Toggle menu"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                {mobileMenuOpen ? (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                ) : (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                )}
              </svg>
            </button>
          )}
        </div>

          {!loading && (
            <div className="flex items-center gap-4 flex-shrink-0">
              {user ? (
                <>
                  {/* Your Status label */}
                  <span className="hidden lg:inline text-sm text-neutral-400">Your Status:</span>
                  
                  {/* Upgrade / Status Button */}
                  {membershipActive && membershipPlan === 'cca_membership_87' ? (
                    <span className="hidden lg:inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/20 text-blue-400 border border-blue-500/30">
                      All-Access Member
                    </span>
                  ) : hasLegacySub ? (
                    <span className="hidden lg:inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-green-500/20 text-green-400 border border-green-500/30">
                      Legacy+
                    </span>
                  ) : (
                  <button
                    type="button"
                    onClick={isLegacyCreator ? undefined : () => setShowLegacy(true)}
                    disabled={isLegacyCreator}
                    aria-disabled={isLegacyCreator}
                    className="hidden lg:flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-gradient-to-r from-orange-500 to-red-500 text-white active:from-orange-600 active:to-red-600 hover:from-orange-600 hover:to-red-600 disabled:hover:from-orange-500 disabled:hover:to-red-500 disabled:cursor-default transition font-medium text-xs sm:text-sm rounded-lg whitespace-nowrap touch-manipulation"
                  >
                    {isLegacyCreator ? 'Legacy+ Creator' : 'Upgrade to Legacy+'}
                  </button>
                  )}

                  {/* Icons - Only show for members */}
                  {membershipActive && (
                    <div className="hidden sm:flex items-center gap-2 md:gap-3">
                      <button 
                        onClick={() => setShowSearch(true)}
                        className="text-neutral-400 active:text-white hover:text-white transition p-1.5 rounded-lg hover:bg-neutral-800 touch-manipulation"
                        aria-label="Search"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                      </button>
                      <a
                        href="https://www.facebook.com/coursecreatoracademyllc"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-neutral-400 active:text-white hover:text-white transition p-1.5 rounded-lg hover:bg-neutral-800 touch-manipulation"
                        aria-label="Visit our Facebook page"
                      >
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                        </svg>
                      </a>
                      <button 
                        onClick={() => setShowSavedItems(true)}
                        className="text-neutral-400 active:text-white hover:text-white transition p-1.5 rounded-lg hover:bg-neutral-800 touch-manipulation"
                        aria-label="Saved Items"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                        </svg>
                      </button>
                      <NotificationBell />
                      <button 
                        onClick={() => setShowMessages(true)}
                        className="relative text-neutral-400 active:text-white hover:text-white transition p-1.5 rounded-lg hover:bg-neutral-800 touch-manipulation"
                        aria-label="Open messages"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                        {unreadCount > 0 && (
                          <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full h-4 w-4 sm:h-5 sm:w-5 flex items-center justify-center min-w-[16px] sm:min-w-[20px]">
                            {unreadCount > 9 ? '9+' : unreadCount}
                          </span>
                        )}
                      </button>
                    </div>
                  )}

                  {/* Profile Image with Dropdown */}
                  <div className="relative z-[100]" ref={dropdownRef}>
                    <button
                      ref={buttonRef}
                      onClick={() => setShowDropdown(!showDropdown)}
                      className="flex items-center gap-2 active:opacity-80 hover:opacity-80 transition touch-manipulation"
                    >
                      <div className="relative w-9 h-9 sm:w-10 sm:h-10 rounded-full overflow-hidden bg-neutral-800 border-2 border-neutral-700 flex-shrink-0">
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
                    {showDropdown && typeof window !== 'undefined' && createPortal(
                      <div 
                        ref={portalDropdownRef}
                        className="fixed w-48 bg-neutral-900 border border-neutral-800 rounded-lg shadow-xl overflow-hidden z-[200]"
                        style={{
                          top: `${dropdownPosition.top}px`,
                          right: `${dropdownPosition.right}px`
                        }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="p-3 border-b border-neutral-800">
                          <div className="font-semibold text-white truncate">{displayName}</div>
                          {handle && <div className="text-sm text-neutral-400 truncate">@{handle}</div>}
                          {isLegacyCreator && (
                            <div className="mt-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold text-amber-400 bg-amber-500/10 border border-amber-500/30">
                              <span role="img" aria-label="fire">🔥</span>
                              <span>Legacy Creator</span>
                            </div>
                          )}
                        </div>
                  <Link
                    href={profileHref}
                    className="block px-4 py-2 text-white hover:bg-neutral-800 transition text-sm"
                    onClick={() => setShowDropdown(false)}
                  >
                    {profileLabel}
                  </Link>
                  {isLegacyCreator && (
                    <>
                      <Link href="/creator/onboarding" className="block px-4 py-2 text-white hover:bg-neutral-800 transition text-sm" onClick={() => setShowDropdown(false)}>Stripe Payouts</Link>
                    </>
                  )}
                  <button
                          onClick={() => {
                            setShowDropdown(false);
                            setShowSupportChat(true);
                          }}
                          className="w-full text-left px-4 py-2 text-white hover:bg-neutral-800 transition text-sm"
                        >
                          Support
                        </button>
                        <button
                          onClick={() => {
                            setShowDropdown(false);
                            handleLogout();
                          }}
                          className="w-full text-left px-4 py-2 text-white hover:bg-neutral-800 transition text-sm"
                  >
                    Sign Out
                  </button>
                      </div>,
                      document.body
                    )}
                  </div>
                </>
              ) : (
                <>
                  <Link
                    href="/login"
                    className="px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium bg-neutral-900 text-white active:bg-neutral-800 hover:bg-neutral-800 border-2 border-transparent transition-all duration-200 whitespace-nowrap rounded-lg touch-manipulation"
                  >
                    Sign In
                  </Link>
                  <button
                    onClick={() => setShowPricing(true)}
                    className="px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium bg-ccaBlue text-white active:bg-ccaBlue/80 hover:bg-ccaBlue/90 border-2 border-ccaBlue transition-all duration-200 whitespace-nowrap rounded-lg touch-manipulation"
                  >
                    Join Now
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Support Chat Popup */}
      <SupportChat isOpen={showSupportChat} onClose={() => setShowSupportChat(false)} />

      {/* Messages Component */}
      {user && <Messages isOpen={showMessages} onClose={() => setShowMessages(false)} />}

      {/* Search Component */}
      <Search isOpen={showSearch} onClose={() => setShowSearch(false)} />

      {/* Saved Items Component */}
      {user && <SavedItems isOpen={showSavedItems} onClose={() => setShowSavedItems(false)} />}

      {/* Legacy Upgrade Modal */}
      {user && <LegacyUpgradeModal isOpen={showLegacy} onClose={() => setShowLegacy(false)} />}

      {/* Pricing Modal for signed-out users */}
      <PricingModal isOpen={showPricing} onClose={() => setShowPricing(false)} />

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && user && typeof window !== 'undefined' && createPortal(
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] md:hidden"
            onClick={() => setMobileMenuOpen(false)}
          />
          {/* Mobile Menu Drawer */}
          <div
            ref={mobileMenuRef}
            className="fixed top-0 right-0 h-full w-80 max-w-[85vw] bg-gradient-to-b from-neutral-950 via-neutral-900 to-neutral-950 border-l border-red-800/30 shadow-2xl z-[110] md:hidden overflow-y-auto transform transition-transform duration-300 ease-in-out pb-safe"
            style={{
              transform: mobileMenuOpen ? 'translateX(0)' : 'translateX(100%)'
            }}
          >
            <div className="flex flex-col h-full">
              {/* Mobile Menu Header */}
              <div className="flex items-center justify-between p-4 border-b border-red-800/30">
                <div className="flex items-center gap-3">
                  <div className="relative w-12 h-12 rounded-full overflow-hidden bg-neutral-800 border-2 border-neutral-700">
                    {photoURL ? (
                      <img
                        src={photoURL}
                        alt={displayName}
                        className="w-full h-full object-cover"
                        loading="lazy"
                        decoding="async"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xl font-semibold bg-ccaBlue text-white">
                        {displayName.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div>
                    <div className="font-semibold text-white">{displayName}</div>
                    {handle && <div className="text-sm text-neutral-400">@{handle}</div>}
                    {isLegacyCreator && (
                      <div className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold text-amber-400 bg-amber-500/10 border border-amber-500/30">
                        <span role="img" aria-label="fire">🔥</span>
                        <span>Legacy Creator</span>
                      </div>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-neutral-400 hover:text-white transition p-2"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Mobile Navigation Links */}
              <div className="flex-1 px-3 sm:px-4 py-4 sm:py-6 space-y-2">
                {links.map((l) => {
                  const active = pathname === l.href;
                  return (
                    <Link
                      key={l.href}
                      href={l.href as any}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`block px-4 py-3 rounded-lg font-semibold text-sm sm:text-base transition-all duration-300 touch-manipulation ${
                        active
                          ? 'bg-white text-black shadow-lg border-2 border-ccaBlue'
                          : 'bg-neutral-900/50 text-white active:bg-neutral-800 hover:bg-neutral-800 border-2 border-transparent'
                      }`}
                    >
                      {l.label}
                    </Link>
                  );
                })}
              </div>

              {/* Mobile Menu Footer */}
              <div className="p-3 sm:p-4 border-t border-red-800/30 space-y-2">
                <Link
                  href="/notifications"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full px-4 py-3 bg-neutral-900/50 text-white active:bg-neutral-800 hover:bg-neutral-800 rounded-lg transition text-left font-medium text-sm sm:text-base flex items-center gap-2 touch-manipulation"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                  Notifications
                </Link>
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    setShowMessages(true);
                  }}
                  className="w-full px-4 py-3 bg-neutral-900/50 text-white active:bg-neutral-800 hover:bg-neutral-800 rounded-lg transition text-left font-medium text-sm sm:text-base flex items-center gap-2 touch-manipulation"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  Messages
                </button>
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    setShowSavedItems(true);
                  }}
                  className="w-full px-4 py-3 bg-neutral-900/50 text-white active:bg-neutral-800 hover:bg-neutral-800 rounded-lg transition text-left font-medium text-sm sm:text-base flex items-center gap-2 touch-manipulation"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                  </svg>
                  Saved Items
                </button>
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    router.push(profileHref);
                  }}
                  className="w-full px-4 py-3 bg-neutral-900/50 text-white active:bg-neutral-800 hover:bg-neutral-800 rounded-lg transition text-left font-medium text-sm sm:text-base touch-manipulation"
                >
                  {profileLabel}
                </button>
                {isLegacyCreator && (
                  <>
                    <Link href="/creator/onboarding" onClick={() => setMobileMenuOpen(false)} className="block w-full px-4 py-3 bg-neutral-900/50 text-white active:bg-neutral-800 hover:bg-neutral-800 rounded-lg transition text-left font-medium text-sm sm:text-base touch-manipulation">Stripe Payouts</Link>
                  </>
                )}
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    if (!isLegacyCreator) setShowLegacy(true);
                  }}
                  disabled={isLegacyCreator}
                  aria-disabled={isLegacyCreator}
                  className="w-full px-4 py-3 bg-gradient-to-r from-orange-500 to-red-500 text-white active:from-orange-600 active:to-red-600 hover:from-orange-600 hover:to-red-600 rounded-lg transition font-medium text-sm sm:text-base touch-manipulation disabled:opacity-50"
                >
                  {isLegacyCreator ? 'Legacy+ Creator' : 'Upgrade to Legacy+'}
                </button>
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    setShowSupportChat(true);
                  }}
                  className="w-full px-4 py-3 bg-neutral-900/50 text-white active:bg-neutral-800 hover:bg-neutral-800 rounded-lg transition text-left font-medium text-sm sm:text-base touch-manipulation"
                >
                  Support
                </button>
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    handleLogout();
                  }}
                  className="w-full px-4 py-3 bg-neutral-900/50 text-white active:bg-neutral-800 hover:bg-neutral-800 rounded-lg transition text-left font-medium text-sm sm:text-base touch-manipulation"
                >
                  Sign Out
                </button>
              </div>
            </div>
          </div>
        </>,
        document.body
      )}

      {/* Navigation Bar Below - Desktop Only */}
      {user && membershipActive && (
        <div className="hidden md:block sticky top-[60px] z-40 bg-white/90 backdrop-blur-sm border-b border-neutral-200 w-full overflow-x-hidden">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-center gap-2 overflow-x-auto scrollbar-hide">
            {links.map((l) => {
              const active = pathname === l.href;
              return (
                <Link
                  key={l.href}
                  href={l.href as any}
                  className={`px-5 py-2.5 text-sm font-semibold transition-all duration-300 whitespace-nowrap flex-shrink-0 rounded-lg ${
                    active
                      ? 'bg-neutral-900 text-white shadow-lg border-2 border-ccaBlue transform scale-105'
                      : 'bg-transparent text-neutral-900 hover:text-neutral-700 border-2 border-transparent hover:border-neutral-300'
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
