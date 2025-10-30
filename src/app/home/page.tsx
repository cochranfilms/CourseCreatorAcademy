"use client";
import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import Image from 'next/image';
import Link from 'next/link';
import { doc, getDoc } from 'firebase/firestore';
import { db, firebaseReady } from '@/lib/firebaseClient';

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
};

type Product = {
  id: string;
  title: string;
  image: string;
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

export default function HomePage() {
  const { user, loading } = useAuth();
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [userMemberSince, setUserMemberSince] = useState<Date | null>(null);

  useEffect(() => {
    if (user && firebaseReady && db) {
      // Get member since date from Firebase Auth metadata
      if (user.metadata.creationTime) {
        setUserMemberSince(new Date(user.metadata.creationTime));
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
              memberSince: data.memberSince || formatMemberSince(user.metadata.creationTime ? new Date(user.metadata.creationTime) : null),
              memberTag: data.memberTag || 'Member'
            });
          } else {
            // Use Firebase Auth data
            setUserProfile({
              displayName: user.displayName || user.email?.split('@')[0] || 'Creator',
              photoURL: user.photoURL || undefined,
              memberSince: formatMemberSince(userMemberSince),
              memberTag: 'Member'
            });
          }
        } catch (error) {
          console.error('Error fetching profile:', error);
          // Fallback to Firebase Auth data
          setUserProfile({
            displayName: user.displayName || user.email?.split('@')[0] || 'Creator',
            photoURL: user.photoURL || undefined,
            memberSince: formatMemberSince(userMemberSince),
            memberTag: 'Member'
          });
        }
      };

      fetchProfile();
    }
  }, [user, userMemberSince]);

  const displayName = userProfile?.displayName || user?.displayName || user?.email?.split('@')[0] || 'Creator';
  const photoURL = userProfile?.photoURL || user?.photoURL;
  const memberSince = userProfile?.memberSince || formatMemberSince(userMemberSince);
  const memberTag = userProfile?.memberTag || 'Member';

  // Sample data - replace with actual data from Firestore/Firebase
  const featuredShow = {
    thumbnail: '/placeholder-video.jpg',
    title: 'FTF Show Episode 006: Ezra Cohen - Building Creative Momentum',
    description: 'In this FTF Show episode, Ezra Cohen opens up about his creative journey, the challenges of building a brand, and the mindset shifts that keep him inspired. From the early days of experimenting with...',
    guest: 'Ezra Cohen',
    handle: '@ezcohen'
  };

  const recentlyAdded: Video[] = [
    { id: '1', title: 'EP04 - Lamborghini Shoot: Behind the Scenes', thumbnail: '/placeholder-video.jpg', duration: '8:00', overlay: 'BEHIND THE SCENES' },
    { id: '2', title: 'EP02 - How I Color Grade My Footage', thumbnail: '/placeholder-video.jpg', duration: '23:00', overlay: 'HOW I COLOR GRADE MY FOOTAGE' },
    { id: '3', title: 'EP02 - A Welcome Video from Pete', thumbnail: '/placeholder-video.jpg', duration: '8:00', overlay: 'A WELCOME VIDEO FROM Pete' },
    { id: '4', title: 'Backstage EP2 - The Getaway: Polestar...', thumbnail: '/placeholder-video.jpg', duration: '21:00', overlay: 'BACKSTAGE' },
    { id: '5', title: 'EP03 - My Photography Gear', thumbnail: '/placeholder-video.jpg', duration: '10:00', overlay: 'GEAR' },
    { id: '6', title: 'Backstage EP3 - Run & Gun: Fashion Grit with...', thumbnail: '/placeholder-video.jpg', duration: '7:00', overlay: 'BACKSTAGE' },
  ];

  const products: Product[] = [
    { id: '1', title: 'CineLog - DJI D-Log / D-Log M LUTs', image: '/placeholder-product.jpg' },
    { id: '2', title: 'Arrows Animation Pack - VOL.1', image: '/placeholder-product.jpg' },
    { id: '3', title: 'Bubble Wrap Transitions for Premiere Pro', image: '/placeholder-product.jpg' },
  ];

  if (loading) {
    return (
      <main className="max-w-7xl mx-auto px-6 py-8">
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
    <main className="max-w-7xl mx-auto px-6 py-8">
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left Column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Top Section: Profile and Featured Show */}
          <div className="grid md:grid-cols-2 gap-6">
            {/* Profile Section */}
            <div className="bg-neutral-950 border border-neutral-800 rounded-2xl p-6">
              <h1 className="text-2xl font-bold mb-4">{getGreeting()}, {displayName.split(' ')[0]}.</h1>
              <div className="flex items-center gap-3 mb-4">
                <div className="relative w-16 h-16 rounded-full overflow-hidden bg-neutral-800 border-2 border-neutral-700">
                  {photoURL ? (
                    <Image src={photoURL} alt={displayName} fill className="object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-2xl font-semibold bg-ccaBlue text-white">
                      {displayName.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-lg">{displayName}</div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 text-xs font-medium border border-red-500/30">
                      {memberTag}
                    </span>
                    <span className="text-xs text-neutral-500">Member since {memberSince}</span>
                  </div>
                </div>
              </div>

              <div className="mt-6">
                <h2 className="text-sm font-semibold text-neutral-400 mb-3">Quick Access</h2>
                <div className="grid grid-cols-2 gap-3">
                  <Link href="/opportunities" className="flex flex-col items-center p-4 rounded-xl bg-neutral-900 border border-neutral-800 hover:border-red-500/30 transition-all group">
                    <div className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center mb-2 group-hover:bg-red-500/30 transition">
                      <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
                      </svg>
                    </div>
                    <span className="text-xs text-neutral-300 text-center">Post an Opportunity</span>
                  </Link>
                  
                  <Link href="/assets" className="flex flex-col items-center p-4 rounded-xl bg-neutral-900 border border-neutral-800 hover:border-neutral-700 transition-all group">
                    <div className="w-10 h-10 rounded-lg bg-neutral-800 flex items-center justify-center mb-2 group-hover:bg-neutral-700 transition">
                      <svg className="w-6 h-6 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </div>
                    <span className="text-xs text-neutral-300 text-center">Creator Kits</span>
                  </Link>
                  
                  <a href="#" className="flex flex-col items-center p-4 rounded-xl bg-neutral-900 border border-neutral-800 hover:border-purple-500/30 transition-all group">
                    <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center mb-2 group-hover:bg-purple-500/30 transition">
                      <svg className="w-6 h-6 text-purple-400" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994a.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.892a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.956-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.946 2.418-2.157 2.418z"/>
                      </svg>
                    </div>
                    <span className="text-xs text-neutral-300 text-center">Discord Server</span>
                  </a>
                  
                  <a href="#" className="flex flex-col items-center p-4 rounded-xl bg-neutral-900 border border-neutral-800 hover:border-orange-500/30 transition-all group">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-orange-500/20 to-pink-500/20 flex items-center justify-center mb-2 group-hover:from-orange-500/30 group-hover:to-pink-500/30 transition">
                      <svg className="w-6 h-6 text-orange-400" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M13.966 22.624l-1.66-4.126-3.027-2.582a.5.5 0 0 1-.224-.423V9.5a.5.5 0 0 1 .13-.337l.5-.5a.5.5 0 0 1 .353-.146h1.5a.5.5 0 0 1 .5.5v.5a.5.5 0 0 0 .5.5h.5a.5.5 0 0 1 .5.5v1a.5.5 0 0 0 .5.5h.5a.5.5 0 0 1 .5.5v1a.5.5 0 0 0 .5.5h.5a.5.5 0 0 1 .5.5v1a.5.5 0 0 0 .5.5h2.5a.5.5 0 0 1 .5.5v.5a.5.5 0 0 1-.064.237l-2.5 5a.5.5 0 0 1-.453.263h-1.5a.5.5 0 0 1-.47-.376zM11.5 15.5a.5.5 0 0 1 .5-.5h.5a.5.5 0 0 1 .5.5v2a.5.5 0 0 1-.5.5h-.5a.5.5 0 0 1-.5-.5v-2z"/>
                      </svg>
                    </div>
                    <span className="text-xs text-neutral-300 text-center">Adobe Discount</span>
                  </a>
                </div>
              </div>
            </div>

            {/* Featured Show */}
            <div className="bg-neutral-950 border border-neutral-800 rounded-2xl overflow-hidden">
              <div className="relative aspect-video bg-neutral-900">
                <div className="absolute inset-0 flex items-center justify-center text-neutral-500">
                  <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="absolute bottom-4 left-4">
                  <div className="text-sm font-semibold text-white">{featuredShow.guest}</div>
                  <div className="text-xs text-neutral-300">{featuredShow.handle}</div>
                </div>
              </div>
              <div className="p-6">
                <div className="text-xs text-neutral-400 mb-2">FTF SHOW</div>
                <h2 className="text-xl font-bold mb-2">{featuredShow.title}</h2>
                <p className="text-sm text-neutral-400 line-clamp-2">{featuredShow.description}</p>
                <Link href="/show" className="inline-flex items-center gap-2 mt-4 text-sm font-medium text-white hover:text-ccaBlue transition">
                  Watch now
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              </div>
            </div>
          </div>

          {/* Recently Added */}
          <div>
            <h2 className="text-xl font-bold mb-4">Recently Added</h2>
            <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide">
              {recentlyAdded.map((video) => (
                <div key={video.id} className="flex-shrink-0 w-64">
                  <div className="relative aspect-video bg-neutral-900 rounded-xl overflow-hidden group cursor-pointer">
                    <div className="absolute inset-0 flex items-center justify-center text-neutral-500">
                      <svg className="w-12 h-12 group-hover:scale-110 transition" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
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
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Platform Walkthrough */}
          <div className="bg-neutral-950 border border-neutral-800 rounded-2xl overflow-hidden">
            <div className="relative aspect-video bg-neutral-900">
              <div className="absolute inset-0 flex items-center justify-center text-neutral-500">
                <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <div className="p-6">
              <div className="text-xs text-neutral-400 mb-2">NEW HERE?</div>
              <h3 className="text-lg font-bold mb-2">Get Started: Platform Walkthrough</h3>
              <p className="text-sm text-neutral-400 mb-4">Learn how to navigate the platform to unlock all the features.</p>
              <Link href="/learn" className="inline-flex items-center gap-2 text-sm font-medium text-white hover:text-ccaBlue transition">
                Get the Tour
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>
          </div>

          {/* Overlay+ Plugin */}
          <div className="bg-neutral-950 border border-neutral-800 rounded-2xl overflow-hidden">
            <div className="relative aspect-video bg-neutral-900">
              <div className="absolute inset-0 flex items-center justify-center text-neutral-500">
                <div className="text-center">
                  <div className="text-4xl mb-2">🎛️</div>
                  <div className="text-xs">Lo-Fi FX</div>
                </div>
              </div>
            </div>
            <div className="p-6">
              <div className="text-xs text-neutral-400 mb-2">OVERLAY+</div>
              <h3 className="text-lg font-bold mb-2">New Release: Lo-Fi FX Plugin</h3>
              <p className="text-sm text-neutral-400 mb-4">Give your audio that nostalgic, radio-style vibe. Midrange warmth, filtered clarity, and analog soul with just one knob.</p>
              <a href="#" className="inline-flex items-center gap-2 text-sm font-medium text-white hover:text-ccaBlue transition">
                CHECK IT OUT
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Product Packs */}
      <div className="mt-8">
        <h2 className="text-xl font-bold mb-4">Product Packs</h2>
        <div className="grid md:grid-cols-3 gap-4">
          {products.map((product) => (
            <div key={product.id} className="bg-neutral-950 border border-neutral-800 rounded-xl overflow-hidden group cursor-pointer hover:border-neutral-700 transition">
              <div className="relative aspect-video bg-neutral-900">
                <div className="absolute inset-0 flex items-center justify-center text-neutral-500">
                  <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
              </div>
              <div className="p-4">
                <h3 className="font-semibold">{product.title}</h3>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
