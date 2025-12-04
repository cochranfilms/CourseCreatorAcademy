"use client";

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc, getDoc, collection, query, where, getDocs, orderBy, QueryDocumentSnapshot, DocumentData } from 'firebase/firestore';
import { db, firebaseReady, auth } from '@/lib/firebaseClient';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';
import Image from 'next/image';
import { Messages } from '@/components/Messages';
import { LegacyUpgradeModal } from '@/components/LegacyUpgradeModal';
import { JobApplicationModal } from '@/components/JobApplicationModal';

type UserProfile = {
  displayName?: string;
  handle?: string;
  title?: string;
  specialties?: string;
  location?: string;
  bio?: string;
  skills?: string[];
  linkedin?: string;
  instagram?: string;
  youtube?: string;
  profilePublic?: boolean;
  photoURL?: string;
  bannerUrl?: string;
};

type Listing = {
  id: string;
  title: string;
  price: number;
  condition: string;
  createdAt?: any;
  images?: string[];
  description?: string;
};

type Course = {
  id: string;
  title: string;
  slug: string;
  summary?: string;
  coverImage?: string;
  lessonsCount: number;
  modulesCount: number;
  thumbnailPlaybackId?: string;
  thumbnailDurationSec?: number;
};

type Opportunity = {
  id: string;
  title: string;
  company?: string;
  location?: string;
  type?: string;
  posted?: any;
  posterId?: string;
  amount?: number; // Total job amount in cents
};

type Project = {
  id: string;
  title: string;
  description?: string;
  preview?: string;
  imageUrl?: string;
  url?: string;
  createdAt?: any;
  skills?: string[];
};

function getMuxThumbnailUrl(playbackId?: string, durationSec?: number) {
  if (!playbackId) return '';
  const time = durationSec && durationSec > 0 ? Math.floor(durationSec / 2) : 1;
  return `https://image.mux.com/${playbackId}/thumbnail.jpg?time=${time}&width=640&fit_mode=preserve`;
}

