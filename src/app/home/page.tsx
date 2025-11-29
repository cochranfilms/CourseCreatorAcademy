"use client";
import { useEffect, useState, Suspense, useMemo, useCallback, startTransition } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';
import Image from 'next/image';
import dynamic from 'next/dynamic';
import { doc, getDoc, collection, getDocs, query, orderBy, limit, getDocFromCache, getDocsFromCache } from 'firebase/firestore';
import { db, firebaseReady } from '@/lib/firebaseClient';
import { auth } from '@/lib/firebaseClient';
import { signInWithCustomToken, fetchSignInMethodsForEmail, sendPasswordResetEmail, signInWithEmailAndPassword } from 'firebase/auth';
import { useSearchParams, useRouter } from 'next/navigation';
import { getMuxAnimatedGifUrl } from '@/lib/muxThumbnails';

// Lazy load MuxPlayer - only load when needed
const MuxPlayer = dynamic(() => import('@mux/mux-player-react').then(mod => mod.default), {
  ssr: false,
  loading: () => <div className="w-full aspect-video bg-neutral-800 animate-pulse" />
});

type UserProfile = {
  displayName?: string;
  photoURL?: string;
  memberSince?: string;
  memberTag?: string;
};

type Video = {
  id: string;
  title: string;
  thumbnail: string;
  duration: string;
  overlay?: string;
  courseSlug?: string;
  courseId?: string;
  moduleId?: string;
  lessonId?: string;
  muxPlaybackId?: string;
  muxAnimatedGifUrl?: string;
};

type Product = {
  id: string;
  title: string;
  image: string;
  price?: number;
  condition?: string;
  images?: string[];
};

type Discount = {
  id: string;
  title: string;
  description: string;
  partnerName: string;
  partnerLogoUrl?: string;
  discountCode?: string;
  discountLink?: string;
  discountType: 'code' | 'link' | 'both';
  discountAmount?: string;
};

type LegacyCreator = {
  id: string;
  displayName: string;
  handle: string;
  avatarUrl?: string;
  bannerUrl?: string;
  kitSlug: string;
};

type Asset = {
  id: string;
  title: string;
  category?: string;
  thumbnailUrl?: string;
  description?: string;
};

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function formatMemberSince(date: Date | null) {
  if (!date) return '2025';
  return date.getFullYear().toString();
}

function ClaimFromSessionId() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user } = useAuth();
  useEffect(() => {
    const sessionId = searchParams?.get('session_id');
    if (!sessionId || !firebaseReady || !auth) return;
    if (user) return; // already signed in
    let cancelled = false;
    const run = async () => {
      try {
        // Check if we have stored credentials from signup (password was set during signup)
        const signupEmail = typeof window !== 'undefined' ? sessionStorage.getItem('signup_email') : null;
        const signupPassword = typeof window !== 'undefined' ? sessionStorage.getItem('signup_password') : null;
        
        if (signupEmail && signupPassword) {
          // Sign in with email/password (account was created with password during signup)
          try {
            await signInWithEmailAndPassword(auth, signupEmail, signupPassword);
            // Clear stored credentials
            sessionStorage.removeItem('signup_email');
            sessionStorage.removeItem('signup_password');
            sessionStorage.removeItem('signup_userId');
            sessionStorage.removeItem('signup_checkout_flow');
            router.replace('/home');
            return;
          } catch (signInError: any) {
            // Fall through to custom token method if password sign-in fails
          }
        }
        
        // Also clear checkout flow flag if present
        if (typeof window !== 'undefined') {
          sessionStorage.removeItem('signup_checkout_flow');
        }
        
        // Fallback: use custom token method (for OAuth accounts or legacy flow)
        const res = await fetch(`/api/auth/claim?session_id=${encodeURIComponent(sessionId)}`, { method: 'GET' });
        const json = await res.json();
        if (json?.token && !cancelled) {
          await signInWithCustomToken(auth, json.token);
          router.replace('/home');
        }
      } catch {}
    };
    run();
    return () => { cancelled = true; };
  }, [searchParams, user]);
  return null;
}

