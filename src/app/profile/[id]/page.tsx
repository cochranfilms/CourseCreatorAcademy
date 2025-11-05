"use client";

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc, getDoc, collection, query, where, getDocs, orderBy, QueryDocumentSnapshot, DocumentData } from 'firebase/firestore';
import { db, firebaseReady } from '@/lib/firebaseClient';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';
import Image from 'next/image';
import { Messages } from '@/components/Messages';
import { LegacyUpgradeModal } from '@/components/LegacyUpgradeModal';

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

export default function ProfilePage() {
  const params = useParams();
  const router = useRouter();
  const { user: currentUser } = useAuth();
  const userId = params?.id as string;
  
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [listings, setListings] = useState<Listing[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [memberSince, setMemberSince] = useState<Date | null>(null);
  const [hasLegacySub, setHasLegacySub] = useState(false);
  const [showLegacyModal, setShowLegacyModal] = useState(false);

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

        // Fetch user's courses
        try {
          let coursesDocs: QueryDocumentSnapshot<DocumentData>[];
          try {
            // Try query with index first
            const coursesQuery = query(
              collection(db, 'courses'),
              where('createdBy', '==', userId),
              orderBy('createdAt', 'desc')
            );
            const coursesSnap = await getDocs(coursesQuery);
            coursesDocs = coursesSnap.docs;
          } catch (queryError: any) {
            // If query fails (likely missing index), fetch all and filter client-side
            console.warn('Courses query failed, falling back to client-side filter:', queryError);
            const allCoursesSnap = await getDocs(collection(db, 'courses'));
            coursesDocs = allCoursesSnap.docs.filter(doc => doc.data().createdBy === userId);
          }

          const coursesData: Course[] = await Promise.all(
            coursesDocs.map(async (docSnap) => {
              const courseData = docSnap.data();
              let thumbnailPlaybackId: string | undefined;
              let thumbnailDurationSec: number | undefined;

              try {
                // Get thumbnail from first lesson of first module
                const modulesRef = collection(db, `courses/${docSnap.id}/modules`);
                const modulesSnap = await getDocs(query(modulesRef, orderBy('index', 'asc')));
                if (!modulesSnap.empty) {
                  const firstModuleId = modulesSnap.docs[0].id;
                  const lessonsRef = collection(db, `courses/${docSnap.id}/modules/${firstModuleId}/lessons`);
                  const lessonsSnap = await getDocs(query(lessonsRef, orderBy('index', 'asc')));
                  if (!lessonsSnap.empty) {
                    const lessonData: any = lessonsSnap.docs[0].data();
                    thumbnailPlaybackId = lessonData?.muxPlaybackId;
                    thumbnailDurationSec = lessonData?.durationSec;
                  }
                }
              } catch (e) {
                console.error('Error fetching course thumbnail:', e);
              }

              return {
                id: docSnap.id,
                title: courseData.title || 'Untitled Course',
                slug: courseData.slug || docSnap.id,
                summary: courseData.summary,
                coverImage: courseData.coverImage,
                lessonsCount: courseData.lessonsCount || 0,
                modulesCount: courseData.modulesCount || 0,
                thumbnailPlaybackId,
                thumbnailDurationSec
              };
            })
          );
          // Filter out courses with no title or that aren't published (if published field exists)
          setCourses(coursesData.filter(c => {
            return c.title !== 'Untitled Course' || coursesData.length === 1;
          }));
        } catch (error) {
          console.error('Error fetching courses:', error);
          setCourses([]);
        }

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

      } catch (error) {
        console.error('Error fetching profile:', error);
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [userId, currentUser]);

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

  if (loading) {
    return (
      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="inline-block animate-spin h-12 w-12 border-b-2 border-ccaBlue mb-4"></div>
            <p className="text-neutral-400">Loading profile...</p>
          </div>
        </div>
      </main>
    );
  }

  if (notFound) {
    return (
      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-white mb-2">Profile Not Found</h1>
            <p className="text-neutral-400 mb-6">The user profile you're looking for doesn't exist.</p>
            <Link href="/home" className="text-ccaBlue hover:underline">Return to Home</Link>
          </div>
        </div>
      </main>
    );
  }

  if (profile?.profilePublic === false && currentUser?.uid !== userId) {
    return (
      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="w-20 h-20 rounded-full bg-neutral-800 flex items-center justify-center mx-auto mb-4">
              <svg className="w-10 h-10 text-neutral-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">Private Profile</h1>
            <p className="text-neutral-400">This profile is set to private.</p>
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
    <main className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 py-4 sm:py-6 md:py-8">
      {/* Profile Header */}
      <div className="bg-neutral-950/60 backdrop-blur-sm border border-neutral-800/50 p-4 sm:p-6 mb-6 rounded-lg">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6">
          {/* Profile Photo */}
          <div className="relative w-24 h-24 sm:w-32 sm:h-32 rounded-full overflow-hidden bg-neutral-800 flex-shrink-0 border-2 border-neutral-700">
            {photoURL ? (
              <img
                src={photoURL}
                alt={displayName}
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  const parent = e.currentTarget.parentElement;
                  if (parent) {
                    parent.innerHTML = `<div class="w-full h-full flex items-center justify-center text-2xl sm:text-3xl font-semibold bg-ccaBlue text-white">${displayName.charAt(0).toUpperCase()}</div>`;
                  }
                }}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-2xl sm:text-3xl font-semibold bg-ccaBlue text-white">
                {displayName.charAt(0).toUpperCase()}
              </div>
            )}
          </div>

          {/* Profile Info */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-white mb-1">{displayName}</h1>
                {handle && (
                  <p className="text-neutral-400 text-sm sm:text-base">@{handle}</p>
                )}
                {profile?.title && (
                  <p className="text-neutral-300 mt-1">{profile.title}</p>
                )}
              </div>
              {currentUser && currentUser.uid !== userId && (
                <button
                  onClick={() => setShowMessageModal(true)}
                  className="bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 sm:px-6 rounded-lg transition flex items-center gap-2 self-start sm:self-auto"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  Message
                </button>
              )}

              {/* When viewing own profile, show Legacy Subscriptions / Upgrade CTA (opens modal) */}
              {currentUser && currentUser.uid === userId && (
                <button
                  onClick={() => setShowLegacyModal(true)}
                  className="px-4 py-2 bg-gradient-to-r from-orange-500 to-red-500 text-white hover:from-orange-600 hover:to-red-600 rounded-lg font-semibold transition self-start"
                >
                  {hasLegacySub ? 'Legacy Subscriptions' : 'Upgrade to Legacy+'}
                </button>
              )}
            </div>

          </div>
        </div>
      </div>

      {/* Stats Section */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <div className="bg-neutral-950/60 backdrop-blur-sm border border-neutral-800/50 p-4 rounded-lg text-center">
          <div className="text-2xl sm:text-3xl font-bold text-white mb-1">{courses.length}</div>
          <div className="text-sm text-neutral-400">{courses.length === 1 ? 'Course' : 'Courses'}</div>
        </div>
        <div className="bg-neutral-950/60 backdrop-blur-sm border border-neutral-800/50 p-4 rounded-lg text-center">
          <div className="text-2xl sm:text-3xl font-bold text-white mb-1">{listings.length}</div>
          <div className="text-sm text-neutral-400">{listings.length === 1 ? 'Listing' : 'Listings'}</div>
        </div>
        <div className="bg-neutral-950/60 backdrop-blur-sm border border-neutral-800/50 p-4 rounded-lg text-center">
          <div className="text-2xl sm:text-3xl font-bold text-white mb-1">
            {courses.reduce((sum, c) => sum + (c.lessonsCount || 0), 0)}
          </div>
          <div className="text-sm text-neutral-400">Total Lessons</div>
        </div>
        <div className="bg-neutral-950/60 backdrop-blur-sm border border-neutral-800/50 p-4 rounded-lg text-center">
          <div className="text-2xl sm:text-3xl font-bold text-white mb-1">
            {memberSince ? memberSince.getFullYear() : '—'}
          </div>
          <div className="text-sm text-neutral-400">Member Since</div>
        </div>
      </div>

      {/* About Section */}
      {(profile?.title || profile?.specialties || profile?.location || profile?.bio || (profile?.skills && profile.skills.length > 0)) && (
        <div className="bg-neutral-950/60 backdrop-blur-sm border border-neutral-800/50 p-4 sm:p-6 mb-6 rounded-lg">
          <div className="flex items-center gap-2 mb-5">
            <div className="w-6 h-6 rounded-md bg-ccaBlue/20 border border-ccaBlue/30 text-ccaBlue flex items-center justify-center">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 12c2.5 0 4.5-2 4.5-4.5S14.5 3 12 3 7.5 5 7.5 7.5 9.5 12 12 12zm0 0c-4.97 0-9 2.239-9 5v1.5A1.5 1.5 0 004.5 20h15a1.5 1.5 0 001.5-1.5V17c0-2.761-4.03-5-9-5z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-white">About</h2>
          </div>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-6">
            {profile?.title && (
              <div className="flex items-start gap-3">
                <div className="mt-0.5 text-neutral-400">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 7V5a2 2 0 012-2h8a2 2 0 012 2v2M6 7h12M6 7l-2 7h16l-2-7M6 21h12" />
                  </svg>
                </div>
                <div>
                  <dt className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">Title</dt>
                  <dd className="text-neutral-200 mt-1">{profile.title}</dd>
                </div>
              </div>
            )}

            {(profile?.specialties && specialtyList.length > 0) && (
              <div className="flex items-start gap-3">
                <div className="mt-0.5 text-neutral-400">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L3 20l3-6.75M21 7l-6 6-4-4-8 8" />
                  </svg>
                </div>
                <div className="min-w-0">
                  <dt className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">Specialties</dt>
                  <dd className="mt-1">
                    <div className="flex flex-wrap gap-2">
                      {specialtyList.map((s, i) => (
                        <span key={`${s}-${i}`} className="px-2.5 py-1 rounded-full text-xs font-medium bg-red-500/10 text-red-300 border border-red-500/30">
                          {s}
                        </span>
                      ))}
                    </div>
                  </dd>
                </div>
              </div>
            )}

            {profile?.location && (
              <div className="flex items-start gap-3">
                <div className="mt-0.5 text-neutral-400">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a2 2 0 01-2.828 0l-4.243-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <div>
                  <dt className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">Location</dt>
                  <dd className="text-neutral-200 mt-1">{profile.location}</dd>
                </div>
              </div>
            )}

            {profile?.bio && (
              <div className="flex items-start gap-3 sm:col-span-2">
                <div className="mt-0.5 text-neutral-400">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16h8M8 12h8M8 8h8M4 6a2 2 0 012-2h12a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V6z" />
                  </svg>
                </div>
                <div className="min-w-0">
                  <dt className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">Bio</dt>
                  <dd className="text-neutral-300 mt-1 whitespace-pre-wrap leading-relaxed">{profile.bio}</dd>
                </div>
              </div>
            )}

            {profile?.skills && profile.skills.length > 0 && (
              <div className="flex items-start gap-3 sm:col-span-2">
                <div className="mt-0.5 text-neutral-400">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6l3 6H9l3-6zm-7 9h14l-7 3-7-3z" />
                  </svg>
                </div>
                <div className="min-w-0">
                  <dt className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1">Skills</dt>
                  <dd>
                    <div className="flex flex-wrap gap-2">
                      {profile.skills.map((skill, index) => (
                        <span
                          key={index}
                          className="px-3 py-1 rounded-full text-xs font-medium bg-neutral-800/70 text-neutral-200 border border-neutral-700 hover:border-neutral-600 transition"
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

      {/* Projects Section */}
      {projects.length > 0 && (
        <div className="mb-6">
          <h2 className="text-xl font-bold text-white mb-4">Projects</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((p) => (
              <a
                key={p.id}
                href={p.url || '#'}
                target={p.url ? "_blank" : undefined}
                rel={p.url ? "noopener noreferrer" : undefined}
                onClick={(e) => { if (!p.url) e.preventDefault(); }}
                className="bg-neutral-950/60 backdrop-blur-sm border border-neutral-800/50 rounded-lg overflow-hidden hover:border-neutral-700 transition group"
              >
                <div className="aspect-video bg-neutral-900 relative overflow-hidden">
                  {p.imageUrl ? (
                    <img
                      src={p.imageUrl}
                      alt={p.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-neutral-600">
                      <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                  )}
                </div>
                <div className="p-4">
                  <h3 className="font-semibold text-white mb-1 line-clamp-2 group-hover:text-ccaBlue transition">
                    {p.title}
                  </h3>
                  {(p.preview || p.description) && (
                    <p className="text-sm text-neutral-400 line-clamp-2 mb-2">{p.preview || p.description}</p>
                  )}
                  {p.skills && p.skills.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {p.skills.slice(0, 4).map((s, idx) => (
                        <span key={idx} className="px-2 py-0.5 bg-neutral-800 text-neutral-300 text-xs border border-neutral-700">
                          {s}
                        </span>
                      ))}
                      {p.skills.length > 4 && (
                        <span className="text-xs text-neutral-500">+{p.skills.length - 4} more</span>
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
        <div className="bg-neutral-950/60 backdrop-blur-sm border border-neutral-800/50 p-4 sm:p-6 mb-6 rounded-lg">
          <h2 className="text-xl font-bold text-white mb-4">Connect</h2>
          <div className="flex gap-4">
            {profile.linkedin && (
              <a
                href={profile.linkedin}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-neutral-400 hover:text-white transition px-4 py-2 bg-neutral-800/50 rounded-lg border border-neutral-700 hover:border-neutral-600"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                </svg>
                <span>LinkedIn</span>
              </a>
            )}
            {profile.instagram && (
              <a
                href={profile.instagram}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-neutral-400 hover:text-white transition px-4 py-2 bg-neutral-800/50 rounded-lg border border-neutral-700 hover:border-neutral-600"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                </svg>
                <span>Instagram</span>
              </a>
            )}
            {profile.youtube && (
              <a
                href={profile.youtube}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-neutral-400 hover:text-white transition px-4 py-2 bg-neutral-800/50 rounded-lg border border-neutral-700 hover:border-neutral-600"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                </svg>
                <span>YouTube</span>
              </a>
            )}
          </div>
        </div>
      )}

      {/* Courses Section */}
      {courses.length > 0 && (
        <div className="mb-6">
          <h2 className="text-xl font-bold text-white mb-4">Courses</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {courses.map((course) => {
              const thumbnailUrl = course.coverImage || getMuxThumbnailUrl(course.thumbnailPlaybackId, course.thumbnailDurationSec);
              return (
                <Link
                  key={course.id}
                  href={`/learn/${course.slug}`}
                  className="bg-neutral-950/60 backdrop-blur-sm border border-neutral-800/50 rounded-lg overflow-hidden hover:border-neutral-700 transition group"
                >
                  <div className="aspect-video bg-neutral-900 relative overflow-hidden">
                    {thumbnailUrl ? (
                      <img
                        src={thumbnailUrl}
                        alt={course.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-neutral-600">
                        <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                    )}
                  </div>
                  <div className="p-4">
                    <h3 className="font-semibold text-white mb-1 line-clamp-2 group-hover:text-ccaBlue transition">
                      {course.title}
                    </h3>
                    {course.summary && (
                      <p className="text-sm text-neutral-400 line-clamp-2 mb-2">{course.summary}</p>
                    )}
                    <div className="flex items-center gap-2 text-xs text-neutral-500">
                      <span>{course.modulesCount} {course.modulesCount === 1 ? 'module' : 'modules'}</span>
                      <span>•</span>
                      <span>{course.lessonsCount} {course.lessonsCount === 1 ? 'lesson' : 'lessons'}</span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Marketplace Listings Section */}
      {listings.length > 0 && (
        <div className="mb-6">
          <h2 className="text-xl font-bold text-white mb-4">Marketplace Listings</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {listings.map((listing) => (
              <Link
                key={listing.id}
                href={`/marketplace`}
                onClick={(e) => {
                  e.preventDefault();
                  // You could open a modal or navigate to marketplace with listing ID
                  router.push(`/marketplace`);
                }}
                className="bg-neutral-950/60 backdrop-blur-sm border border-neutral-800/50 rounded-lg overflow-hidden hover:border-neutral-700 transition group"
              >
                <div className="aspect-video bg-neutral-900 relative overflow-hidden">
                  {listing.images && listing.images.length > 0 ? (
                    <img
                      src={listing.images[0]}
                      alt={listing.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-neutral-600">
                      <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                  )}
                </div>
                <div className="p-4">
                  <h3 className="font-semibold text-white mb-1 line-clamp-2 group-hover:text-ccaBlue transition">
                    {listing.title}
                  </h3>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-lg font-bold text-white">${listing.price.toFixed(2)}</span>
                    <span className="text-xs text-neutral-500 bg-neutral-800 px-2 py-1 rounded">
                      {listing.condition}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Empty State for Courses */}
      {courses.length === 0 && (
        <div className="bg-neutral-950/60 backdrop-blur-sm border border-neutral-800/50 p-8 rounded-lg text-center mb-6">
          <svg className="w-16 h-16 text-neutral-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
          <h3 className="text-lg font-semibold text-white mb-2">No Courses Yet</h3>
          <p className="text-neutral-400">This creator hasn't published any courses yet.</p>
        </div>
      )}

      {/* Empty State for Listings */}
      {listings.length === 0 && (
        <div className="bg-neutral-950/60 backdrop-blur-sm border border-neutral-800/50 p-8 rounded-lg text-center">
          <svg className="w-16 h-16 text-neutral-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
          <h3 className="text-lg font-semibold text-white mb-2">No Marketplace Listings</h3>
          <p className="text-neutral-400">This creator hasn't posted any marketplace listings yet.</p>
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
    </main>
  );
}

