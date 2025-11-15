"use client";
import { useEffect, useState, Suspense } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';
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
  const router = useRouter();

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

  // Fetch data from Firestore
  useEffect(() => {
    const fetchData = async () => {
      if (!firebaseReady || !db) {
        setDataLoading(false);
        return;
      }

      try {
        // Fetch recent lessons from all courses
        const coursesRef = collection(db, 'courses');
        const coursesSnap = await getDocs(coursesRef);
        const allLessons: Video[] = [];

        for (const courseDoc of coursesSnap.docs) {
          const courseData = courseDoc.data();
          const courseId = courseDoc.id;
          const courseSlug = courseData.slug || courseId;

          try {
            const modulesRef = collection(db, `courses/${courseId}/modules`);
            const modulesSnap = await getDocs(query(modulesRef, orderBy('index', 'asc')));

            for (const moduleDoc of modulesSnap.docs) {
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
            }
          } catch (error) {
            console.error(`Error fetching lessons for course ${courseId}:`, error);
          }
        }

        // Sort by creation date (if available) or use order, limit to 6
        const sortedLessons = allLessons.slice(0, 6);
        setRecentlyAdded(sortedLessons);

        // Fetch marketplace listings
        const listingsRef = collection(db, 'listings');
        const listingsSnap = await getDocs(query(listingsRef, orderBy('createdAt', 'desc'), limit(3)));
        const listingsData: Product[] = [];

        listingsSnap.forEach((doc) => {
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

        // Fetch discounts (if user is authenticated)
        if (user && auth.currentUser) {
          try {
            const idToken = await auth.currentUser.getIdToken();
            const discountsResponse = await fetch('/api/discounts', {
              headers: {
                Authorization: `Bearer ${idToken}`,
              },
            });

            if (discountsResponse.ok) {
              const discountsData = await discountsResponse.json();
              setDiscounts((discountsData.discounts || []).slice(0, 3));
            }
          } catch (error) {
            console.error('Error fetching discounts:', error);
          }
        }

        // Fetch Garrett King's legacy creator data
        try {
          const creatorsResponse = await fetch('/api/legacy/creators');
          if (creatorsResponse.ok) {
            const creatorsData = await creatorsResponse.json();
            const garrett = creatorsData.creators?.find(
              (c: LegacyCreator) => c.handle === 'SHORT' || c.kitSlug === 'garrett-king'
            );
            if (garrett) {
              setGarrettKing(garrett);
            }
          }
        } catch (error) {
          console.error('Error fetching Garrett King:', error);
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

  // Featured Show - keeping existing placeholder for now
  const featuredShow = {
    thumbnail: '/placeholder-video.jpg',
    title: 'CCA Show Episode 006: Ezra Cohen - Building Creative Momentum',
    description: 'In this CCA Show episode, Ezra Cohen opens up about his creative journey, the challenges of building a brand, and the mindset shifts that keep him inspired. From the early days of experimenting with...',
    guest: 'Ezra Cohen',
    handle: '@ezcohen'
  };

  function formatDuration(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  }

  function getMuxThumbnailUrl(playbackId?: string, animatedGifUrl?: string): string {
    if (animatedGifUrl) return animatedGifUrl;
    if (playbackId) return `https://image.mux.com/${playbackId}/thumbnail.jpg?width=640&fit_mode=preserve`;
    return '';
  }

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
          <div className="grid md:grid-cols-2 gap-4 sm:gap-5 md:gap-6">
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
                  
                  <Link href="/assets" className="flex flex-col items-center p-3 sm:p-4 rounded-lg sm:rounded-xl bg-neutral-900 border border-neutral-800 active:border-neutral-700 hover:border-neutral-700 transition-all group touch-manipulation">
                    <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-neutral-800 flex items-center justify-center mb-1.5 sm:mb-2 group-active:bg-neutral-700 group-hover:bg-neutral-700 transition">
                      <svg className="w-5 h-5 sm:w-6 sm:h-6 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </div>
                    <span className="text-[10px] sm:text-xs text-neutral-300 text-center leading-tight">Creator Kits</span>
                  </Link>
                  
                  <a href="#" className="flex flex-col items-center p-3 sm:p-4 rounded-lg sm:rounded-xl bg-neutral-900 border border-neutral-800 active:border-purple-500/30 hover:border-purple-500/30 transition-all group touch-manipulation">
                    <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-purple-500/20 flex items-center justify-center mb-1.5 sm:mb-2 group-active:bg-purple-500/30 group-hover:bg-purple-500/30 transition">
                      <svg className="w-5 h-5 sm:w-6 sm:h-6 text-purple-400" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994a.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.892a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.956-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.946 2.418-2.157 2.418z"/>
                      </svg>
                    </div>
                    <span className="text-[10px] sm:text-xs text-neutral-300 text-center leading-tight">Discord Server</span>
                  </a>
                  
                  <a href="#" className="flex flex-col items-center p-3 sm:p-4 rounded-lg sm:rounded-xl bg-neutral-900 border border-neutral-800 active:border-orange-500/30 hover:border-orange-500/30 transition-all group touch-manipulation">
                    <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-gradient-to-br from-orange-500/20 to-pink-500/20 flex items-center justify-center mb-1.5 sm:mb-2 group-active:from-orange-500/30 group-active:to-pink-500/30 group-hover:from-orange-500/30 group-hover:to-pink-500/30 transition">
                      <svg className="w-5 h-5 sm:w-6 sm:h-6 text-orange-400" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M13.966 22.624l-1.66-4.126-3.027-2.582a.5.5 0 0 1-.224-.423V9.5a.5.5 0 0 1 .13-.337l.5-.5a.5.5 0 0 1 .353-.146h1.5a.5.5 0 0 1 .5.5v.5a.5.5 0 0 0 .5.5h.5a.5.5 0 0 1 .5.5v1a.5.5 0 0 0 .5.5h.5a.5.5 0 0 1 .5.5v1a.5.5 0 0 0 .5.5h.5a.5.5 0 0 1 .5.5v1a.5.5 0 0 0 .5.5h2.5a.5.5 0 0 1 .5.5v.5a.5.5 0 0 1-.064.237l-2.5 5a.5.5 0 0 1-.453.263h-1.5a.5.5 0 0 1-.47-.376zM11.5 15.5a.5.5 0 0 1 .5-.5h.5a.5.5 0 0 1 .5.5v2a.5.5 0 0 1-.5.5h-.5a.5.5 0 0 1-.5-.5v-2z"/>
                      </svg>
                    </div>
                    <span className="text-[10px] sm:text-xs text-neutral-300 text-center leading-tight">Adobe Discount</span>
                  </a>
                </div>
              </div>
            </div>

            {/* Featured Show */}
            <div className="bg-neutral-950 border border-neutral-800 rounded-xl sm:rounded-2xl overflow-hidden">
              <div className="relative aspect-video bg-neutral-900">
                <div className="absolute inset-0 flex items-center justify-center text-neutral-500">
                  <svg className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="absolute bottom-2 sm:bottom-3 md:bottom-4 left-2 sm:left-3 md:left-4">
                  <div className="text-xs sm:text-sm font-semibold text-white">{featuredShow.guest}</div>
                  <div className="text-[10px] sm:text-xs text-neutral-300">{featuredShow.handle}</div>
                </div>
              </div>
              <div className="p-4 sm:p-5 md:p-6">
                <div className="text-[10px] sm:text-xs text-neutral-400 mb-1.5 sm:mb-2">Creator Collective Show</div>
                <h2 className="text-base sm:text-lg md:text-xl font-bold mb-1.5 sm:mb-2 leading-tight">{featuredShow.title}</h2>
                <p className="text-xs sm:text-sm text-neutral-400 line-clamp-2 leading-relaxed">{featuredShow.description}</p>
                <Link href="/show" className="inline-flex items-center gap-1.5 sm:gap-2 mt-3 sm:mt-4 text-xs sm:text-sm font-medium text-white active:text-ccaBlue hover:text-ccaBlue transition touch-manipulation">
                  Watch now
                  <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              </div>
            </div>
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
                  const videoLink = video.courseSlug && video.moduleId && video.lessonId
                    ? `/learn/${video.courseSlug}/module/${video.moduleId}/lesson/${video.lessonId}`
                    : '#';
                  
                  return (
                    <Link key={video.id} href={videoLink} className="flex-shrink-0 w-56 sm:w-64">
                      <div className="relative aspect-video bg-neutral-900 rounded-xl overflow-hidden group cursor-pointer">
                        {thumbnailUrl ? (
                          <img 
                            src={thumbnailUrl} 
                            alt={video.title}
                            className="w-full h-full object-cover"
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
                    </Link>
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
        <div className="space-y-4 sm:space-y-5 md:space-y-6">
          {/* Platform Walkthrough */}
          <div className="bg-neutral-950 border border-neutral-800 rounded-xl sm:rounded-2xl overflow-hidden">
            <div className="relative aspect-video bg-neutral-900">
              <div className="absolute inset-0 flex items-center justify-center text-neutral-500">
                <svg className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <div className="p-4 sm:p-5 md:p-6">
              <div className="text-[10px] sm:text-xs text-neutral-400 mb-1.5 sm:mb-2">NEW HERE?</div>
              <h3 className="text-base sm:text-lg font-bold mb-1.5 sm:mb-2 leading-tight">Get Started: Platform Walkthrough</h3>
              <p className="text-xs sm:text-sm text-neutral-400 mb-3 sm:mb-4 leading-relaxed">Learn how to navigate the platform to unlock all the features.</p>
              <Link href="/learn" className="inline-flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm font-medium text-white active:text-ccaBlue hover:text-ccaBlue transition touch-manipulation">
                Get the Tour
                <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>
          </div>

          {/* Overlay+ Plugin */}
          <div className="bg-neutral-950 border border-neutral-800 rounded-xl sm:rounded-2xl overflow-hidden">
            <div className="relative aspect-video bg-neutral-900">
              <div className="absolute inset-0 flex items-center justify-center text-neutral-500">
                <div className="text-center">
                  <div className="text-3xl sm:text-4xl mb-2">🎛️</div>
                  <div className="text-[10px] sm:text-xs">Lo-Fi FX</div>
                </div>
              </div>
            </div>
            <div className="p-4 sm:p-5 md:p-6">
              <div className="text-[10px] sm:text-xs text-neutral-400 mb-1.5 sm:mb-2">OVERLAY+</div>
              <h3 className="text-base sm:text-lg font-bold mb-1.5 sm:mb-2 leading-tight">New Release: Lo-Fi FX Plugin</h3>
              <p className="text-xs sm:text-sm text-neutral-400 mb-3 sm:mb-4 leading-relaxed">Give your audio that nostalgic, radio-style vibe. Midrange warmth, filtered clarity, and analog soul with just one knob.</p>
              <a href="#" className="inline-flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm font-medium text-white active:text-ccaBlue hover:text-ccaBlue transition touch-manipulation">
                CHECK IT OUT
                <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </a>
            </div>
          </div>
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
              <Link key={discount.id} href="/discounts" className="bg-neutral-950 border border-neutral-800 rounded-lg sm:rounded-xl overflow-hidden group cursor-pointer hover:border-ccaBlue/50 transition">
                <div className="p-4 sm:p-5">
                  {discount.partnerLogoUrl && (
                    <div className="mb-3">
                      <img 
                        src={discount.partnerLogoUrl} 
                        alt={discount.partnerName}
                        className="h-8 object-contain"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    </div>
                  )}
                  <h3 className="font-semibold text-base sm:text-lg mb-2">{discount.title}</h3>
                  <p className="text-sm text-neutral-400 mb-3 line-clamp-2">{discount.description}</p>
                  {discount.discountAmount && (
                    <div className="text-ccaBlue font-bold text-lg mb-2">{discount.discountAmount}</div>
                  )}
                  <div className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-medium text-white group-hover:text-ccaBlue transition">
                    View Discount
                    <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
