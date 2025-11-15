"use client";
import { useEffect, useState, Suspense } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';
import Image from 'next/image';
import { doc, getDoc, collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { db, firebaseReady } from '@/lib/firebaseClient';
import { auth } from '@/lib/firebaseClient';
import { signInWithCustomToken, fetchSignInMethodsForEmail, sendPasswordResetEmail } from 'firebase/auth';
import { useSearchParams, useRouter } from 'next/navigation';

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
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [userMemberSince, setUserMemberSince] = useState<Date | null>(null);
  const [needsPassword, setNeedsPassword] = useState(false);
  const [passwordEmailSent, setPasswordEmailSent] = useState(false);
  const [recentlyAdded, setRecentlyAdded] = useState<Video[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [garrettKing, setGarrettKing] = useState<LegacyCreator | null>(null);
  const [dataLoading, setDataLoading] = useState(true);
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

  // Post-checkout auto sign-in via custom token handled in Suspense-wrapped child

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
            const data = userDoc.data();
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
          console.error('Error fetching profile:', error);
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

  // Fetch data from Firestore - optimized for parallel loading
  useEffect(() => {
    const fetchData = async () => {
      if (!firebaseReady || !db) {
        setDataLoading(false);
        return;
      }

      try {
        // Fetch all data in parallel for instant loading
        const [
          coursesSnap,
          listingsSnap,
          configDoc,
          walkthroughConfigDoc,
          creatorsResponse,
          discountsData,
          assetsSnap
        ] = await Promise.allSettled([
          // Fetch courses
          getDocs(collection(db, 'courses')),
          // Fetch marketplace listings
          getDocs(query(collection(db, 'listings'), orderBy('createdAt', 'desc'), limit(3))),
          // Fetch show config
          db ? getDoc(doc(db, 'config', 'show')) : Promise.resolve(null),
          // Fetch walkthrough config
          db ? getDoc(doc(db, 'config', 'walkthrough')) : Promise.resolve(null),
          // Fetch legacy creators
          fetch('/api/legacy/creators').then(r => r.ok ? r.json() : null),
          // Fetch discounts (if user authenticated)
          user && auth.currentUser 
            ? auth.currentUser.getIdToken().then((token: string) => 
                fetch('/api/discounts', {
                  headers: { Authorization: `Bearer ${token}` },
                }).then(r => r.ok ? r.json() : null)
              )
            : Promise.resolve(null),
          // Fetch assets (for featured asset)
          getDocs(query(collection(db, 'assets'), orderBy('createdAt', 'desc'), limit(1)))
        ]);

        // Process courses and lessons
        if (coursesSnap.status === 'fulfilled') {
          const allLessons: Video[] = [];
          const coursePromises = coursesSnap.value.docs.map(async (courseDoc) => {
            const courseData = courseDoc.data();
            const courseId = courseDoc.id;
            const courseSlug = courseData.slug || courseId;

            try {
              const modulesRef = collection(db, `courses/${courseId}/modules`);
              const modulesSnap = await getDocs(query(modulesRef, orderBy('index', 'asc')));

              const modulePromises = modulesSnap.docs.map(async (moduleDoc) => {
                const moduleId = moduleDoc.id;
                const lessonsRef = collection(db, `courses/${courseId}/modules/${moduleId}/lessons`);
                const lessonsSnap = await getDocs(query(lessonsRef, orderBy('index', 'asc')));

                lessonsSnap.forEach((lessonDoc) => {
                  const lessonData = lessonDoc.data();
                  const durationSec = lessonData.durationSec || 0;
                  const minutes = Math.floor(durationSec / 60);
                  const seconds = durationSec % 60;
                  const duration = `${minutes}:${seconds.toString().padStart(2, '0')}`;

                  let thumbnail = '';
                  if (lessonData.muxAnimatedGifUrl) {
                    thumbnail = lessonData.muxAnimatedGifUrl;
                  } else if (lessonData.muxPlaybackId) {
                    thumbnail = `https://image.mux.com/${lessonData.muxPlaybackId}/thumbnail.jpg?width=640&fit_mode=preserve`;
                  }

                  allLessons.push({
                    id: lessonDoc.id,
                    title: lessonData.title || 'Untitled Lesson',
                    thumbnail,
                    duration,
                    courseSlug,
                    courseId,
                    moduleId,
                    lessonId: lessonDoc.id,
                    muxPlaybackId: lessonData.muxPlaybackId,
                    muxAnimatedGifUrl: lessonData.muxAnimatedGifUrl,
                  });
                });
              });

              await Promise.all(modulePromises);
            } catch (error) {
              console.error(`Error fetching lessons for course ${courseId}:`, error);
            }
          });

          await Promise.all(coursePromises);
          setRecentlyAdded(allLessons.slice(0, 6));
        }

        // Process marketplace listings
        if (listingsSnap.status === 'fulfilled') {
          const listingsData: Product[] = [];
          listingsSnap.value.forEach((doc) => {
            const data = doc.data();
            listingsData.push({
              id: doc.id,
              title: data.title || 'Untitled Listing',
              image: data.images && data.images.length > 0 ? data.images[0] : '',
              price: data.price || 0,
              condition: data.condition || '',
              images: data.images || [],
            });
          });
          setProducts(listingsData);
        }

        // Process discounts
        if (discountsData.status === 'fulfilled' && discountsData.value) {
          setDiscounts((discountsData.value.discounts || []).slice(0, 3));
        }

        // Process Garrett King
        if (creatorsResponse.status === 'fulfilled' && creatorsResponse.value) {
          const garrett = creatorsResponse.value.creators?.find(
            (c: LegacyCreator) => c.handle === 'SHORT' || c.kitSlug === 'garrett-king'
          );
          if (garrett) {
            setGarrettKing(garrett);
          }
        }

        // Process featured asset
        if (assetsSnap.status === 'fulfilled' && assetsSnap.value && !assetsSnap.value.empty) {
          const firstAsset = assetsSnap.value.docs[0];
          const assetData = firstAsset.data();
          setFeaturedAsset({
            id: firstAsset.id,
            title: assetData.title || 'Untitled Asset',
            category: assetData.category || '',
            thumbnailUrl: assetData.thumbnailUrl || '',
            description: assetData.description || '',
          });
        }

        // Process show episode
        let assetId = '';
        if (configDoc.status === 'fulfilled' && configDoc.value?.exists()) {
          const configData = configDoc.value.data();
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
            }
          } catch (error) {
            console.error('Error fetching show episode:', error);
          }
        }

        // Process walkthrough video
        let walkthroughAssetId = '';
        if (walkthroughConfigDoc.status === 'fulfilled' && walkthroughConfigDoc.value?.exists()) {
          const walkthroughConfigData = walkthroughConfigDoc.value.data();
          walkthroughAssetId = walkthroughConfigData.muxAssetId || '';
        }

        if (walkthroughAssetId) {
          try {
            const walkthroughResponse = await fetch(`/api/show/episode?assetId=${encodeURIComponent(walkthroughAssetId)}`);
            if (walkthroughResponse.ok) {
              const walkthroughData = await walkthroughResponse.json();
              
              // Use Firestore title/description if available, otherwise use MUX data
              const walkthroughConfigData = walkthroughConfigDoc.status === 'fulfilled' && walkthroughConfigDoc.value?.exists()
                ? walkthroughConfigDoc.value.data()
                : {};

              setWalkthrough({
                title: walkthroughConfigData.title || walkthroughData.title || 'Platform Walkthrough',
                description: walkthroughConfigData.description || walkthroughData.description || 'Learn how to navigate the platform to unlock all the features.',
                playbackId: walkthroughData.playbackId,
                thumbnailUrl: walkthroughData.playbackId
                  ? `https://image.mux.com/${walkthroughData.playbackId}/thumbnail.jpg?width=640&fit_mode=preserve`
                  : undefined,
              });
            }
          } catch (error) {
            console.error('Error fetching walkthrough video:', error);
          }
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setDataLoading(false);
      }
    };

    fetchData();
  }, [user]);

  const displayName = userProfile?.displayName || user?.displayName || user?.email?.split('@')[0] || 'Creator';
  const photoURL = userProfile?.photoURL || user?.photoURL;
  const memberSince = userProfile?.memberSince || formatMemberSince(userMemberSince);
  const memberTag = userProfile?.memberTag || 'Member';

  function getMuxThumbnailUrl(playbackId?: string, animatedGifUrl?: string): string {
    if (animatedGifUrl) return animatedGifUrl;
    if (playbackId) return `https://image.mux.com/${playbackId}/thumbnail.jpg?width=640&fit_mode=preserve`;
    return '';
  }

  // Featured Show - only use real data from show episode, no fallback
  const featuredShow = showEpisode ? {
    thumbnail: showEpisode.playbackId 
      ? getMuxThumbnailUrl(showEpisode.playbackId)
      : (showEpisode.thumbnailUrl || ''),
    title: showEpisode.title,
    description: showEpisode.description || '',
    guest: showEpisode.guest || '',
    handle: showEpisode.handle || ''
  } : null;

  if (loading) {
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

  return (
    <main className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 py-4 sm:py-6 md:py-8 pt-safe">
      <Suspense fallback={null}><ClaimFromSessionId /></Suspense>
      {/* Prompt to set a password for email login, if needed */}
      {user && needsPassword && !user?.providerData?.some((p) => p?.providerId === 'password') && (
        <div className="mb-4 sm:mb-6 rounded-xl border border-amber-600/40 bg-amber-500/10 p-3 sm:p-4 text-amber-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
          <div className="text-xs sm:text-sm flex-1">
            Secure your account: set a password to enable email login for {user.email}.
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
            className="px-3 py-1.5 rounded-lg bg-amber-500/20 active:bg-amber-500/30 hover:bg-amber-500/30 text-amber-100 text-xs sm:text-sm font-medium border border-amber-500/40 touch-manipulation whitespace-nowrap"
          >
            {passwordEmailSent ? 'Email Sent' : 'Send Password Setup Email'}
          </button>
        </div>
      )}
      <div className="grid lg:grid-cols-3 gap-4 sm:gap-5 md:gap-6">
        {/* Left Column */}
        <div className="lg:col-span-2 space-y-4 sm:space-y-5 md:space-y-6">
          {/* Top Section: Profile and Featured Show */}
          <div className="grid md:grid-cols-2 gap-4 sm:gap-5 md:gap-6 items-start">
            {/* Profile Section */}
            <div className="bg-neutral-950 border border-neutral-800 rounded-xl sm:rounded-2xl p-4 sm:p-5 md:p-6">
              <h1 className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4 leading-tight">{getGreeting()}, {displayName.split(' ')[0]}.</h1>
              <div className="flex items-center gap-2 sm:gap-3 mb-4">
                <div className="relative w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 rounded-full overflow-hidden bg-neutral-800 border-2 border-neutral-700 flex-shrink-0">
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
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-base sm:text-lg truncate">{displayName}</div>
                  <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mt-1">
                    <span className="px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 text-[10px] sm:text-xs font-medium border border-red-500/30 whitespace-nowrap">
                      {memberTag}
                    </span>
                    <span className="text-[10px] sm:text-xs text-neutral-500 whitespace-nowrap">Member since {memberSince}</span>
                  </div>
                </div>
              </div>

              <div className="mt-4 sm:mt-5 md:mt-6">
                <h2 className="text-xs sm:text-sm font-semibold text-neutral-400 mb-2 sm:mb-3">Quick Access</h2>
                <div className="grid grid-cols-2 gap-2 sm:gap-3">
                  <Link href="/opportunities" className="flex flex-col items-center p-3 sm:p-4 rounded-lg sm:rounded-xl bg-neutral-900 border border-neutral-800 active:border-red-500/30 hover:border-red-500/30 transition-all group touch-manipulation">
                    <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-red-500/20 flex items-center justify-center mb-1.5 sm:mb-2 group-active:bg-red-500/30 group-hover:bg-red-500/30 transition">
                      <svg className="w-5 h-5 sm:w-6 sm:h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
                      </svg>
                    </div>
                    <span className="text-[10px] sm:text-xs text-neutral-300 text-center leading-tight">Post an Opportunity</span>
                  </Link>
                  
                  <Link href="/learn" className="flex flex-col items-center p-3 sm:p-4 rounded-lg sm:rounded-xl bg-neutral-900 border border-neutral-800 active:border-neutral-700 hover:border-neutral-700 transition-all group touch-manipulation">
                    <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-neutral-800 flex items-center justify-center mb-1.5 sm:mb-2 group-active:bg-neutral-700 group-hover:bg-neutral-700 transition">
                      <svg className="w-5 h-5 sm:w-6 sm:h-6 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </div>
                    <span className="text-[10px] sm:text-xs text-neutral-300 text-center leading-tight">Creator Kits</span>
                  </Link>
                  
                  <a href="https://www.facebook.com/groups/1164427198416308" target="_blank" rel="noopener noreferrer" className="flex flex-col items-center p-3 sm:p-4 rounded-lg sm:rounded-xl bg-neutral-900 border border-neutral-800 active:border-blue-500/30 hover:border-blue-500/30 transition-all group touch-manipulation">
                    <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-blue-500/20 flex items-center justify-center mb-1.5 sm:mb-2 group-active:bg-blue-500/30 group-hover:bg-blue-500/30 transition">
                      <svg className="w-5 h-5 sm:w-6 sm:h-6 text-blue-400" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                      </svg>
                    </div>
                    <span className="text-[10px] sm:text-xs text-neutral-300 text-center leading-tight">Facebook Group</span>
                  </a>
                  
                  <Link href="/discounts" className="flex flex-col items-center p-3 sm:p-4 rounded-lg sm:rounded-xl bg-neutral-900 border border-neutral-800 active:border-orange-500/30 hover:border-orange-500/30 transition-all group touch-manipulation">
                    <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-gradient-to-br from-orange-500/20 to-pink-500/20 flex items-center justify-center mb-1.5 sm:mb-2 group-active:from-orange-500/30 group-active:to-pink-500/30 group-hover:from-orange-500/30 group-hover:to-pink-500/30 transition">
                      <Image 
                        src="/Adobe-Logo.png" 
                        alt="Adobe" 
                        width={20} 
                        height={20} 
                        className="w-5 h-5 sm:w-6 sm:h-6 object-contain"
                      />
                    </div>
                    <span className="text-[10px] sm:text-xs text-neutral-300 text-center leading-tight">Adobe Discount</span>
                  </Link>
                </div>
              </div>
            </div>

            {/* Featured Show */}
            {dataLoading || !featuredShow ? (
              <div className="bg-neutral-950 border border-neutral-800 rounded-xl sm:rounded-2xl overflow-hidden flex flex-col h-full">
                <div className="relative aspect-video bg-neutral-900 animate-pulse"></div>
                <div className="p-4 sm:p-5 md:p-6 flex-1 flex flex-col">
                  <div className="h-3 bg-neutral-800 rounded w-32 mb-2 animate-pulse"></div>
                  <div className="h-6 bg-neutral-800 rounded w-full mb-2 animate-pulse"></div>
                  <div className="h-4 bg-neutral-800 rounded w-full mb-4 flex-1 animate-pulse"></div>
                  <div className="h-4 bg-neutral-800 rounded w-24 mt-auto animate-pulse"></div>
                </div>
              </div>
            ) : (
              <div className="bg-neutral-950 border border-neutral-800 rounded-xl sm:rounded-2xl overflow-hidden flex flex-col h-full">
                <div className="relative aspect-video bg-neutral-900">
                  {featuredShow.thumbnail ? (
                    <img 
                      src={featuredShow.thumbnail} 
                      alt={featuredShow.title}
                      className="w-full h-full object-cover"
                      loading="eager"
                      decoding="async"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-neutral-500">
                      <svg className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                  )}
                  {featuredShow.guest && (
                    <div className="absolute bottom-2 sm:bottom-3 md:bottom-4 left-2 sm:left-3 md:left-4">
                      <div className="text-xs sm:text-sm font-semibold text-white">{featuredShow.guest}</div>
                      {featuredShow.handle && (
                        <div className="text-[10px] sm:text-xs text-neutral-300">{featuredShow.handle}</div>
                      )}
                    </div>
                  )}
                </div>
                <div className="p-4 sm:p-5 md:p-6 flex-1 flex flex-col">
                  <div className="text-[10px] sm:text-xs text-neutral-400 mb-1.5 sm:mb-2">Creator Collective Show</div>
                  <h2 className="text-base sm:text-lg md:text-xl font-bold mb-1.5 sm:mb-2 leading-tight">{featuredShow.title}</h2>
                  <p className="text-xs sm:text-sm text-neutral-400 line-clamp-2 leading-relaxed mb-3 sm:mb-4 flex-1">{featuredShow.description}</p>
                  <Link href="/show" className="inline-flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm font-medium text-white active:text-ccaBlue hover:text-ccaBlue transition touch-manipulation mt-auto">
                    Watch now
                    <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                </div>
              </div>
            )}
          </div>

          {/* Recently Added */}
          <div>
            <h2 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4 leading-tight">Recently Added</h2>
            {dataLoading ? (
              <div className="flex gap-3 sm:gap-4 overflow-x-auto pb-3 sm:pb-4 scrollbar-hide -mx-3 sm:mx-0 px-3 sm:px-0">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex-shrink-0 w-56 sm:w-64">
                    <div className="relative aspect-video bg-neutral-900 rounded-xl animate-pulse"></div>
                    <div className="mt-2 h-4 bg-neutral-800 rounded animate-pulse"></div>
                  </div>
                ))}
              </div>
            ) : recentlyAdded.length > 0 ? (
              <div className="flex gap-3 sm:gap-4 overflow-x-auto pb-3 sm:pb-4 scrollbar-hide -mx-3 sm:mx-0 px-3 sm:px-0">
                {recentlyAdded.map((video) => {
                  const thumbnailUrl = getMuxThumbnailUrl(video.muxPlaybackId, video.muxAnimatedGifUrl);
                  const hasValidLink = !!(video.courseSlug && video.moduleId && video.lessonId);
                  
                  const videoContent = (
                    <>
                      <div className="relative aspect-video bg-neutral-900 rounded-xl overflow-hidden group cursor-pointer">
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
                            <svg className="w-12 h-12 group-hover:scale-110 transition" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </div>
                        )}
                        {video.overlay && (
                          <div className="absolute top-2 left-2 px-2 py-1 rounded bg-black/60 text-xs font-semibold text-white">
                            {video.overlay}
                          </div>
                        )}
                        <div className="absolute bottom-2 right-2 px-2 py-1 rounded bg-black/60 text-xs font-semibold text-white">
                          {video.duration}
                        </div>
                      </div>
                      <h3 className="mt-2 text-sm font-semibold line-clamp-2">{video.title}</h3>
                    </>
                  );

                  if (hasValidLink && video.courseSlug && video.moduleId && video.lessonId) {
                    return (
                      <Link 
                        key={video.id} 
                        href={`/learn/${video.courseSlug}/module/${video.moduleId}/lesson/${video.lessonId}`} 
                        className="flex-shrink-0 w-56 sm:w-64"
                      >
                        {videoContent}
                      </Link>
                    );
                  }
                  return (
                    <div key={video.id} className="flex-shrink-0 w-56 sm:w-64">
                      {videoContent}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-neutral-400 text-sm">No recent content available.</div>
            )}
          </div>

          {/* Garrett King Legacy Creator Widget */}
          {garrettKing && (
            <div className="mt-6 sm:mt-7 md:mt-8">
              <h2 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4 leading-tight">Featured Creator</h2>
              <Link href={`/creator-kits/${garrettKing.kitSlug}`}>
                <div className="bg-neutral-950 border border-neutral-800 rounded-xl sm:rounded-2xl overflow-hidden group cursor-pointer hover:border-ccaBlue/50 transition-all">
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
                        <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                      </div>
                    )}
                    <div className="absolute bottom-4 left-4 flex items-center gap-3">
                        {garrettKing.avatarUrl ? (
                          <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-white bg-neutral-800">
                            <img 
                              src={garrettKing.avatarUrl} 
                              alt={garrettKing.displayName}
                              className="w-full h-full object-cover"
                              loading="lazy"
                              decoding="async"
                            />
                          </div>
                      ) : (
                        <div className="w-16 h-16 rounded-full bg-ccaBlue flex items-center justify-center text-white font-bold text-xl">
                          {garrettKing.displayName.charAt(0)}
                        </div>
                      )}
                      <div>
                        <div className="text-white font-bold text-lg">{garrettKing.displayName}</div>
                        <div className="text-neutral-300 text-sm">@{garrettKing.handle}</div>
                      </div>
                    </div>
                    <div className="absolute top-4 right-4">
                      <span className="px-3 py-1 rounded-full bg-blue-500/20 text-blue-400 text-xs font-medium border border-blue-500/30">
                        Legacy+ Creator
                      </span>
                    </div>
                  </div>
                  <div className="p-4 sm:p-5 md:p-6">
                    <p className="text-sm text-neutral-400 mb-3 sm:mb-4">Explore exclusive content and resources from this featured creator.</p>
                    <div className="inline-flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm font-medium text-white group-hover:text-ccaBlue transition">
                      View Creator Kit
                      <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
        <div className="flex flex-col gap-4 sm:gap-5 md:gap-6 h-full">
          {/* Platform Walkthrough */}
          {dataLoading || !walkthrough ? (
            <div className="bg-neutral-950 border border-neutral-800 rounded-xl sm:rounded-2xl overflow-hidden flex flex-col flex-1">
              <div className="relative aspect-video bg-neutral-900 animate-pulse"></div>
              <div className="p-4 sm:p-5 md:p-6 flex-1 flex flex-col">
                <div className="h-3 bg-neutral-800 rounded w-24 mb-2 animate-pulse"></div>
                <div className="h-6 bg-neutral-800 rounded w-full mb-2 animate-pulse"></div>
                <div className="h-4 bg-neutral-800 rounded w-full mb-4 flex-1 animate-pulse"></div>
                <div className="h-4 bg-neutral-800 rounded w-24 mt-auto animate-pulse"></div>
              </div>
            </div>
          ) : (
            <div className="bg-neutral-950 border border-neutral-800 rounded-xl sm:rounded-2xl overflow-hidden flex flex-col flex-1">
              <div className="relative aspect-video bg-neutral-900">
                {walkthrough.thumbnailUrl ? (
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
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-neutral-500">
                    <svg className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                )}
              </div>
              <div className="p-4 sm:p-5 md:p-6 flex-1 flex flex-col">
                <div className="text-[10px] sm:text-xs text-neutral-400 mb-1.5 sm:mb-2">NEW HERE?</div>
                <h3 className="text-base sm:text-lg font-bold mb-1.5 sm:mb-2 leading-tight">{walkthrough.title}</h3>
                {walkthrough.description && (
                  <p className="text-xs sm:text-sm text-neutral-400 mb-3 sm:mb-4 leading-relaxed flex-1 line-clamp-2">{walkthrough.description}</p>
                )}
                <Link href={walkthrough.playbackId ? `/walkthrough?playbackId=${walkthrough.playbackId}` : '/learn'} className="inline-flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm font-medium text-white active:text-ccaBlue hover:text-ccaBlue transition touch-manipulation mt-auto">
                  Get the Tour
                  <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              </div>
            </div>
          )}

          {/* Featured Asset */}
          {dataLoading || !featuredAsset ? (
            <div className="bg-neutral-950 border border-neutral-800 rounded-xl sm:rounded-2xl overflow-hidden flex flex-col flex-1">
              <div className="relative aspect-video bg-neutral-900 animate-pulse"></div>
              <div className="p-4 sm:p-5 md:p-6 flex-1 flex flex-col">
                <div className="h-3 bg-neutral-800 rounded w-24 mb-2 animate-pulse"></div>
                <div className="h-6 bg-neutral-800 rounded w-full mb-2 animate-pulse"></div>
                <div className="h-4 bg-neutral-800 rounded w-full mb-4 flex-1 animate-pulse"></div>
                <div className="h-4 bg-neutral-800 rounded w-32 mt-auto animate-pulse"></div>
              </div>
            </div>
          ) : (
            <div className="bg-neutral-950 border border-neutral-800 rounded-xl sm:rounded-2xl overflow-hidden flex flex-col flex-1">
              <div className="relative aspect-video bg-neutral-900">
                {featuredAsset.thumbnailUrl && 
                 featuredAsset.thumbnailUrl.startsWith('https://') && 
                 (featuredAsset.thumbnailUrl.includes('firebasestorage.googleapis.com') || 
                  featuredAsset.thumbnailUrl.includes('firebasestorage.app')) ? (
                  <img 
                    src={featuredAsset.thumbnailUrl} 
                    alt={featuredAsset.title}
                    className="w-full h-full object-cover"
                    loading="eager"
                    decoding="async"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-neutral-500">
                    <svg className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                  </div>
                )}
              </div>
              <div className="p-4 sm:p-5 md:p-6 flex-1 flex flex-col">
                <div className="text-[10px] sm:text-xs text-neutral-400 mb-1.5 sm:mb-2">ASSETS</div>
                <h3 className="text-base sm:text-lg font-bold mb-1.5 sm:mb-2 leading-tight">{featuredAsset.title}</h3>
                {featuredAsset.description ? (
                  <p className="text-xs sm:text-sm text-neutral-400 mb-3 sm:mb-4 leading-relaxed flex-1 line-clamp-2">{featuredAsset.description}</p>
                ) : featuredAsset.category ? (
                  <p className="text-xs sm:text-sm text-neutral-400 mb-3 sm:mb-4 leading-relaxed flex-1">{featuredAsset.category}</p>
                ) : null}
                <Link href="/assets" className="inline-flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm font-medium text-white active:text-ccaBlue hover:text-ccaBlue transition touch-manipulation mt-auto">
                  CHECK IT OUT
                  <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Product Packs */}
      <div className="mt-6 sm:mt-7 md:mt-8">
        <h2 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4 leading-tight">Marketplace</h2>
        {dataLoading ? (
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-neutral-950 border border-neutral-800 rounded-lg sm:rounded-xl overflow-hidden">
                <div className="relative aspect-video bg-neutral-900 animate-pulse"></div>
                <div className="p-3 sm:p-4">
                  <div className="h-4 bg-neutral-800 rounded animate-pulse"></div>
                </div>
              </div>
            ))}
          </div>
        ) : products.length > 0 ? (
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
            {products.map((product) => (
              <Link key={product.id} href={`/marketplace`} className="bg-neutral-950 border border-neutral-800 rounded-lg sm:rounded-xl overflow-hidden group cursor-pointer active:border-neutral-700 hover:border-neutral-700 transition touch-manipulation">
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
                      <svg className="w-10 h-10 sm:w-12 sm:h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                  )}
                </div>
                <div className="p-3 sm:p-4">
                  <h3 className="font-semibold text-sm sm:text-base leading-tight mb-1">{product.title}</h3>
                  {product.price !== undefined && (
                    <div className="text-ccaBlue font-medium text-sm">${product.price.toFixed(2)}</div>
                  )}
                  {product.condition && (
                    <div className="text-xs text-neutral-500 mt-1">{product.condition}</div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-neutral-400 text-sm">No marketplace listings available.</div>
        )}
      </div>

      {/* Discounts Section */}
      {discounts.length > 0 && (
        <div className="mt-6 sm:mt-7 md:mt-8">
          <h2 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4 leading-tight">Member Discounts</h2>
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
            {discounts.map((discount) => (
              <Link key={discount.id} href="/discounts" className="rounded-2xl border border-neutral-800 bg-neutral-950 p-5 hover:border-ccaBlue/50 transition-colors flex flex-col h-full">
                {discount.partnerLogoUrl && (
                  <div className="mb-4 flex items-center justify-center h-16">
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
                <div className="text-lg font-semibold mb-1">{discount.title}</div>
                {discount.discountAmount && (
                  <div className="mb-2">
                    <span className="inline-block bg-white text-ccaBlue font-medium text-sm px-2 py-1 rounded">
                      {discount.discountAmount}
                    </span>
                  </div>
                )}
                <div className="text-neutral-400 text-sm mb-4 line-clamp-2 flex-grow">{discount.description}</div>
                <div className="w-full px-4 py-2 rounded-lg bg-ccaBlue hover:opacity-90 transition text-white font-medium mt-auto text-center">
                  View Discount
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