function formatDate(timestamp: any): string {
  if (!timestamp) return '';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function getInitials(name: string, email?: string): string {
  if (name) {
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.charAt(0).toUpperCase();
  }
  if (email) {
    return email.charAt(0).toUpperCase();
  }
  return '?';
}

function getSocialMediaUrl(platform: 'linkedin' | 'instagram' | 'youtube', username: string): string {
  if (!username || username.trim() === '') return '';
  
  const cleanUsername = username.trim();
  
  // If it's already a full URL, return it as-is
  if (cleanUsername.startsWith('http://') || cleanUsername.startsWith('https://')) {
    return cleanUsername;
  }
  
  switch (platform) {
    case 'linkedin':
      return `https://www.linkedin.com/in/${cleanUsername}`;
    case 'instagram':
      // Remove @ if present
      const instagramHandle = cleanUsername.replace(/^@/, '');
      return `https://www.instagram.com/${instagramHandle}/`;
    case 'youtube':
      // Remove @ if present (YouTube handles can be with or without @)
      const youtubeHandle = cleanUsername.replace(/^@/, '');
      return `https://www.youtube.com/@${youtubeHandle}`;
    default:
      return '';
  }
}

export default function ProfilePage() {
  const params = useParams();
  const router = useRouter();
  const { user: currentUser } = useAuth();
  const userId = params?.id as string;
  
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [listings, setListings] = useState<Listing[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [memberSince, setMemberSince] = useState<Date | null>(null);
  const [hasLegacySub, setHasLegacySub] = useState(false);
  const [showLegacyModal, setShowLegacyModal] = useState(false);
  const [showApplicationModal, setShowApplicationModal] = useState(false);
  const [selectedOpportunity, setSelectedOpportunity] = useState<Opportunity | null>(null);
  const [appliedOpportunityIds, setAppliedOpportunityIds] = useState<Set<string>>(new Set());
  const [following, setFollowing] = useState<Array<{ id: string; displayName: string; handle?: string; photoURL?: string }>>([]);
  const [followers, setFollowers] = useState<Array<{ id: string; displayName: string; handle?: string; photoURL?: string }>>([]);
  const [followingCount, setFollowingCount] = useState(0);
  const [followersCount, setFollowersCount] = useState(0);
  const [loadingFollows, setLoadingFollows] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [isFollowingLoading, setIsFollowingLoading] = useState(false);

  // If this is a legacy creator, redirect to their public legacy kit page
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        if (!userId) return;
        const res = await fetch(`/api/legacy/creators/${encodeURIComponent(userId)}?soft=1`, { cache: 'no-store' });
        const json = await res.json().catch(() => null);
        const creator = json?.creator || null;
        if (!cancelled && creator && (creator.kitSlug || creator.id)) {
          const slug = creator.kitSlug || creator.id;
          router.replace(`/learn?section=creator-kits&kit=${encodeURIComponent(slug)}`);
        }
      } catch {}
    };
    run();
    return () => { cancelled = true; };
  }, [userId, router]);

  useEffect(() => {
    if (!userId || !firebaseReady || !db) {
      setLoading(false);
      return;
    }

    const fetchProfile = async () => {
      try {
        const userDoc = await getDoc(doc(db, 'users', userId));
        
        if (!userDoc.exists()) {
          setNotFound(true);
          setLoading(false);
          return;
        }

        const data = userDoc.data() as UserProfile;
        
        // Check if profile is public (unless viewing own profile)
        if (data.profilePublic === false && currentUser?.uid !== userId) {
          setProfile({ profilePublic: false });
          setLoading(false);
          return;
        }

        setProfile(data);
        
        // Get member since date if available
        const userData = userDoc.data();
        if (userData.createdAt) {
          const createdAt = (userData.createdAt as any).toDate ? (userData.createdAt as any).toDate() : new Date(userData.createdAt);
          setMemberSince(createdAt);
        } else {
          // Use document creation time as fallback
          setMemberSince(null);
        }

        // Fetch user's marketplace listings
        try {
          const listingsQuery = query(
            collection(db, 'listings'),
            where('creatorId', '==', userId),
            orderBy('createdAt', 'desc')
          );
          const listingsSnap = await getDocs(listingsQuery);
          const listingsData: Listing[] = listingsSnap.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          } as Listing));
          setListings(listingsData);
        } catch (error) {
          console.error('Error fetching listings:', error);
        }

        // We are no longer surfacing courses on the public profile.
        setCourses([]);

        // Fetch user's projects
        try {
          let projectsDocs: QueryDocumentSnapshot<DocumentData>[];
          try {
            const projectsQuery = query(
              collection(db, 'projects'),
              where('creatorId', '==', userId),
              orderBy('createdAt', 'desc')
            );
            const projectsSnap = await getDocs(projectsQuery);
            projectsDocs = projectsSnap.docs;
          } catch (queryError: any) {
            console.warn('Projects query failed, falling back to client-side filter:', queryError);
            const allProjectsSnap = await getDocs(collection(db, 'projects'));
            projectsDocs = allProjectsSnap.docs.filter(doc => doc.data().creatorId === userId);
          }

          const projectsData: Project[] = projectsDocs.map((docSnap) => {
            const d: any = docSnap.data();
            return {
              id: docSnap.id,
              title: d.title || 'Untitled Project',
              description: d.description,
              preview: d.preview,
              imageUrl: d.imageUrl,
              url: d.url,
              createdAt: d.createdAt,
              skills: Array.isArray(d.skills) ? d.skills : [],
            } as Project;
          });

          setProjects(projectsData);
        } catch (error) {
          console.error('Error fetching projects:', error);
          setProjects([]);
        }

        // Fetch user's posted opportunities
        try {
          let oppDocs: QueryDocumentSnapshot<DocumentData>[];
          try {
            const oppQuery = query(
              collection(db, 'opportunities'),
              where('posterId', '==', userId),
              orderBy('posted', 'desc')
            );
            const oppSnap = await getDocs(oppQuery);
            oppDocs = oppSnap.docs;
          } catch (queryError: any) {
            console.warn('Opportunities query failed, falling back to client-side filter:', queryError);
            const allOppSnap = await getDocs(collection(db, 'opportunities'));
            oppDocs = allOppSnap.docs.filter(doc => doc.data().posterId === userId);
          }
          const oppData: Opportunity[] = oppDocs.map((d) => {
            const x: any = d.data();
            return {
              id: d.id,
              title: x.title || 'Opportunity',
              company: x.company,
              location: x.location,
              type: x.type,
              posted: x.posted,
              posterId: x.posterId,
              amount: x.amount
            };
          });
          setOpportunities(oppData);
        } catch (error) {
          console.error('Error fetching opportunities:', error);
          setOpportunities([]);
        }

        // Fetch following and followers
        setLoadingFollows(true);
        try {
          // Get following
          const followingSnap = await getDocs(collection(db, 'users', userId, 'following'));
          const followingIds = followingSnap.docs.map(doc => doc.id);
          setFollowingCount(followingIds.length);
          
          const followingData: Array<{ id: string; displayName: string; handle?: string; photoURL?: string }> = [];
          for (const followId of followingIds.slice(0, 20)) { // Limit to 20 for performance
            try {
              const followUserDoc = await getDoc(doc(db, 'users', followId));
              if (followUserDoc.exists()) {
                const followData = followUserDoc.data();
                followingData.push({
                  id: followId,
                  displayName: followData.displayName || followData.handle || 'Unknown User',
                  handle: followData.handle,
                  photoURL: followData.photoURL,
                });
              }
            } catch (error) {
              console.error(`Error fetching following user ${followId}:`, error);
            }
          }
          setFollowing(followingData);

          // Get followers
          const followersSnap = await getDocs(collection(db, 'users', userId, 'followers'));
          const followerIds = followersSnap.docs.map(doc => doc.id);
          setFollowersCount(followerIds.length);
          
          const followersData: Array<{ id: string; displayName: string; handle?: string; photoURL?: string }> = [];
          for (const followerId of followerIds.slice(0, 20)) { // Limit to 20 for performance
            try {
              const followerUserDoc = await getDoc(doc(db, 'users', followerId));
              if (followerUserDoc.exists()) {
                const followerData = followerUserDoc.data();
                followersData.push({
                  id: followerId,
                  displayName: followerData.displayName || followerData.handle || 'Unknown User',
                  handle: followerData.handle,
                  photoURL: followerData.photoURL,
                });
              }
            } catch (error) {
              console.error(`Error fetching follower user ${followerId}:`, error);
            }
          }
          setFollowers(followersData);
        } catch (error) {
          console.error('Error fetching follows:', error);
        } finally {
          setLoadingFollows(false);
        }

        // Check if current user is following this profile user
        if (currentUser && currentUser.uid !== userId) {
          try {
            const followDoc = await getDoc(doc(db, 'users', currentUser.uid, 'following', userId));
            setIsFollowing(followDoc.exists());
          } catch (error) {
            console.error('Error checking follow status:', error);
          }
        }

      } catch (error) {
        console.error('Error fetching profile:', error);
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [userId, currentUser]);

  // Handle follow/unfollow
  const handleFollow = async () => {
    if (!currentUser || !auth || currentUser.uid === userId || isFollowingLoading) return;
    
    setIsFollowingLoading(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) return;

      const method = isFollowing ? 'DELETE' : 'POST';
      const url = isFollowing
        ? `/api/message-board/follow?targetUserId=${userId}`
        : '/api/message-board/follow';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        ...(method === 'POST' && { body: JSON.stringify({ targetUserId: userId }) }),
      });

      if (response.ok) {
        setIsFollowing(!isFollowing);
        // Update followers count
        if (isFollowing) {
          setFollowersCount(prev => Math.max(0, prev - 1));
        } else {
          setFollowersCount(prev => prev + 1);
        }
      } else {
        const error = await response.json();
        console.error('Error toggling follow:', error);
      }
    } catch (error) {
      console.error('Error toggling follow:', error);
    } finally {
      setIsFollowingLoading(false);
    }
  };

  // Determine if viewing user has an active Legacy+ subscription (to toggle badges/CTAs)
  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      if (!currentUser) { setHasLegacySub(false); return; }
      try {
        let active = false;
        try {
          const res = await fetch(`/api/legacy/subscriptions?userId=${currentUser.uid}`, { cache: 'no-store' });
          const json = await res.json();
          if (res.ok && Array.isArray(json.subscriptions)) {
            active = json.subscriptions.length > 0;
          }
        } catch {}

        if (!active && firebaseReady && db) {
          try {
            const { collection, query, where, getDocs } = await import('firebase/firestore');
            const q = query(collection(db, 'legacySubscriptions'), where('userId', '==', currentUser.uid));
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
  }, [currentUser]);

  // Fetch applied opportunities for current user
  useEffect(() => {
    if (!firebaseReady || !db || !currentUser) {
      setAppliedOpportunityIds(new Set());
      return;
    }

    const fetchAppliedOpportunities = async () => {
      try {
        const appliedQuery = query(
          collection(db, 'jobApplications'),
          where('applicantId', '==', currentUser.uid)
        );
        const appliedSnap = await getDocs(appliedQuery);
        const appliedIds = new Set(appliedSnap.docs.map(doc => doc.data().opportunityId));
        setAppliedOpportunityIds(appliedIds);
      } catch (error) {
        console.error('Error fetching applied opportunities:', error);
      }
    };

    fetchAppliedOpportunities();
  }, [currentUser]);

  if (loading) {
    return (
      <main className="min-h-screen max-w-7xl mx-auto px-6 py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="inline-block animate-spin h-16 w-16 border-4 border-ccaBlue/30 border-t-ccaBlue rounded-full mb-6"></div>
            <p className="text-neutral-400 text-lg font-semibold">Loading profile...</p>
          </div>
        </div>
      </main>
    );
  }

  if (notFound) {
    return (
      <main className="min-h-screen max-w-7xl mx-auto px-6 py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center bg-gradient-to-br from-neutral-900/90 via-neutral-900/80 to-neutral-950/90 backdrop-blur-xl border-2 border-neutral-800/60 p-12 rounded-2xl shadow-xl shadow-black/30 max-w-md">
            <h1 className="text-3xl font-extrabold text-white mb-3 tracking-tight">Profile Not Found</h1>
            <p className="text-neutral-400 mb-8 text-lg font-medium">The user profile you're looking for doesn't exist.</p>
            <Link href="/home" className="inline-block px-6 py-3 bg-gradient-to-r from-ccaBlue to-blue-600 hover:from-blue-600 hover:to-ccaBlue text-white font-bold rounded-xl transition-all duration-200 shadow-lg shadow-ccaBlue/30 hover:shadow-xl hover:shadow-ccaBlue/50 transform hover:scale-105 active:scale-95">Return to Home</Link>
          </div>
        </div>
      </main>
    );
  }

  if (profile?.profilePublic === false && currentUser?.uid !== userId) {
    return (
      <main className="min-h-screen max-w-7xl mx-auto px-6 py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center bg-gradient-to-br from-neutral-900/90 via-neutral-900/80 to-neutral-950/90 backdrop-blur-xl border-2 border-neutral-800/60 p-12 rounded-2xl shadow-xl shadow-black/30 max-w-md">
            <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-neutral-800 to-neutral-900 flex items-center justify-center mx-auto mb-6 border-2 border-neutral-700 shadow-lg">
              <svg className="w-12 h-12 text-neutral-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h1 className="text-3xl font-extrabold text-white mb-3 tracking-tight">Private Profile</h1>
            <p className="text-neutral-400 text-lg font-medium">This profile is set to private.</p>
          </div>
        </div>
      </main>
    );
  }

  const displayName = profile?.displayName || 'Creator';
  const handle = profile?.handle;
  const photoURL = profile?.photoURL;
  const specialtyList = (profile?.specialties || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

  return (
    <main className="min-h-screen max-w-7xl mx-auto px-3 sm:px-4 md:px-5 py-4 sm:py-5 md:py-6">
      {/* Profile Banner */}
      <div className="mb-5 sm:mb-6 rounded-xl overflow-hidden border border-neutral-800/60 shadow-xl shadow-black/50 bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950">
        <div
          className="h-24 sm:h-32 md:h-40 w-full bg-gradient-to-br from-neutral-900 via-neutral-800 to-neutral-900 relative overflow-hidden"
          style={profile?.bannerUrl ? { backgroundImage: `url(${profile.bannerUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}}
        >
          {!profile?.bannerUrl && (
            <div className="absolute inset-0 bg-gradient-to-br from-ccaBlue/10 via-transparent to-red-500/10" />
          )}
        </div>
        {/* Profile Header */}
        <div className="bg-gradient-to-b from-neutral-950/95 via-neutral-950/90 to-neutral-950 backdrop-blur-xl p-4 sm:p-5 md:p-6 border-t border-neutral-800/50">
          <div className="flex flex-col sm:flex-row items-start sm:items-end gap-4 sm:gap-5">
          {/* Profile Photo */}
          <div className="relative -mt-12 sm:-mt-14 md:-mt-16 flex-shrink-0">
            <div className="relative w-20 h-20 sm:w-24 sm:h-24 md:w-28 md:h-28 rounded-xl overflow-hidden bg-gradient-to-br from-neutral-800 to-neutral-900 flex-shrink-0 border-3 border-neutral-950 shadow-xl shadow-black/50 ring-1 ring-neutral-700/50">
              {photoURL ? (
                <img
                  src={photoURL}
                  alt={displayName}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                    const parent = e.currentTarget.parentElement;
                    if (parent) {
                      parent.innerHTML = `<div class="w-full h-full flex items-center justify-center text-xl sm:text-2xl font-bold bg-gradient-to-br from-ccaBlue to-blue-600 text-white">${displayName.charAt(0).toUpperCase()}</div>`;
                    }
                  }}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-xl sm:text-2xl font-bold bg-gradient-to-br from-ccaBlue to-blue-600 text-white">
                  {displayName.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
          </div>

            {/* Profile Info */}
            <div className="flex-1 min-w-0 pt-2 sm:pt-0">
              <div className="flex flex-col gap-3 mb-4">
                <div className="min-w-0">
                  <h1 className="text-xl sm:text-2xl font-bold text-white mb-1 break-words tracking-tight leading-tight">
                    {displayName}
                  </h1>
                  {handle && (
                    <p className="text-neutral-400 text-sm break-words font-medium mb-2">@{handle}</p>
                  )}
                  {profile?.title && (
                    <p className="text-neutral-200 mt-1 text-sm sm:text-base break-words font-semibold leading-relaxed">{profile.title}</p>
                  )}
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  {currentUser && currentUser.uid !== userId && (
                    <>
                      <button
                        onClick={handleFollow}
                        disabled={isFollowingLoading}
                        className={`font-semibold py-2 px-4 rounded-lg transition-all duration-200 flex items-center justify-center gap-1.5 touch-manipulation min-h-[36px] text-xs sm:text-sm w-full sm:w-auto disabled:opacity-50 disabled:cursor-not-allowed shadow-md transform hover:scale-[1.02] active:scale-[0.98] ${
                          isFollowing
                            ? 'bg-gradient-to-r from-ccaBlue/20 to-blue-500/20 text-white border border-ccaBlue/50 hover:from-ccaBlue/30 hover:to-blue-500/30 hover:border-ccaBlue/70 backdrop-blur-sm'
                            : 'bg-gradient-to-r from-ccaBlue to-blue-600 hover:from-blue-600 hover:to-ccaBlue text-white shadow-ccaBlue/50'
                        }`}
                      >
                        {isFollowingLoading ? (
                          <>
                            <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                            <span className="hidden sm:inline">Loading...</span>
                          </>
                        ) : (
                          <>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d={isFollowing ? "M5 13l4 4L19 7" : "M12 4v16m8-8H4"} />
                            </svg>
                            {isFollowing ? 'Following' : 'Follow'}
                          </>
                        )}
                      </button>
                      <button
                        onClick={() => setShowMessageModal(true)}
                        className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white font-semibold py-2 px-4 rounded-lg transition-all duration-200 flex items-center justify-center gap-1.5 touch-manipulation min-h-[36px] text-xs sm:text-sm w-full sm:w-auto shadow-md shadow-red-500/30 transform hover:scale-[1.02] active:scale-[0.98]"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                        Message
                      </button>
                    </>
                  )}

                  {/* When viewing own profile, show Legacy Subscriptions / Upgrade CTA (opens modal) */}
                  {currentUser && currentUser.uid === userId && (
                    <button
                      onClick={() => setShowLegacyModal(true)}
                      className="px-3 sm:px-4 py-2 bg-gradient-to-r from-orange-500 via-red-500 to-red-600 hover:from-orange-600 hover:via-red-600 hover:to-red-700 text-white font-semibold rounded-lg transition-all duration-200 touch-manipulation min-h-[36px] text-xs sm:text-sm w-full sm:w-auto whitespace-nowrap shadow-md shadow-orange-500/30 transform hover:scale-[1.02] active:scale-[0.98]"
                    >
                      {hasLegacySub ? (
                        <>
                          <span className="hidden sm:inline">Legacy+</span>
                          <span className="sm:hidden">Legacy+</span>
                        </>
                      ) : (
                        <>
                          <span className="hidden sm:inline">Upgrade</span>
                          <span className="sm:hidden">Upgrade</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Section (Listings, Opportunities, Member Since) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 mb-5 sm:mb-6">
        <div className="bg-gradient-to-br from-neutral-900/90 via-neutral-900/80 to-neutral-950/90 backdrop-blur-xl border border-neutral-800/60 p-4 rounded-xl text-center shadow-lg shadow-black/30 hover:shadow-xl hover:shadow-black/50 transition-all duration-300 hover:border-neutral-700/60 hover:-translate-y-0.5">
          <div className="text-2xl sm:text-3xl font-bold text-white mb-1">
            {listings.length}
          </div>
          <div className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">{listings.length === 1 ? 'Listing' : 'Listings'}</div>
        </div>
        <div className="bg-gradient-to-br from-neutral-900/90 via-neutral-900/80 to-neutral-950/90 backdrop-blur-xl border border-neutral-800/60 p-4 rounded-xl text-center shadow-lg shadow-black/30 hover:shadow-xl hover:shadow-black/50 transition-all duration-300 hover:border-neutral-700/60 hover:-translate-y-0.5">
          <div className="text-2xl sm:text-3xl font-bold text-white mb-1">
            {opportunities.length}
          </div>
          <div className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">{opportunities.length === 1 ? 'Opportunity' : 'Opportunities'}</div>
        </div>
        <div className="bg-gradient-to-br from-neutral-900/90 via-neutral-900/80 to-neutral-950/90 backdrop-blur-xl border border-neutral-800/60 p-4 rounded-xl text-center shadow-lg shadow-black/30 hover:shadow-xl hover:shadow-black/50 transition-all duration-300 hover:border-neutral-700/60 hover:-translate-y-0.5 col-span-2 sm:col-span-1">
          <div className="text-2xl sm:text-3xl font-bold text-white mb-1">
            {memberSince ? memberSince.getFullYear() : '—'}
          </div>
          <div className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">Member Since</div>
        </div>
      </div>

      {/* About Section */}
      {(profile?.title || profile?.specialties || profile?.location || profile?.bio || (profile?.skills && profile.skills.length > 0)) && (
        <div className="bg-gradient-to-br from-neutral-900/90 via-neutral-900/80 to-neutral-950/90 backdrop-blur-xl border border-neutral-800/60 p-4 sm:p-5 md:p-6 mb-5 sm:mb-6 rounded-xl shadow-lg shadow-black/30">
          <div className="flex items-center gap-2 mb-4 sm:mb-5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-ccaBlue/20 to-blue-500/20 border border-ccaBlue/40 text-ccaBlue flex items-center justify-center shadow-md shadow-ccaBlue/20">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 12c2.5 0 4.5-2 4.5-4.5S14.5 3 12 3 7.5 5 7.5 7.5 9.5 12 12 12zm0 0c-4.97 0-9 2.239-9 5v1.5A1.5 1.5 0 004.5 20h15a1.5 1.5 0 001.5-1.5V17c0-2.761-4.03-5-9-5z" />
              </svg>
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">About</h2>
          </div>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3 sm:gap-y-4">
            {profile?.title && (
              <div className="flex items-start gap-3 p-3 rounded-lg bg-neutral-800/30 border border-neutral-700/30 hover:bg-neutral-800/50 hover:border-neutral-700/50 transition-all duration-200">
                <div className="mt-0.5 text-ccaBlue flex-shrink-0">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 7V5a2 2 0 012-2h8a2 2 0 012 2v2M6 7h12M6 7l-2 7h16l-2-7M6 21h12" />
                  </svg>
                </div>
                <div className="min-w-0">
                  <dt className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1">Title</dt>
                  <dd className="text-white mt-0.5 text-sm font-semibold leading-relaxed">{profile.title}</dd>
                </div>
              </div>
            )}

            {(profile?.specialties && specialtyList.length > 0) && (
              <div className="flex items-start gap-3 p-3 rounded-lg bg-neutral-800/30 border border-neutral-700/30 hover:bg-neutral-800/50 hover:border-neutral-700/50 transition-all duration-200">
                <div className="mt-0.5 text-red-400 flex-shrink-0">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L3 20l3-6.75M21 7l-6 6-4-4-8 8" />
                  </svg>
                </div>
                <div className="min-w-0 flex-1">
                  <dt className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-2">Specialties</dt>
                  <dd className="mt-0.5">
                    <div className="flex flex-wrap gap-1.5">
                      {specialtyList.map((s, i) => (
                        <span key={`${s}-${i}`} className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-gradient-to-r from-red-500/20 to-red-600/20 text-red-300 border border-red-500/40 hover:border-red-500/60 hover:from-red-500/30 hover:to-red-600/30 transition-all duration-200 shadow-md shadow-red-500/10">
                          {s}
                        </span>
                      ))}
                    </div>
                  </dd>
                </div>
              </div>
            )}

            {profile?.location && (
              <div className="flex items-start gap-3 p-3 rounded-lg bg-neutral-800/30 border border-neutral-700/30 hover:bg-neutral-800/50 hover:border-neutral-700/50 transition-all duration-200">
                <div className="mt-0.5 text-green-400 flex-shrink-0">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a2 2 0 01-2.828 0l-4.243-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <div className="min-w-0">
                  <dt className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1">Location</dt>
                  <dd className="text-white mt-0.5 text-sm font-semibold leading-relaxed">{profile.location}</dd>
                </div>
              </div>
            )}

            {profile?.bio && (
              <div className="flex items-start gap-3 p-4 rounded-lg bg-neutral-800/30 border border-neutral-700/30 hover:bg-neutral-800/50 hover:border-neutral-700/50 transition-all duration-200 sm:col-span-2">
                <div className="mt-0.5 text-amber-400 flex-shrink-0">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 16h8M8 12h8M8 8h8M4 6a2 2 0 012-2h12a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V6z" />
                  </svg>
                </div>
                <div className="min-w-0 flex-1">
                  <dt className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-2">Bio</dt>
                  <dd className="text-neutral-200 mt-0.5 whitespace-pre-wrap leading-relaxed text-xs sm:text-sm font-medium">{profile.bio}</dd>
                </div>
              </div>
            )}

            {profile?.skills && profile.skills.length > 0 && (
              <div className="flex items-start gap-3 p-4 rounded-lg bg-neutral-800/30 border border-neutral-700/30 hover:bg-neutral-800/50 hover:border-neutral-700/50 transition-all duration-200 sm:col-span-2">
                <div className="mt-0.5 text-purple-400 flex-shrink-0">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6l3 6H9l3-6zm-7 9h14l-7 3-7-3z" />
                  </svg>
                </div>
                <div className="min-w-0 flex-1">
                  <dt className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-2">Skills</dt>
                  <dd>
                    <div className="flex flex-wrap gap-2">
                      {profile.skills.map((skill, index) => (
                        <span
                          key={index}
                          className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-gradient-to-r from-neutral-800/80 to-neutral-800/60 text-neutral-200 border border-neutral-700/50 hover:border-neutral-600 hover:from-neutral-700/80 hover:to-neutral-700/60 transition-all duration-200 shadow-md shadow-black/20"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  </dd>
                </div>
              </div>
            )}
          </dl>
        </div>
      )}

      {/* Following/Followers Section */}
      <div className="bg-gradient-to-br from-neutral-900/90 via-neutral-900/80 to-neutral-950/90 backdrop-blur-xl border border-neutral-800/60 p-4 sm:p-5 md:p-6 mb-5 sm:mb-6 rounded-xl shadow-lg shadow-black/30">
        <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-4 sm:mb-5">
          <div className="text-center p-4 rounded-lg bg-gradient-to-br from-neutral-800/40 to-neutral-800/20 border border-neutral-700/30 hover:border-neutral-600/50 transition-all duration-200">
            <div className="text-2xl sm:text-3xl font-bold text-white mb-1">{followingCount}</div>
            <div className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">Following</div>
          </div>
          <div className="text-center p-4 rounded-lg bg-gradient-to-br from-neutral-800/40 to-neutral-800/20 border border-neutral-700/30 hover:border-neutral-600/50 transition-all duration-200">
            <div className="text-2xl sm:text-3xl font-bold text-white mb-1">{followersCount}</div>
            <div className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">Followers</div>
          </div>
        </div>
        
        {/* Show preview of following/followers */}
        {(following.length > 0 || followers.length > 0) && (
          <div className="space-y-6">
            {following.length > 0 && (
              <div>
                <h3 className="text-lg font-bold text-white mb-4 uppercase tracking-wider">Following</h3>
                <div className="flex flex-wrap gap-3">
                  {following.slice(0, 10).map((user) => (
                    <Link
                      key={user.id}
                      href={`/profile/${user.id}`}
                      className="flex items-center gap-3 px-4 py-2.5 bg-gradient-to-r from-neutral-800/60 to-neutral-800/40 rounded-xl border-2 border-neutral-700/50 hover:border-neutral-600 hover:from-neutral-700/60 hover:to-neutral-700/40 transition-all duration-200 shadow-lg shadow-black/20 hover:shadow-xl hover:shadow-black/30 transform hover:-translate-y-0.5"
                    >
                      {user.photoURL ? (
                        <img
                          src={user.photoURL}
                          alt={user.displayName}
                          className="w-8 h-8 rounded-full border-2 border-neutral-600"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-ccaBlue to-blue-600 flex items-center justify-center text-white text-sm font-bold border-2 border-neutral-600">
                          {user.displayName.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <span className="text-sm font-semibold text-white">{user.displayName}</span>
                    </Link>
                  ))}
                  {followingCount > 10 && (
                    <span className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-neutral-800/60 to-neutral-800/40 rounded-xl border-2 border-neutral-700/50 text-sm font-semibold text-neutral-400">
                      +{followingCount - 10} more
                    </span>
                  )}
                </div>
              </div>
            )}
            {followers.length > 0 && (
              <div>
                <h3 className="text-lg font-bold text-white mb-4 uppercase tracking-wider">Followers</h3>
                <div className="flex flex-wrap gap-3">
                  {followers.slice(0, 10).map((user) => (
                    <Link
                      key={user.id}
                      href={`/profile/${user.id}`}
                      className="flex items-center gap-3 px-4 py-2.5 bg-gradient-to-r from-neutral-800/60 to-neutral-800/40 rounded-xl border-2 border-neutral-700/50 hover:border-neutral-600 hover:from-neutral-700/60 hover:to-neutral-700/40 transition-all duration-200 shadow-lg shadow-black/20 hover:shadow-xl hover:shadow-black/30 transform hover:-translate-y-0.5"
                    >
                      {user.photoURL ? (
                        <img
                          src={user.photoURL}
                          alt={user.displayName}
                          className="w-8 h-8 rounded-full border-2 border-neutral-600"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-ccaBlue to-blue-600 flex items-center justify-center text-white text-sm font-bold border-2 border-neutral-600">
                          {user.displayName.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <span className="text-sm font-semibold text-white">{user.displayName}</span>
                    </Link>
                  ))}
                  {followersCount > 10 && (
                    <span className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-neutral-800/60 to-neutral-800/40 rounded-xl border-2 border-neutral-700/50 text-sm font-semibold text-neutral-400">
                      +{followersCount - 10} more
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Projects Section */}
      {projects.length > 0 && (
        <div className="mb-8">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-white mb-6 tracking-tight">Projects</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((p) => (
              <a
                key={p.id}
                href={p.url || '#'}
                target={p.url ? "_blank" : undefined}
                rel={p.url ? "noopener noreferrer" : undefined}
                onClick={(e) => { if (!p.url) e.preventDefault(); }}
                className="bg-gradient-to-br from-neutral-900/90 via-neutral-900/80 to-neutral-950/90 backdrop-blur-xl border-2 border-neutral-800/60 rounded-2xl overflow-hidden hover:border-neutral-700/60 transition-all duration-300 group shadow-xl shadow-black/30 hover:shadow-2xl hover:shadow-black/50 transform hover:-translate-y-1"
              >
                <div className="aspect-video bg-gradient-to-br from-neutral-900 to-neutral-800 relative overflow-hidden">
                  {p.imageUrl ? (
                    <img
                      src={p.imageUrl}
                      alt={p.title}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-neutral-600 bg-gradient-to-br from-neutral-800 to-neutral-900">
                      <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                  )}
                </div>
                <div className="p-5 sm:p-6">
                  <h3 className="font-bold text-lg text-white mb-2 line-clamp-2 group-hover:text-ccaBlue transition-colors duration-200">
                    {p.title}
                  </h3>
                  {(p.preview || p.description) && (
                    <p className="text-sm text-neutral-400 line-clamp-2 mb-4 leading-relaxed">{p.preview || p.description}</p>
                  )}
                  {p.skills && p.skills.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-3">
                      {p.skills.slice(0, 4).map((s, idx) => (
                        <span key={idx} className="px-3 py-1 bg-gradient-to-r from-neutral-800/80 to-neutral-800/60 text-neutral-300 text-xs font-semibold border border-neutral-700/50 rounded-lg">
                          {s}
                        </span>
                      ))}
                      {p.skills.length > 4 && (
                        <span className="text-xs text-neutral-500 font-medium">+{p.skills.length - 4} more</span>
                      )}
                    </div>
                  )}
                </div>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Social Links Section */}
      {(profile?.linkedin || profile?.instagram || profile?.youtube) && (
        <div className="bg-gradient-to-br from-neutral-900/90 via-neutral-900/80 to-neutral-950/90 backdrop-blur-xl border border-neutral-800/60 p-6 sm:p-8 md:p-10 mb-8 rounded-2xl shadow-xl shadow-black/30">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-white mb-6 tracking-tight">Connect</h2>
          <div className="flex flex-wrap gap-4">
            {profile.linkedin && (
              <a
                href={getSocialMediaUrl('linkedin', profile.linkedin)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 text-neutral-300 hover:text-white transition-all duration-200 px-6 py-3 bg-gradient-to-r from-neutral-800/60 to-neutral-800/40 rounded-xl border-2 border-neutral-700/50 hover:border-blue-500/50 hover:from-blue-500/20 hover:to-blue-600/20 shadow-lg shadow-black/20 hover:shadow-xl hover:shadow-blue-500/20 transform hover:-translate-y-0.5 font-semibold"
              >
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                </svg>
                <span>LinkedIn</span>
              </a>
            )}
            {profile.instagram && (
              <a
                href={getSocialMediaUrl('instagram', profile.instagram)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 text-neutral-300 hover:text-white transition-all duration-200 px-6 py-3 bg-gradient-to-r from-neutral-800/60 to-neutral-800/40 rounded-xl border-2 border-neutral-700/50 hover:border-pink-500/50 hover:from-pink-500/20 hover:to-purple-500/20 shadow-lg shadow-black/20 hover:shadow-xl hover:shadow-pink-500/20 transform hover:-translate-y-0.5 font-semibold"
              >
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                </svg>
                <span>Instagram</span>
              </a>
            )}
            {profile.youtube && (
              <a
                href={getSocialMediaUrl('youtube', profile.youtube)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 text-neutral-300 hover:text-white transition-all duration-200 px-6 py-3 bg-gradient-to-r from-neutral-800/60 to-neutral-800/40 rounded-xl border-2 border-neutral-700/50 hover:border-red-500/50 hover:from-red-500/20 hover:to-red-600/20 shadow-lg shadow-black/20 hover:shadow-xl hover:shadow-red-500/20 transform hover:-translate-y-0.5 font-semibold"
              >
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                </svg>
                <span>YouTube</span>
              </a>
            )}
          </div>
        </div>
      )}

      {/* Opportunities Section */}
      {opportunities.length > 0 && (
        <div className="mb-8">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-white mb-6 tracking-tight">Opportunities</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {opportunities.map((o) => {
              const isOwnOpportunity = currentUser && o.posterId === currentUser.uid;
              const hasApplied = appliedOpportunityIds.has(o.id);
              const canApply = currentUser && !isOwnOpportunity && !hasApplied;
              
              return (
                <div key={o.id} className="bg-gradient-to-br from-neutral-900/90 via-neutral-900/80 to-neutral-950/90 backdrop-blur-xl border-2 border-neutral-800/60 rounded-2xl p-6 flex flex-col shadow-xl shadow-black/30 hover:shadow-2xl hover:shadow-black/50 hover:border-neutral-700/60 transition-all duration-300 transform hover:-translate-y-1">
                  <div className="flex-1 mb-4">
                    <div className="text-xs font-bold text-neutral-500 mb-2 uppercase tracking-wider">{o.company || 'Opportunity'}</div>
                    <div className="font-bold text-xl text-white mb-3 leading-tight">{o.title}</div>
                    <div className="text-sm text-neutral-400 mb-2 font-medium">
                      {o.location || 'Remote'} {o.type ? `• ${o.type}` : ''}
                    </div>
                    {o.posted && (
                      <div className="text-xs text-neutral-500 font-semibold">Posted {formatDate(o.posted)}</div>
                    )}
                  </div>
                  {canApply && (
                    <div className="mt-auto pt-4 border-t-2 border-neutral-800/50">
                      <button
                        onClick={() => {
                          setSelectedOpportunity(o);
                          setShowApplicationModal(true);
                        }}
                        className="w-full px-6 py-3 bg-gradient-to-r from-white to-neutral-100 text-black hover:from-neutral-100 hover:to-white border-2 border-ccaBlue font-bold transition-all duration-200 text-base rounded-xl shadow-lg shadow-ccaBlue/20 hover:shadow-xl hover:shadow-ccaBlue/30 transform hover:scale-105 active:scale-95"
                      >
                        Apply Now
                      </button>
                      {o.amount && (
                        <div className="text-sm font-bold text-neutral-300 mt-3 text-center">
                          ${(o.amount / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Marketplace Listings Section */}
      {listings.length > 0 && (
        <div className="mb-8">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-white mb-6 tracking-tight">Marketplace Listings</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {listings.map((listing) => (
              <Link
                key={listing.id}
                href={`/marketplace`}
                onClick={(e) => {
                  e.preventDefault();
                  // You could open a modal or navigate to marketplace with listing ID
                  router.push(`/marketplace`);
                }}
                className="bg-gradient-to-br from-neutral-900/90 via-neutral-900/80 to-neutral-950/90 backdrop-blur-xl border-2 border-neutral-800/60 rounded-2xl overflow-hidden hover:border-neutral-700/60 transition-all duration-300 group shadow-xl shadow-black/30 hover:shadow-2xl hover:shadow-black/50 transform hover:-translate-y-1"
              >
                <div className="aspect-video bg-gradient-to-br from-neutral-900 to-neutral-800 relative overflow-hidden">
                  {listing.images && listing.images.length > 0 ? (
                    <img
                      src={listing.images[0]}
                      alt={listing.title}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-neutral-600 bg-gradient-to-br from-neutral-800 to-neutral-900">
                      <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                  )}
                </div>
                <div className="p-5 sm:p-6">
                  <h3 className="font-bold text-lg text-white mb-3 line-clamp-2 group-hover:text-ccaBlue transition-colors duration-200">
                    {listing.title}
                  </h3>
                  <div className="flex items-center justify-between mt-4 pt-4 border-t border-neutral-800/50">
                    <span className="text-2xl font-extrabold text-white bg-gradient-to-r from-white to-neutral-300 bg-clip-text text-transparent">${listing.price.toFixed(2)}</span>
                    <span className="text-xs font-bold text-neutral-400 bg-gradient-to-r from-neutral-800/80 to-neutral-800/60 px-3 py-1.5 rounded-lg border border-neutral-700/50 uppercase tracking-wider">
                      {listing.condition}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Removed the Courses empty state as courses are not shown on public profile */}

      {/* Empty State for Listings */}
      {listings.length === 0 && (
        <div className="bg-gradient-to-br from-neutral-900/90 via-neutral-900/80 to-neutral-950/90 backdrop-blur-xl border-2 border-neutral-800/60 p-12 rounded-2xl text-center shadow-xl shadow-black/30">
          <svg className="w-20 h-20 text-neutral-600 mx-auto mb-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
          <h3 className="text-2xl font-bold text-white mb-3">No Marketplace Listings</h3>
          <p className="text-neutral-400 text-lg font-medium">This creator hasn't posted any marketplace listings yet.</p>
        </div>
      )}

      {/* Messages Modal */}
      {showMessageModal && currentUser && (
        <Messages
          isOpen={showMessageModal}
          onClose={() => setShowMessageModal(false)}
          initialRecipientUserId={userId}
        />
      )}

      {/* Legacy+ creator selection modal (subscribe / add another) */}
      {showLegacyModal && (
        <LegacyUpgradeModal isOpen={showLegacyModal} onClose={() => setShowLegacyModal(false)} />
      )}

      {/* Application Modal */}
      {showApplicationModal && selectedOpportunity && (
        <JobApplicationModal
          isOpen={showApplicationModal}
          onClose={() => {
            setShowApplicationModal(false);
            setSelectedOpportunity(null);
          }}
          opportunityId={selectedOpportunity.id}
          opportunityTitle={selectedOpportunity.title}
          opportunityCompany={selectedOpportunity.company}
          onSuccess={() => {
            // Refresh applied opportunities
            if (currentUser && firebaseReady && db) {
              const appliedQuery = query(
                collection(db, 'jobApplications'),
                where('applicantId', '==', currentUser.uid)
              );
              getDocs(appliedQuery).then((appliedSnap) => {
                const appliedIds = new Set(appliedSnap.docs.map(doc => doc.data().opportunityId));
                setAppliedOpportunityIds(appliedIds);
              });
            }
          }}
        />
      )}
    </main>
  );
}