export default function HomePage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [userMemberSince, setUserMemberSince] = useState<Date | null>(null);
  const [needsPassword, setNeedsPassword] = useState(false);
  const [passwordEmailSent, setPasswordEmailSent] = useState(false);
  const [recentlyAdded, setRecentlyAdded] = useState<Video[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [garrettKing, setGarrettKing] = useState<LegacyCreator | null>(null);
  const [dataLoading, setDataLoading] = useState(true);
  const [hasMembership, setHasMembership] = useState<boolean | null>(null);
  const [membershipLoading, setMembershipLoading] = useState(true);
  const [showEpisode, setShowEpisode] = useState<{
    title: string;
    description?: string;
    playbackId: string | null;
    thumbnailUrl?: string;
    guest?: string;
    handle?: string;
  } | null>(null);
  const [featuredAsset, setFeaturedAsset] = useState<Asset | null>(null);
  const [walkthrough, setWalkthrough] = useState<{
    title: string;
    description?: string;
    playbackId: string | null;
    thumbnailUrl?: string;
  } | null>(null);
  const [showWalkthroughVideo, setShowWalkthroughVideo] = useState(false);

  // Post-checkout auto sign-in via custom token handled in Suspense-wrapped child

  // Check membership status
  useEffect(() => {
    const checkMembership = async () => {
      if (!user) {
        setHasMembership(false);
        setMembershipLoading(false);
        return;
      }

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
          setHasMembership(Boolean(data.hasMembership));
        } else {
          setHasMembership(null); // Couldn't verify
        }
      } catch (error) {
        setHasMembership(null);
      } finally {
        setMembershipLoading(false);
      }
    };

    if (user && !loading) {
      checkMembership();
    } else if (!user && !loading) {
      setHasMembership(false);
      setMembershipLoading(false);
    }
  }, [user, loading]);

  useEffect(() => {
    if (user && firebaseReady && db) {
      // Helper to check if password sign-in is enabled for this account
      const checkPasswordMethod = async () => {
        try {
          // Fast path: if providerData already includes password provider, no prompt
          if (user?.providerData?.some((p) => p?.providerId === 'password')) {
            setNeedsPassword(false);
            return;
          }
          if (auth && user.email) {
            const methods = await fetchSignInMethodsForEmail(auth, user.email);
            setNeedsPassword(!methods.includes('password'));
          }
        } catch {}
      };

      // Initial check and also whenever tab regains focus/visibility
      checkPasswordMethod();
      const onFocus = () => { checkPasswordMethod(); };
      const onVisibility = () => { if (!document.hidden) checkPasswordMethod(); };
      window.addEventListener('focus', onFocus);
      document.addEventListener('visibilitychange', onVisibility);

      // Get member since date from Firebase Auth metadata
      const creationTime = user.metadata.creationTime ? new Date(user.metadata.creationTime) : null;
      if (creationTime) {
        setUserMemberSince(creationTime);
      }

      // Try to fetch additional profile data from Firestore
      const fetchProfile = async () => {
        try {
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists()) {
            const data = userDoc.data() as any;
            setUserProfile({
              displayName: data.displayName || user.displayName,
              photoURL: (data.photoURL || user.photoURL) || undefined,
              memberSince: data.memberSince || formatMemberSince(creationTime),
              memberTag: data.memberTag || 'Member'
            });
          } else {
            // Use Firebase Auth data
            setUserProfile({
              displayName: user.displayName || user.email?.split('@')[0] || 'Creator',
              photoURL: user.photoURL || undefined,
              memberSince: formatMemberSince(creationTime),
              memberTag: 'Member'
            });
          }
        } catch (error) {
          // Fallback to Firebase Auth data
          setUserProfile({
            displayName: user.displayName || user.email?.split('@')[0] || 'Creator',
            photoURL: user.photoURL || undefined,
            memberSince: formatMemberSince(creationTime),
            memberTag: 'Member'
          });
        }
      };

      fetchProfile();

      return () => {
        window.removeEventListener('focus', onFocus);
        document.removeEventListener('visibilitychange', onVisibility);
      };
    } else {
      // Reset profile when user logs out
      setUserProfile(null);
      setUserMemberSince(null);
    }
  }, [user]);

  // Helper function for cache-first reads
  const getDocCacheFirst = useCallback(async (docRef: ReturnType<typeof doc>) => {
    try {
      return await getDocFromCache(docRef);
    } catch (cacheError) {
      // Cache miss or error - fall back to network
      return await getDoc(docRef);
    }
  }, []);

  const getDocsCacheFirst = useCallback(async (queryRef: ReturnType<typeof query>) => {
    try {
      return await getDocsFromCache(queryRef);
    } catch (cacheError: any) {
      // Cache miss or error - fall back to network
      return await getDocs(queryRef);
    }
  }, []);

  // Fetch data from Firestore - optimized for instant cache-first loading
  useEffect(() => {
    const fetchData = async () => {
      if (!firebaseReady || !db) {
        setDataLoading(false);
        return;
      }

      try {
        // Fetch critical data first (cache-first strategy)
        // Use API route for recent lessons (server-side aggregation is much faster)
        // Get auth token for API requests
        const idToken = user && auth.currentUser 
          ? await auth.currentUser.getIdToken().catch(() => null)
          : null;

        const [
          recentLessonsResponse,
          listingsResponse,
          configDoc,
          walkthroughConfigDoc,
          creatorsResponse,
          discountsData,
          assetsResponse
        ] = await Promise.allSettled([
          // Use API route for lessons - server-side aggregation avoids nested queries
          fetch('/api/home/recent-lessons').then(r => r.ok ? r.json() : null).catch(() => null),
          // Fetch marketplace listings via API (if authenticated)
          idToken
            ? fetch('/api/home/listings?limit=3', {
                headers: { Authorization: `Bearer ${idToken}` },
                }).then(async (r) => {
                if (r.ok) {
                  return r.json();
                } else {
                  return { listings: [] };
                }
              }).catch(() => {
                return { listings: [] };
              })
            : Promise.resolve({ listings: [] }),
          // Fetch show config (cache-first)
          db ? getDocCacheFirst(doc(db, 'config', 'show')) : Promise.resolve(null),
          // Fetch walkthrough config (cache-first)
          db ? getDocCacheFirst(doc(db, 'config', 'walkthrough')) : Promise.resolve(null),
          // Fetch legacy creators
          fetch('/api/legacy/creators').then(r => r.ok ? r.json() : null).catch(() => null),
          // Fetch discounts (if user authenticated)
          idToken
            ? fetch('/api/discounts', {
                headers: { Authorization: `Bearer ${idToken}` },
              }).then(async (r) => {
                if (r.ok) {
                  return r.json();
                } else {
                  return { discounts: [] };
                }
              }).catch(() => {
                return { discounts: [] };
              })
            : Promise.resolve({ discounts: [] }),
          // Fetch assets via API (if authenticated)
          idToken
            ? fetch('/api/home/assets', {
                headers: { Authorization: `Bearer ${idToken}` },
              }).then(async (r) => {
                if (r.ok) {
                  return r.json();
                } else {
                  return { asset: null };
                }
              }).catch(() => {
                return { asset: null };
              })
            : Promise.resolve({ asset: null })
        ]);

        // Process recent lessons from API (instant - no nested queries!)
        // Mark as loaded early for progressive rendering
        if (recentLessonsResponse.status === 'fulfilled' && recentLessonsResponse.value?.lessons) {
          startTransition(() => {
            setRecentlyAdded(recentLessonsResponse.value.lessons);
          });
        }

        // Process marketplace listings (progressive rendering)
        if (listingsResponse.status === 'fulfilled' && listingsResponse.value) {
          const listingsData = listingsResponse.value.listings || [];
          startTransition(() => {
            setProducts(listingsData);
          });
        }

        // Process discounts (progressive rendering)
        if (discountsData.status === 'fulfilled' && discountsData.value) {
          const discountList = discountsData.value.discounts || [];
          startTransition(() => {
            setDiscounts(discountList.slice(0, 3));
          });
        }

        // Process Garrett King (progressive rendering)
        if (creatorsResponse.status === 'fulfilled' && creatorsResponse.value) {
          const garrett = creatorsResponse.value.creators?.find(
            (c: LegacyCreator) => c.handle === 'SHORT' || c.kitSlug === 'garrett-king'
          );
          if (garrett) {
            startTransition(() => {
              setGarrettKing(garrett);
            });
          }
        }

        // Process featured asset (progressive rendering)
        if (assetsResponse.status === 'fulfilled' && assetsResponse.value) {
          const assetData = assetsResponse.value.asset;
          if (assetData) {
            startTransition(() => {
              setFeaturedAsset({
                id: assetData.id,
                title: assetData.title || 'Untitled Asset',
                category: assetData.category || '',
                thumbnailUrl: assetData.thumbnailUrl || '',
                description: assetData.description || '',
              });
            });
          }
        }

        // Process show episode
        let assetId = '';
        if (configDoc.status === 'fulfilled' && configDoc.value?.exists()) {
          const configData = configDoc.value.data() as any;
          assetId = configData.muxAssetId || '';
        }
        if (!assetId) {
          assetId = process.env.NEXT_PUBLIC_SHOW_ASSET_ID || '';
        }

        if (assetId) {
          try {
            const episodeResponse = await fetch(`/api/show/episode?assetId=${encodeURIComponent(assetId)}`);
            if (episodeResponse.ok) {
              const episodeData = await episodeResponse.json();
              
              const passthrough = episodeData.passthrough || {};
              const guest = passthrough.guest || passthrough.guestName || '';
              const handle = passthrough.handle || passthrough.guestHandle || '';

              startTransition(() => {
                setShowEpisode({
                  title: episodeData.title || 'CCA Show',
                  description: episodeData.description || '',
                  playbackId: episodeData.playbackId,
                  thumbnailUrl: episodeData.playbackId
                    ? `https://image.mux.com/${episodeData.playbackId}/thumbnail.jpg?width=640&fit_mode=preserve`
                    : undefined,
                  guest,
                  handle,
                });
              });
            }
          } catch (error) {
            // Silently fail - show episode is optional
          }
        }

        // Process walkthrough video
        let walkthroughAssetId = '';
        if (walkthroughConfigDoc.status === 'fulfilled' && walkthroughConfigDoc.value?.exists()) {
          const walkthroughConfigData = walkthroughConfigDoc.value.data() as any;
          walkthroughAssetId = walkthroughConfigData.muxAssetId || '';
        }

        if (walkthroughAssetId) {
          try {
            const walkthroughResponse = await fetch(`/api/show/episode?assetId=${encodeURIComponent(walkthroughAssetId)}`);
            if (walkthroughResponse.ok) {
              const walkthroughData = await walkthroughResponse.json();
              
              // Use Firestore title/description if available, otherwise use MUX data
              const walkthroughConfigData = walkthroughConfigDoc.status === 'fulfilled' && walkthroughConfigDoc.value?.exists()
                ? (walkthroughConfigDoc.value.data() as any)
                : {};

              startTransition(() => {
                setWalkthrough({
                  title: walkthroughConfigData.title || walkthroughData.title || 'Platform Walkthrough',
                  description: walkthroughConfigData.description || walkthroughData.description || 'Learn how to navigate the platform to unlock all the features.',
                  playbackId: walkthroughData.playbackId,
                  thumbnailUrl: walkthroughData.playbackId
                    ? `https://image.mux.com/${walkthroughData.playbackId}/thumbnail.jpg?width=640&fit_mode=preserve`
                    : undefined,
                });
              });
            }
          } catch (error) {
            // Silently fail - walkthrough is optional
          }
        }
      } catch (error) {
        // Silently handle errors - UI will show loading states
      } finally {
        // Set loading to false after all data fetching attempts
        setDataLoading(false);
      }
    };

    fetchData();
  }, [user, getDocCacheFirst, getDocsCacheFirst]);

  const displayName = useMemo(() => 
    userProfile?.displayName || user?.displayName || user?.email?.split('@')[0] || 'Creator',
    [userProfile?.displayName, user?.displayName, user?.email]
  );
  const photoURL = useMemo(() => 
    userProfile?.photoURL || user?.photoURL,
    [userProfile?.photoURL, user?.photoURL]
  );
  const memberSince = useMemo(() => 
    userProfile?.memberSince || formatMemberSince(userMemberSince),
    [userProfile?.memberSince, userMemberSince]
  );
  const memberTag = useMemo(() => 
    userProfile?.memberTag || 'Member',
    [userProfile?.memberTag]
  );

  const getMuxThumbnailUrl = useCallback((playbackId?: string, animatedGifUrl?: string): string => {
    if (animatedGifUrl) return animatedGifUrl;
    if (playbackId) return `https://image.mux.com/${playbackId}/thumbnail.jpg?width=640&fit_mode=preserve`;
    return '';
  }, []);

  // Generate animated GIF thumbnail with varying start times to skip intro
  // Each video gets a different start time (after the 3-5 second intro) so thumbnails show different content
  const getVariedAnimatedGifUrl = useCallback((playbackId?: string, index: number = 0): string => {
    if (!playbackId) return '';
    
    // Start after intro (5 seconds) and vary by index
    // Each video starts at a different point: 5s, 8s, 11s, 14s, 17s, 20s, etc.
    const startTime = 5 + (index * 3);
    const endTime = startTime + 3; // 3 second loop
    
    return getMuxAnimatedGifUrl(playbackId, 640, startTime, endTime, 15);
  }, []);

  // Featured Show - only use real data from show episode, no fallback (memoized)
  const featuredShow = useMemo(() => {
    if (!showEpisode) return null;
    return {
      thumbnail: showEpisode.playbackId 
        ? getMuxThumbnailUrl(showEpisode.playbackId)
        : (showEpisode.thumbnailUrl || ''),
      title: showEpisode.title,
      description: showEpisode.description || '',
      guest: showEpisode.guest || '',
      handle: showEpisode.handle || ''
    };
  }, [showEpisode, getMuxThumbnailUrl]);

  if (loading || membershipLoading) {
    return (
      <main className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 py-4 sm:py-6 md:py-8 pt-safe">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-ccaBlue mb-4"></div>
            <p className="text-neutral-400">Loading...</p>
          </div>
        </div>
      </main>
    );
  }

  // Show upgrade CTA for logged-in users without membership
  if (user && hasMembership === false) {
    return (
      <main className="min-h-screen bg-transparent flex items-center justify-center px-6 py-16 pt-safe">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-white mb-4 sm:mb-6">
            Welcome to Creator Collective!
          </h1>
          <p className="text-xl sm:text-2xl text-neutral-400 mb-8 sm:mb-12 max-w-2xl mx-auto">
            Get access to exclusive content, courses, marketplace, and more.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link
              href="/signup"
              className="inline-block bg-ccaBlue text-white px-8 py-4 rounded-lg font-semibold text-lg hover:opacity-90 transition whitespace-nowrap"
            >
              Start Your Membership
            </Link>
            <Link
              href="/"
              className="inline-block bg-neutral-800 text-white px-8 py-4 rounded-lg font-semibold text-lg hover:bg-neutral-700 transition border border-neutral-700 whitespace-nowrap"
            >
              Learn More
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen max-w-7xl mx-auto px-2 sm:px-3 md:px-4 lg:px-6 py-2 sm:py-3 md:py-4 lg:py-6 xl:py-8 pt-safe overflow-x-hidden">
      <Suspense fallback={null}><ClaimFromSessionId /></Suspense>
      {/* Prompt to set a password for email login, if needed */}
      {user && needsPassword && !user?.providerData?.some((p) => p?.providerId === 'password') && (
        <div className="mb-3 sm:mb-4 md:mb-6 rounded-lg sm:rounded-xl border border-amber-600/40 bg-amber-500/10 p-2.5 sm:p-3 md:p-4 text-amber-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-3 md:gap-4">
          <div className="text-xs sm:text-sm flex-1 leading-relaxed break-words min-w-0">
            <span className="block sm:inline">Secure your account: set a password to enable email login</span>
            {user.email && (
              <span className="block sm:inline mt-1 sm:mt-0 sm:ml-1 break-all">for {user.email}</span>
            )}
          </div>
          <button
            onClick={async () => {
              if (!auth || !user?.email) return;
              try {
                await sendPasswordResetEmail(auth, user.email);
                setPasswordEmailSent(true);
                setNeedsPassword(false);
              } catch {}
            }}
            className="px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg bg-amber-500/20 active:bg-amber-500/30 hover:bg-amber-500/30 text-amber-100 text-[10px] sm:text-xs md:text-sm font-medium border border-amber-500/40 touch-manipulation min-h-[44px] flex items-center justify-center w-full sm:w-auto flex-shrink-0"
          >
            {passwordEmailSent ? 'Email Sent' : (
              <>
                <span className="hidden sm:inline">Send Password Setup Email</span>
                <span className="sm:hidden">Setup Password</span>
              </>
            )}
          </button>
        </div>
      )}
      <div className="grid lg:grid-cols-3 gap-2 sm:gap-3 md:gap-4 lg:gap-5 xl:gap-6">
        {/* Left Column */}
        <div className="lg:col-span-2 space-y-2 sm:space-y-3 md:space-y-4 lg:space-y-5 xl:space-y-6 min-w-0">
          {/* Top Section: Profile and Featured Show */}
          <div className="grid md:grid-cols-2 gap-2 sm:gap-3 md:gap-4 lg:gap-5 xl:gap-6 items-start">
            {/* Profile Section */}
            <div className="bg-neutral-950/60 backdrop-blur-sm border border-neutral-800 rounded-lg sm:rounded-xl md:rounded-2xl p-2.5 sm:p-3 md:p-4 lg:p-5 xl:p-6 min-w-0">
              <h1 className="text-base sm:text-lg md:text-xl lg:text-2xl font-bold mb-2 sm:mb-3 md:mb-4 leading-tight break-words">{getGreeting()}, {displayName.split(' ')[0]}.</h1>
              <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-3 md:mb-4 min-w-0">
                <div className="relative w-9 h-9 sm:w-10 sm:h-10 md:w-12 md:h-12 lg:w-14 lg:h-14 xl:w-16 xl:h-16 rounded-full overflow-hidden bg-neutral-800 border-2 border-neutral-700 flex-shrink-0">
                  {photoURL ? (
                    <img 
                      src={photoURL} 
                      alt={displayName} 
                      className="w-full h-full object-cover"
                      loading="lazy"
                      decoding="async"
                      sizes="64px"
                      onError={(e) => {
                        // Fallback to placeholder if image fails to load
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-2xl font-semibold bg-ccaBlue text-white">
                      {displayName.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0 overflow-hidden">
                  <div className="font-semibold text-xs sm:text-sm md:text-base lg:text-lg truncate">{displayName}</div>
                  <div className="flex flex-wrap items-center gap-1 sm:gap-1.5 md:gap-2 mt-0.5 sm:mt-1">
                    <span className="px-1.5 sm:px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 text-[9px] sm:text-[10px] md:text-xs font-medium border border-red-500/30 whitespace-nowrap flex-shrink-0">
                      {memberTag}
                    </span>
                    <span className="text-[9px] sm:text-[10px] md:text-xs text-neutral-500 whitespace-nowrap flex-shrink-0">Member since {memberSince}</span>
                  </div>
                </div>
              </div>

              <div className="mt-2 sm:mt-3 md:mt-4 lg:mt-5 xl:mt-6">
                <h2 className="text-[10px] sm:text-xs md:text-sm font-semibold text-neutral-400 mb-1.5 sm:mb-2 md:mb-3">Quick Access</h2>
                <div className="grid grid-cols-2 gap-1 sm:gap-1.5 md:gap-2 lg:gap-3">
                  <Link href="/opportunities" className="flex flex-col items-center p-1.5 sm:p-2 md:p-3 lg:p-4 rounded-lg sm:rounded-xl bg-neutral-900 border border-neutral-800 active:border-red-500/30 hover:border-red-500/30 transition-all group touch-manipulation min-h-[70px] sm:min-h-[80px] md:min-h-[90px] lg:min-h-[100px] justify-center">
                    <div className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 lg:w-10 lg:h-10 rounded-lg bg-red-500/20 flex items-center justify-center mb-0.5 sm:mb-1 md:mb-1.5 lg:mb-2 group-active:bg-red-500/30 group-hover:bg-red-500/30 transition">
                      <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 md:w-5 md:h-5 lg:w-6 lg:h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
                      </svg>
                    </div>
                    <span className="text-[8px] sm:text-[9px] md:text-[10px] lg:text-xs text-neutral-300 text-center leading-tight px-0.5 break-words">Post an Opportunity</span>
                  </Link>
                  
                  <Link href="/learn" className="flex flex-col items-center p-1.5 sm:p-2 md:p-3 lg:p-4 rounded-lg sm:rounded-xl bg-neutral-900 border border-neutral-800 active:border-neutral-700 hover:border-neutral-700 transition-all group touch-manipulation min-h-[70px] sm:min-h-[80px] md:min-h-[90px] lg:min-h-[100px] justify-center">
                    <div className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 lg:w-10 lg:h-10 rounded-lg bg-neutral-800 flex items-center justify-center mb-0.5 sm:mb-1 md:mb-1.5 lg:mb-2 group-active:bg-neutral-700 group-hover:bg-neutral-700 transition">
                      <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 md:w-5 md:h-5 lg:w-6 lg:h-6 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </div>
                    <span className="text-[8px] sm:text-[9px] md:text-[10px] lg:text-xs text-neutral-300 text-center leading-tight px-0.5 break-words">Creator Kits</span>
                  </Link>
                  
                  <a href="https://www.facebook.com/groups/1164427198416308" target="_blank" rel="noopener noreferrer" className="flex flex-col items-center p-1.5 sm:p-2 md:p-3 lg:p-4 rounded-lg sm:rounded-xl bg-neutral-900 border border-neutral-800 active:border-blue-500/30 hover:border-blue-500/30 transition-all group touch-manipulation min-h-[70px] sm:min-h-[80px] md:min-h-[90px] lg:min-h-[100px] justify-center">
                    <div className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 lg:w-10 lg:h-10 rounded-lg bg-blue-500/20 flex items-center justify-center mb-0.5 sm:mb-1 md:mb-1.5 lg:mb-2 group-active:bg-blue-500/30 group-hover:bg-blue-500/30 transition">
                      <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 md:w-5 md:h-5 lg:w-6 lg:h-6 text-blue-400" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                      </svg>
                    </div>
                    <span className="text-[8px] sm:text-[9px] md:text-[10px] lg:text-xs text-neutral-300 text-center leading-tight px-0.5 break-words">Facebook Group</span>
                  </a>
                  
                  <Link href="/discounts" className="flex flex-col items-center p-1.5 sm:p-2 md:p-3 lg:p-4 rounded-lg sm:rounded-xl bg-neutral-900 border border-neutral-800 active:border-orange-500/30 hover:border-orange-500/30 transition-all group touch-manipulation min-h-[70px] sm:min-h-[80px] md:min-h-[90px] lg:min-h-[100px] justify-center">
                    <div className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 lg:w-10 lg:h-10 rounded-lg bg-gradient-to-br from-orange-500/20 to-pink-500/20 flex items-center justify-center mb-0.5 sm:mb-1 md:mb-1.5 lg:mb-2 group-active:from-orange-500/30 group-active:to-pink-500/30 group-hover:from-orange-500/30 group-hover:to-pink-500/30 transition">
                      <Image 
                        src="/Adobe-Logo.png" 
                        alt="Adobe" 
                        width={20} 
                        height={20} 
                        className="w-3.5 h-3.5 sm:w-4 sm:h-4 md:w-5 md:h-5 lg:w-6 lg:h-6 object-contain"
                      />
                    </div>
                    <span className="text-[8px] sm:text-[9px] md:text-[10px] lg:text-xs text-neutral-300 text-center leading-tight px-0.5 break-words">Adobe Discount</span>
                  </Link>
                </div>
              </div>
            </div>

            {/* Featured Show */}
            {dataLoading || !featuredShow ? (
              <div className="bg-neutral-950 border border-neutral-800 rounded-lg sm:rounded-xl md:rounded-2xl overflow-hidden flex flex-col h-full min-w-0">
                <div className="relative aspect-video bg-neutral-900 animate-pulse"></div>
                <div className="p-2.5 sm:p-3 md:p-4 lg:p-5 xl:p-6 flex-1 flex flex-col min-w-0">
                  <div className="h-2.5 sm:h-3 bg-neutral-800 rounded w-24 sm:w-32 mb-2 animate-pulse"></div>
                  <div className="h-4 sm:h-5 md:h-6 bg-neutral-800 rounded w-full mb-2 animate-pulse"></div>
                  <div className="h-3 sm:h-4 bg-neutral-800 rounded w-full mb-3 sm:mb-4 flex-1 animate-pulse"></div>
                  <div className="h-3 sm:h-4 bg-neutral-800 rounded w-20 sm:w-24 mt-auto animate-pulse"></div>
                </div>
              </div>
            ) : (
              <div className="bg-neutral-950 border border-neutral-800 rounded-lg sm:rounded-xl md:rounded-2xl overflow-hidden flex flex-col h-full min-w-0">
                <div className="relative aspect-video bg-neutral-900">
                  {featuredShow.thumbnail ? (
                    <img 
                      src={featuredShow.thumbnail} 
                      alt={featuredShow.title}
                      className="w-full h-full object-cover"
                      loading="eager"
                      fetchPriority="high"
                      decoding="async"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-neutral-500">
                      <svg className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 lg:w-16 lg:h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                  )}
                  {featuredShow.guest && (
                    <div className="absolute bottom-1.5 sm:bottom-2 md:bottom-3 lg:bottom-4 left-1.5 sm:left-2 md:left-3 lg:left-4">
                      <div className="text-[9px] sm:text-[10px] md:text-xs lg:text-sm font-semibold text-white break-words">{featuredShow.guest}</div>
                      {featuredShow.handle && (
                        <div className="text-[8px] sm:text-[9px] md:text-[10px] lg:text-xs text-neutral-300 break-words">{featuredShow.handle}</div>
                      )}
                    </div>
                  )}
                </div>
                <div className="p-2.5 sm:p-3 md:p-4 lg:p-5 xl:p-6 flex-1 flex flex-col min-w-0">
                  <div className="text-[9px] sm:text-[10px] md:text-xs text-neutral-400 mb-1 sm:mb-1.5 md:mb-2">Creator Collective Show</div>
                  <h2 className="text-xs sm:text-sm md:text-base lg:text-lg xl:text-xl font-bold mb-1 sm:mb-1.5 md:mb-2 leading-tight break-words">{featuredShow.title}</h2>
                  <p className="text-[9px] sm:text-[10px] md:text-xs lg:text-sm text-neutral-400 line-clamp-2 leading-relaxed mb-2 sm:mb-3 md:mb-4 flex-1 break-words">{featuredShow.description}</p>
                  <Link href="/show" className="inline-flex items-center gap-1 sm:gap-1.5 md:gap-2 text-[9px] sm:text-[10px] md:text-xs lg:text-sm font-medium text-white active:text-ccaBlue hover:text-ccaBlue transition touch-manipulation mt-auto min-h-[44px] items-center">
                    Watch now
                    <svg className="w-2.5 h-2.5 sm:w-3 sm:h-3 md:w-3.5 md:h-3.5 lg:w-4 lg:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                </div>
              </div>
            )}
          </div>

          {/* Recently Added */}
          <div className="min-w-0">
            <h2 className="text-sm sm:text-base md:text-lg lg:text-xl font-bold mb-2 sm:mb-3 md:mb-4 leading-tight break-words">Recently Added</h2>
            {dataLoading ? (
              <div className="flex gap-1.5 sm:gap-2 md:gap-3 lg:gap-4 overflow-x-auto pb-2 sm:pb-3 md:pb-4 scrollbar-hide -mx-2 sm:-mx-3 md:mx-0 px-2 sm:px-3 md:px-0">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex-shrink-0 w-[120px] sm:w-[140px] md:w-48 lg:w-56 xl:w-64">
                    <div className="relative aspect-video bg-neutral-900 rounded-lg sm:rounded-xl animate-pulse"></div>
                    <div className="mt-1 sm:mt-1.5 md:mt-2 h-2.5 sm:h-3 md:h-4 bg-neutral-800 rounded animate-pulse"></div>
                  </div>
                ))}
              </div>
            ) : recentlyAdded.length > 0 ? (
              <div className="flex gap-1.5 sm:gap-2 md:gap-3 lg:gap-4 overflow-x-auto pb-2 sm:pb-3 md:pb-4 scrollbar-hide -mx-2 sm:-mx-3 md:mx-0 px-2 sm:px-3 md:px-0">
                {recentlyAdded.map((video, index) => {
                  // Use varied start times for animated GIFs to skip the intro and show different content
                  const thumbnailUrl = video.muxPlaybackId 
                    ? getVariedAnimatedGifUrl(video.muxPlaybackId, index)
                    : getMuxThumbnailUrl(video.muxPlaybackId, video.muxAnimatedGifUrl);
                  const hasValidLink = !!(video.courseSlug && video.moduleId && video.lessonId);
                  
                  const videoContent = (
                    <>
                      <div className="relative aspect-video bg-neutral-900 rounded-lg sm:rounded-xl overflow-hidden group cursor-pointer">
                        {thumbnailUrl ? (
                          <img 
                            src={thumbnailUrl} 
                            alt={video.title}
                            className="w-full h-full object-cover"
                            loading="lazy"
                            decoding="async"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                            }}
                          />
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center text-neutral-500">
                            <svg className="w-10 h-10 sm:w-12 sm:h-12 group-hover:scale-110 transition" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </div>
                        )}
                        {video.overlay && (
                          <div className="absolute top-1.5 sm:top-2 left-1.5 sm:left-2 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded bg-black/60 text-[10px] sm:text-xs font-semibold text-white">
                            {video.overlay}
                          </div>
                        )}
                        <div className="absolute bottom-1.5 sm:bottom-2 right-1.5 sm:right-2 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded bg-black/60 text-[10px] sm:text-xs font-semibold text-white">
                          {video.duration}
                        </div>
                      </div>
                      <h3 className="mt-1.5 sm:mt-2 text-xs sm:text-sm font-semibold line-clamp-2 leading-tight">{video.title}</h3>
                    </>
                  );

                  if (hasValidLink && video.courseSlug && video.moduleId && video.lessonId) {
                    return (
                      <Link 
                        key={video.id} 
                        href={`/learn/${video.courseSlug}/module/${video.moduleId}/lesson/${video.lessonId}`} 
                        className="flex-shrink-0 w-[120px] sm:w-[140px] md:w-48 lg:w-56 xl:w-64"
                      >
                        {videoContent}
                      </Link>
                    );
                  }
                  return (
                    <div key={video.id} className="flex-shrink-0 w-[120px] sm:w-[140px] md:w-48 lg:w-56 xl:w-64">
                      {videoContent}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-neutral-400 text-xs sm:text-sm">No recent content available.</div>
            )}
          </div>

          {/* Discounts Section */}
          {discounts.length > 0 && (
            <div className="mt-3 sm:mt-4 md:mt-5 lg:mt-6 xl:mt-8 min-w-0">
              <h2 className="text-sm sm:text-base md:text-lg lg:text-xl font-bold mb-2 sm:mb-3 md:mb-4 leading-tight break-words">Member Discounts</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-1.5 sm:gap-2 md:gap-3 lg:gap-4">
                {discounts.map((discount) => (
                  <Link key={discount.id} href="/discounts" className="rounded-lg sm:rounded-xl md:rounded-2xl border border-neutral-800 bg-neutral-950 p-2 sm:p-3 md:p-4 lg:p-5 hover:border-ccaBlue/50 transition-colors flex flex-col h-full min-w-0">
                    {discount.partnerLogoUrl && (
                      <div className="mb-2 sm:mb-3 md:mb-4 flex items-center justify-center h-10 sm:h-12 md:h-14 lg:h-16">
                        <img
                          src={discount.partnerLogoUrl}
                          alt={discount.partnerName}
                          className="max-h-full max-w-full object-contain"
                          loading="lazy"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                      </div>
                    )}
                    <div className="text-xs sm:text-sm md:text-base lg:text-lg font-semibold mb-1 leading-tight break-words">{discount.title}</div>
                    {discount.discountAmount && (
                      <div className="mb-1.5 sm:mb-2">
                        <span className="inline-block bg-white text-ccaBlue font-medium text-[10px] sm:text-xs md:text-sm px-1.5 sm:px-2 py-0.5 sm:py-1 rounded break-words">
                          {discount.discountAmount}
                        </span>
                      </div>
                    )}
                    <div className="text-neutral-400 text-[10px] sm:text-xs md:text-sm mb-2 sm:mb-3 md:mb-4 line-clamp-2 flex-grow leading-relaxed break-words">{discount.description}</div>
                    <div className="w-full px-2 sm:px-3 md:px-4 py-1.5 sm:py-2 md:py-2.5 rounded-lg bg-ccaBlue hover:opacity-90 transition text-white font-medium mt-auto text-center text-[10px] sm:text-xs md:text-sm min-h-[44px] flex items-center justify-center">
                      View Discount
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Garrett King Legacy Creator Widget */}
          {garrettKing && (
            <div className="mt-3 sm:mt-4 md:mt-5 lg:mt-6 xl:mt-8 min-w-0">
              <h2 className="text-sm sm:text-base md:text-lg lg:text-xl font-bold mb-2 sm:mb-3 md:mb-4 leading-tight break-words">Featured Creator</h2>
              <Link href={`/creator-kits/${garrettKing.kitSlug}`}>
                <div className="bg-neutral-950 border border-neutral-800 rounded-lg sm:rounded-xl md:rounded-2xl overflow-hidden group cursor-pointer hover:border-ccaBlue/50 transition-all min-w-0">
                  <div className="relative aspect-video bg-neutral-900">
                    {garrettKing.bannerUrl ? (
                      <img 
                        src={garrettKing.bannerUrl} 
                        alt={garrettKing.displayName}
                        className="w-full h-full object-cover"
                        loading="lazy"
                        decoding="async"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center text-neutral-500">
                        <svg className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 lg:w-16 lg:h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                      </div>
                    )}
                    <div className="absolute bottom-1.5 sm:bottom-2 md:bottom-3 lg:bottom-4 left-1.5 sm:left-2 md:left-3 lg:left-4 flex items-center gap-1.5 sm:gap-2 md:gap-3 min-w-0">
                        {garrettKing.avatarUrl ? (
                          <div className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 lg:w-16 lg:h-16 rounded-full overflow-hidden border-2 border-white bg-neutral-800 flex-shrink-0">
                            <img 
                              src={garrettKing.avatarUrl} 
                              alt={garrettKing.displayName}
                              className="w-full h-full object-cover"
                              loading="lazy"
                              decoding="async"
                            />
                          </div>
                      ) : (
                        <div className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 lg:w-16 lg:h-16 rounded-full bg-ccaBlue flex items-center justify-center text-white font-bold text-base sm:text-lg md:text-xl flex-shrink-0">
                          {garrettKing.displayName.charAt(0)}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="text-white font-bold text-xs sm:text-sm md:text-base lg:text-lg truncate">{garrettKing.displayName}</div>
                        <div className="text-neutral-300 text-[10px] sm:text-xs md:text-sm truncate">@{garrettKing.handle}</div>
                      </div>
                    </div>
                    <div className="absolute top-1.5 sm:top-2 md:top-3 lg:top-4 right-1.5 sm:right-2 md:right-3 lg:right-4">
                      <span className="px-1.5 sm:px-2 md:px-3 py-0.5 sm:py-1 rounded-full bg-blue-500/20 text-blue-400 text-[9px] sm:text-[10px] md:text-xs font-medium border border-blue-500/30 whitespace-nowrap">
                        Legacy+ Creator
                      </span>
                    </div>
                  </div>
                  <div className="p-2.5 sm:p-3 md:p-4 lg:p-5 xl:p-6 min-w-0">
                    <p className="text-[10px] sm:text-xs md:text-sm text-neutral-400 mb-2 sm:mb-3 md:mb-4 leading-relaxed break-words">Explore exclusive content and resources from this featured creator.</p>
                    <div className="inline-flex items-center gap-1 sm:gap-1.5 md:gap-2 text-[9px] sm:text-[10px] md:text-xs lg:text-sm font-medium text-white group-hover:text-ccaBlue transition">
                      View Creator Kit
                      <svg className="w-2.5 h-2.5 sm:w-3 sm:h-3 md:w-3.5 md:h-3.5 lg:w-4 lg:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                </div>
              </Link>
            </div>
          )}
        </div>

        {/* Right Column */}
        <div className="flex flex-col gap-2 sm:gap-3 md:gap-4 lg:gap-5 xl:gap-6 h-full min-w-0">
          {/* Platform Walkthrough */}
          {dataLoading || !walkthrough ? (
            <div className="bg-neutral-950 border border-neutral-800 rounded-lg sm:rounded-xl md:rounded-2xl overflow-hidden flex flex-col flex-1 min-w-0">
              <div className="relative aspect-video bg-transparent animate-pulse"></div>
              <div className="p-2.5 sm:p-3 md:p-4 lg:p-5 xl:p-6 flex-1 flex flex-col min-w-0">
                <div className="h-2.5 sm:h-3 bg-neutral-800 rounded w-16 sm:w-20 md:w-24 mb-2 animate-pulse"></div>
                <div className="h-3 sm:h-4 md:h-5 lg:h-6 bg-neutral-800 rounded w-full mb-2 animate-pulse"></div>
                <div className="h-2.5 sm:h-3 md:h-4 bg-neutral-800 rounded w-full mb-2 sm:mb-3 md:mb-4 flex-1 animate-pulse"></div>
                <div className="h-2.5 sm:h-3 md:h-4 bg-neutral-800 rounded w-16 sm:w-20 md:w-24 mt-auto animate-pulse"></div>
              </div>
            </div>
          ) : (
            (() => {
              const walkthroughHref: string = walkthrough.playbackId 
                ? `/walkthrough?playbackId=${walkthrough.playbackId}` 
                : '/learn';
              return (
                <div className="bg-neutral-950 border border-neutral-800 rounded-lg sm:rounded-xl md:rounded-2xl overflow-hidden flex flex-col flex-1 min-w-0">
                  <div 
                    className="relative aspect-video bg-transparent cursor-pointer group"
                    onClick={() => walkthrough.playbackId && setShowWalkthroughVideo(true)}
                  >
                    {walkthrough.thumbnailUrl ? (
                      <>
                        <img 
                          src={walkthrough.thumbnailUrl} 
                          alt={walkthrough.title}
                          className="w-full h-full object-cover"
                          loading="eager"
                          decoding="async"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                        {walkthrough.playbackId && (
                          <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/30 transition">
                            <div className="w-10 h-10 sm:w-12 sm:h-12 md:w-16 md:h-16 lg:w-20 lg:h-20 rounded-full bg-white/90 flex items-center justify-center group-hover:bg-white transition shadow-lg">
                              <svg className="w-5 h-5 sm:w-6 sm:h-6 md:w-8 md:h-8 lg:w-10 lg:h-10 text-neutral-900 ml-0.5 sm:ml-1" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M8 5v14l11-7z"/>
                              </svg>
                            </div>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center text-neutral-500">
                        <svg className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 lg:w-16 lg:h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                    )}
                  </div>
                  <div className="p-2.5 sm:p-3 md:p-4 lg:p-5 xl:p-6 flex-1 flex flex-col min-w-0">
                    <div className="text-[9px] sm:text-[10px] md:text-xs text-neutral-400 mb-1 sm:mb-1.5 md:mb-2">NEW HERE?</div>
                    <h3 className="text-xs sm:text-sm md:text-base lg:text-lg font-bold mb-1 sm:mb-1.5 md:mb-2 leading-tight break-words">{walkthrough.title}</h3>
                    {walkthrough.description && (
                      <p className="text-[9px] sm:text-[10px] md:text-xs lg:text-sm text-neutral-400 mb-2 sm:mb-3 md:mb-4 leading-relaxed flex-1 line-clamp-2 break-words">{walkthrough.description}</p>
                    )}
                    <Link href={walkthroughHref as any} className="inline-flex items-center gap-1 sm:gap-1.5 md:gap-2 text-[9px] sm:text-[10px] md:text-xs lg:text-sm font-medium text-white active:text-ccaBlue hover:text-ccaBlue transition touch-manipulation mt-auto min-h-[44px] items-center">
                      Get the Tour
                      <svg className="w-2.5 h-2.5 sm:w-3 sm:h-3 md:w-3.5 md:h-3.5 lg:w-4 lg:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </Link>
                  </div>
                </div>
              );
            })()
          )}

          {/* Featured Asset */}
          {dataLoading || !featuredAsset ? (
            <div className="bg-neutral-950 border border-neutral-800 rounded-lg sm:rounded-xl md:rounded-2xl overflow-hidden flex flex-col flex-1 min-w-0">
              <div className="relative aspect-video bg-transparent animate-pulse"></div>
              <div className="p-2.5 sm:p-3 md:p-4 lg:p-5 xl:p-6 flex-1 flex flex-col min-w-0">
                <div className="h-2.5 sm:h-3 bg-neutral-800 rounded w-16 sm:w-20 md:w-24 mb-2 animate-pulse"></div>
                <div className="h-3 sm:h-4 md:h-5 lg:h-6 bg-neutral-800 rounded w-full mb-2 animate-pulse"></div>
                <div className="h-2.5 sm:h-3 md:h-4 bg-neutral-800 rounded w-full mb-2 sm:mb-3 md:mb-4 flex-1 animate-pulse"></div>
                <div className="h-2.5 sm:h-3 md:h-4 bg-neutral-800 rounded w-20 sm:w-24 md:w-32 mt-auto animate-pulse"></div>
              </div>
            </div>
          ) : (
            <div 
              className="bg-neutral-950 border border-neutral-800 rounded-lg sm:rounded-xl md:rounded-2xl overflow-hidden flex flex-col flex-1 min-w-0 cursor-pointer group hover:border-ccaBlue/50 transition-all"
              onClick={async () => {
                try {
                  if (!user || !auth.currentUser) {
                    window.location.href = '/assets';
                    return;
                  }
                  
                  const idToken = await auth.currentUser.getIdToken();
                  const response = await fetch(`/api/assets/download?assetId=${featuredAsset.id}`, {
                    headers: {
                      'Authorization': `Bearer ${idToken}`,
                    },
                  });
                  
                  if (!response.ok) {
                    window.location.href = '/assets';
                    return;
                  }
                  
                  const data = await response.json();
                  if (data.downloadUrl) {
                    const link = document.createElement('a');
                    link.href = data.downloadUrl;
                    link.download = featuredAsset.title.replace(/\s+/g, '_') + '.zip';
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                  }
                } catch (error) {
                  window.location.href = '/assets';
                }
              }}
            >
              <div className="relative aspect-video bg-transparent">
                {featuredAsset.thumbnailUrl && 
                 featuredAsset.thumbnailUrl.startsWith('https://') && 
                 (featuredAsset.thumbnailUrl.includes('firebasestorage.googleapis.com') || 
                  featuredAsset.thumbnailUrl.includes('firebasestorage.app')) ? (
                  <img 
                    src={featuredAsset.thumbnailUrl} 
                    alt={featuredAsset.title}
                    className="w-full h-full object-cover group-hover:opacity-90 transition-opacity"
                    loading="eager"
                    decoding="async"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-neutral-500">
                    <svg className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 lg:w-16 lg:h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                  </div>
                )}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                  <svg className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 lg:w-16 lg:h-16 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                </div>
              </div>
              <div className="p-2.5 sm:p-3 md:p-4 lg:p-5 xl:p-6 flex-1 flex flex-col min-w-0 min-h-0">
                <div className="text-[9px] sm:text-[10px] md:text-xs text-neutral-400 mb-1 sm:mb-1.5 md:mb-2 flex-shrink-0">ASSETS</div>
                <h3 className="text-xs sm:text-sm md:text-base lg:text-lg font-bold mb-1 sm:mb-1.5 md:mb-2 leading-tight break-words flex-shrink-0">{featuredAsset.title}</h3>
                {featuredAsset.description ? (
                  <p className="text-[9px] sm:text-[10px] md:text-xs lg:text-sm text-neutral-400 mb-2 sm:mb-3 md:mb-4 leading-relaxed line-clamp-2 break-words overflow-hidden">{featuredAsset.description}</p>
                ) : featuredAsset.category ? (
                  <p className="text-[9px] sm:text-[10px] md:text-xs lg:text-sm text-neutral-400 mb-2 sm:mb-3 md:mb-4 leading-relaxed line-clamp-2 break-words overflow-hidden">{featuredAsset.category}</p>
                ) : null}
                <div className="inline-flex items-center gap-1 sm:gap-1.5 md:gap-2 text-[9px] sm:text-[10px] md:text-xs lg:text-sm font-medium text-white group-hover:text-ccaBlue transition touch-manipulation mt-auto min-h-[44px] items-center flex-shrink-0">
                  DOWNLOAD ASSET
                  <svg className="w-2.5 h-2.5 sm:w-3 sm:h-3 md:w-3.5 md:h-3.5 lg:w-4 lg:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Product Packs */}
      <div className="mt-3 sm:mt-4 md:mt-5 lg:mt-6 xl:mt-8 min-w-0">
        <h2 className="text-sm sm:text-base md:text-lg lg:text-xl font-bold mb-2 sm:mb-3 md:mb-4 leading-tight break-words">Marketplace</h2>
        {dataLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-1.5 sm:gap-2 md:gap-3 lg:gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-neutral-950 border border-neutral-800 rounded-lg sm:rounded-xl overflow-hidden">
                <div className="relative aspect-video bg-neutral-900 animate-pulse"></div>
                <div className="p-2 sm:p-3 md:p-4">
                  <div className="h-3 sm:h-4 bg-neutral-800 rounded animate-pulse"></div>
                </div>
              </div>
            ))}
          </div>
        ) : products.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-1.5 sm:gap-2 md:gap-3 lg:gap-4">
            {products.map((product) => (
              <Link key={product.id} href={`/marketplace`} className="bg-neutral-950 border border-neutral-800 rounded-lg sm:rounded-xl overflow-hidden group cursor-pointer active:border-neutral-700 hover:border-neutral-700 transition touch-manipulation min-w-0">
                <div className="relative aspect-video bg-neutral-900">
                  {product.image ? (
                    <img 
                      src={product.image} 
                      alt={product.title}
                      className="w-full h-full object-cover"
                      loading="lazy"
                      decoding="async"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-neutral-500">
                      <svg className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                  )}
                </div>
                <div className="p-1.5 sm:p-2 md:p-3 lg:p-4 min-w-0">
                  <h3 className="font-semibold text-xs sm:text-sm md:text-base leading-tight mb-0.5 sm:mb-1 break-words">{product.title}</h3>
                  {product.price !== undefined && (
                    <div className="text-ccaBlue font-medium text-xs sm:text-sm">${product.price.toFixed(2)}</div>
                  )}
                  {product.condition && (
                    <div className="text-[10px] sm:text-xs text-neutral-500 mt-0.5 sm:mt-1 break-words">{product.condition}</div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-neutral-400 text-xs sm:text-sm break-words">No marketplace listings available.</div>
        )}
      </div>

      {/* Walkthrough Video Modal */}
      {showWalkthroughVideo && walkthrough?.playbackId && (
        <div 
          className="fixed inset-0 z-[300] flex items-center justify-center bg-black/90 p-2 sm:p-4"
          onClick={() => setShowWalkthroughVideo(false)}
        >
          <div 
            className="relative w-full max-w-6xl bg-transparent rounded-lg sm:rounded-xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowWalkthroughVideo(false)}
              className="absolute -top-8 sm:-top-10 right-0 sm:right-2 text-white hover:text-neutral-400 transition z-10 p-2 touch-manipulation min-h-[44px] min-w-[44px] flex items-center justify-center"
              aria-label="Close video"
            >
              <svg className="w-6 h-6 sm:w-8 sm:h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <div className="aspect-video bg-neutral-800">
              <MuxPlayer
                playbackId={walkthrough.playbackId}
                streamType="on-demand"
                primaryColor="#3B82F6"
                className="w-full h-full"
                style={{ aspectRatio: '16 / 9' }}
                playsInline
                preload="metadata"
                // @ts-ignore
                preferMse
                // @ts-ignore
                maxResolution="540p"
                // @ts-ignore
                disablePictureInPicture
                // @ts-ignore
                autoPictureInPicture={false}
              />
            </div>
            <div className="p-3 sm:p-4 md:p-6">
              <h3 className="text-base sm:text-lg md:text-xl lg:text-2xl font-bold text-white mb-1 sm:mb-2 leading-tight">{walkthrough.title}</h3>
              {walkthrough.description && (
                <p className="text-neutral-300 text-xs sm:text-sm md:text-base leading-relaxed">{walkthrough.description}</p>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
