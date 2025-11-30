"use client";

import { useEffect, useState, useMemo } from 'react';
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { db } from '@/lib/firebaseClient';
// Link removed; cards open a modal directly
import Image from 'next/image';
import { useAuth } from '@/contexts/AuthContext';
import { isSaved, toggleSaved, getCourseProgress } from '@/lib/userData';
import CourseViewerModal from '@/components/CourseViewerModal';
import dynamic from 'next/dynamic';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { Card } from '@/components/ui/Card';
import MuxPlayer from '@mux/mux-player-react';
import { getMuxAnimatedGifUrl } from '@/lib/muxThumbnails';
const CreatorKitsScroller = dynamic(
  () => import('@/components/CreatorKitsScroller').then(m => m.CreatorKitsScroller),
  { ssr: false, loading: () => null }
);

type Course = {
  id: string;
  title: string;
  slug: string;
  summary?: string;
  coverImage?: string;
  lessonsCount: number;
  modulesCount: number;
  featured?: boolean;
  thumbnailPlaybackId?: string;
  thumbnailDurationSec?: number;
};

function getMuxThumbnailUrl(playbackId?: string, durationSec?: number) {
  if (!playbackId) return '';
  const time = durationSec && durationSec > 0 ? Math.floor(durationSec / 2) : 1;
  return `https://image.mux.com/${playbackId}/thumbnail.jpg?time=${time}&width=640&fit_mode=preserve`;
}

export default function LearnPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const { user } = useAuth();
  const [savedCourses, setSavedCourses] = useState<Record<string, boolean>>({});
  const [courseProgress, setCourseProgress] = useState<Record<string, number>>({});
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerCourseTitle, setViewerCourseTitle] = useState('');
  const [viewerCourseSlug, setViewerCourseSlug] = useState('');
  const [viewerModules, setViewerModules] = useState<any[]>([]);
  const [viewerInitial, setViewerInitial] = useState<{ moduleId: string; lessonId: string } | null>(null);
  const [featuredPlaybackToken, setFeaturedPlaybackToken] = useState<string | null>(null);
  const [featuredVideoPlaying, setFeaturedVideoPlaying] = useState(false);

  async function openViewerForCourse(course: Course) {
    try {
      const modulesRef = collection(db, `courses/${course.id}/modules`);
      const modulesSnap = await getDocs(query(modulesRef, orderBy('index', 'asc')));
      const modules: any[] = [];
      let firstModuleId = '';
      let firstLessonId = '';
      for (const m of modulesSnap.docs) {
        const lessonsRef = collection(db, `courses/${course.id}/modules/${m.id}/lessons`);
        const lessonsSnap = await getDocs(query(lessonsRef, orderBy('index', 'asc')));
        const lessons = lessonsSnap.docs.map(ls => ({ id: ls.id, ...ls.data() }));
        if (!firstModuleId && lessons.length) { firstModuleId = m.id; firstLessonId = lessons[0].id; }
        modules.push({ id: m.id, title: m.data().title || 'Module', index: m.data().index || 0, lessons: lessons.map((l: any) => ({ id: l.id, title: l.title || 'Lesson', index: l.index || 0, durationSec: l.durationSec, muxPlaybackId: l.muxPlaybackId })) });
      }
      setViewerCourseTitle(course.title);
      setViewerCourseSlug(course.slug);
      setViewerModules(modules);
      setViewerInitial(firstModuleId && firstLessonId ? { moduleId: firstModuleId, lessonId: firstLessonId } : null);
      setViewerOpen(true);
    } catch (err) {
      console.error('Open viewer failed:', err);
    }
  }

  useEffect(() => {
    async function fetchCourses() {
      try {
        const coursesRef = collection(db, 'courses');
        const snapshot = await getDocs(coursesRef);
        
        const coursesData: Course[] = await Promise.all(
          snapshot.docs.map(async (docSnap) => {
            const data = docSnap.data();
            let thumbnailPlaybackId: string | undefined;
            let thumbnailDurationSec: number | undefined;

            try {
              // First module → first lesson → thumbnail from muxPlaybackId
              const modulesRef = collection(db, `courses/${docSnap.id}/modules`);
              const firstModuleSnap = await getDocs(
                query(modulesRef, orderBy('index', 'asc'), limit(1))
              );
              if (!firstModuleSnap.empty) {
                const firstModuleId = firstModuleSnap.docs[0].id;
                const lessonsRef = collection(
                  db,
                  `courses/${docSnap.id}/modules/${firstModuleId}/lessons`
                );
                const firstLessonSnap = await getDocs(
                  query(lessonsRef, orderBy('index', 'asc'), limit(1))
                );
                if (!firstLessonSnap.empty) {
                  const ldata: any = firstLessonSnap.docs[0].data();
                  thumbnailPlaybackId = ldata?.muxPlaybackId;
                  thumbnailDurationSec = ldata?.durationSec;
                }
              }
            } catch (e) {
              // Non-fatal; just omit thumbnail
              console.warn('Thumbnail fetch failed for course', docSnap.id, e);
            }

            return {
              id: docSnap.id,
              title: data.title || 'Untitled Course',
              slug: data.slug || docSnap.id,
              summary: data.summary,
              coverImage: data.coverImage,
              lessonsCount: data.lessonsCount || 0,
              modulesCount: data.modulesCount || 0,
              featured: data.featured || false,
              thumbnailPlaybackId,
              thumbnailDurationSec,
            } as Course;
          })
        );

        // Sort: featured first, then by title
        coursesData.sort((a, b) => {
          if (a.featured && !b.featured) return -1;
          if (!a.featured && b.featured) return 1;
          return a.title.localeCompare(b.title);
        });

        setCourses(coursesData);
      } catch (error) {
        console.error('Error fetching courses:', error);
      } finally {
        setLoading(false);
      }
    }

    if (db) {
      fetchCourses();
    } else {
      setLoading(false);
    }
  }, []);

  // Track mount (no conditional returns to keep hook order stable)
  useEffect(() => { setMounted(true); }, []);

  // Compute saved state for courses
  useEffect(() => {
    async function computeSaved() {
      if (!user || courses.length === 0) return;
      const saved: Record<string, boolean> = {};
      const progress: Record<string, number> = {};
      
      for (const course of courses) {
        saved[course.id] = await isSaved(user.uid, 'course', course.id);
        progress[course.id] = await getCourseProgress(user.uid, course.slug, course.lessonsCount);
      }
      
      setSavedCourses(saved);
      setCourseProgress(progress);
    }
    computeSaved();
  }, [user, courses]);

  // Compute featured course for hero (must be computed before useEffect that uses it)
  const featuredCourse = useMemo(() => {
    return courses.find(c => c.featured) || courses[0];
  }, [courses]);

  // Smooth-scroll to Creator Kits when requested (must be declared before any early returns)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const sp = new URLSearchParams(window.location.search || '');
      const section = sp.get('section');
      if (section === 'creator-kits') {
        const el = document.getElementById('creator-kits');
        if (el) {
          setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
        }
      }
    } catch {}
  }, []);

  // Fetch playback token for featured video
  useEffect(() => {
    let cancelled = false;
    const fetchToken = async () => {
      if (!featuredCourse?.thumbnailPlaybackId || !user) {
        setFeaturedPlaybackToken(null);
        return;
      }
      
      try {
        const idToken = await user.getIdToken();
        const tokenUrl = `/api/mux/token?playbackId=${encodeURIComponent(featuredCourse.thumbnailPlaybackId)}`;
        const res = await fetch(tokenUrl, {
          headers: {
            'Authorization': `Bearer ${idToken}`,
          },
        });
        
        if (!res.ok) {
          console.warn('Failed to fetch featured video playback token:', res.status);
          return;
        }
        
        const json = await res.json();
        if (!cancelled && json?.token) {
          setFeaturedPlaybackToken(json.token);
        }
      } catch (error) {
        console.error('Error fetching featured video playback token:', error);
      }
    };
    
    fetchToken();
    return () => { cancelled = true; };
  }, [featuredCourse?.thumbnailPlaybackId, user]);

  if (loading) {
    return (
      <main className="min-h-screen max-w-7xl mx-auto px-6 py-8">
        <h1 className="text-3xl md:text-4xl font-bold">All Courses</h1>
        <div className="mt-6 grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="bg-gradient-to-b from-neutral-900 to-neutral-950 animate-pulse">
              <div className="h-40 bg-neutral-800" />
              <div className="p-4">
                <div className="h-5 bg-neutral-800 rounded w-3/4 mb-2"></div>
                <div className="h-4 bg-neutral-800 rounded w-1/2"></div>
              </div>
            </Card>
          ))}
        </div>
      </main>
    );
  }

  return (
    <>
      {/* Full-width Creator Kits rail at the very top */}
      <section id="creator-kits" className="w-full">
        <CreatorKitsScroller />
      </section>

      <main className="min-h-screen max-w-7xl mx-auto px-6 py-8">
        <div className="mb-6">
          <div className="mb-2">
            <Image 
              src="/logo-cca.png" 
              alt="Course Creator Academy" 
              width={1443} 
              height={210} 
              className="h-[42px] w-auto sm:h-[52px] object-contain" 
            />
          </div>
          <p className="text-neutral-400">Premium courses for filmmakers and creators</p>
        </div>

        {/* Featured Video hero */}
        {featuredCourse && (
          <div className="mt-8 mb-6">
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-3">Featured Video</h2>
            <div className="relative rounded-2xl overflow-hidden border border-neutral-800 bg-neutral-900 max-w-5xl mx-auto">
              <div className="aspect-video relative bg-black overflow-hidden">
                {featuredCourse.thumbnailPlaybackId ? (
                  <>
                    {/* Animated GIF preview overlay - shows before video plays */}
                    {!featuredVideoPlaying && (
                      <div className="absolute inset-0 z-0">
                        <img
                          src={getMuxAnimatedGifUrl(featuredCourse.thumbnailPlaybackId, 640, 10, 13, 15)}
                          alt={`${featuredCourse.title} preview`}
                          className="w-full h-full object-cover"
                          style={{ pointerEvents: 'none' }}
                        />
                      </div>
                    )}
                    <div className="relative z-10 w-full h-full">
                      <MuxPlayer
                        playbackId={featuredCourse.thumbnailPlaybackId}
                        streamType="on-demand"
                        primaryColor="#3B82F6"
                        className="w-full h-full"
                        playsInline
                        preload="metadata"
                        onPlay={() => setFeaturedVideoPlaying(true)}
                        // @ts-ignore
                        preferMse
                        // Cap resolution to 1080p for better quality while maintaining performance
                        // @ts-ignore
                        maxResolution="1080p"
                        // @ts-ignore
                        disablePictureInPicture
                        // @ts-ignore
                        autoPictureInPicture={false}
                        {...(featuredPlaybackToken ? { tokens: { playback: featuredPlaybackToken } as any } : {})}
                      />
                    </div>
                  </>
                ) : featuredCourse.coverImage ? (
                  <div
                    className="relative w-full h-full cursor-pointer group"
                    onClick={() => openViewerForCourse(featuredCourse)}
                  >
                    <Image
                      src={featuredCourse.coverImage}
                      alt={featuredCourse.title}
                      fill
                      sizes="100vw"
                      className="object-cover"
                    />
                    {/* Play button overlay */}
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/30 transition">
                      <div className="w-16 h-16 rounded-full bg-white/90 text-black flex items-center justify-center shadow-lg group-hover:scale-105 transition">
                        <svg className="w-7 h-7" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M8 5v14l11-7z" />
                        </svg>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div
                    className="w-full h-full flex items-center justify-center text-neutral-600 cursor-pointer"
                    onClick={() => openViewerForCourse(featuredCourse)}
                  >
                    <svg className="w-20 h-20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                )}
              </div>
              <div className="p-4 md:p-5">
                <div className="inline-flex items-center gap-2 text-xs mb-2">
                  <span className="px-2 py-0.5 rounded bg-red-600/20 text-red-400 border border-red-500/30">Featured</span>
                </div>
                <div className="text-xl md:text-2xl font-semibold text-white">{featuredCourse.title}</div>
                {featuredCourse.summary && (
                  <p className="text-neutral-300 mt-2 line-clamp-2">{featuredCourse.summary}</p>
                )}
                {featuredCourse.thumbnailPlaybackId && (
                  <button
                    onClick={() => openViewerForCourse(featuredCourse)}
                    className="mt-3 text-sm text-ccaBlue hover:text-white transition"
                  >
                    View Full Course →
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {courses.length === 0 ? (
          <div className="mt-8 text-center text-neutral-400">
            <p>No courses available yet.</p>
          </div>
        ) : (
        <div className="mt-6 grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {courses.map((course) => (
            <Card
              key={course.id}
              className="bg-gradient-to-b from-neutral-900 to-neutral-950 hover:border-ccaBlue transition group relative cursor-pointer"
              onClick={() => openViewerForCourse(course)}
            >
                  <div className="relative h-40 bg-neutral-800 group-hover:bg-neutral-700 transition">
                    {course.thumbnailPlaybackId ? (
                      <Image
                        src={getMuxThumbnailUrl(course.thumbnailPlaybackId, course.thumbnailDurationSec) || ''}
                        alt={`${course.title} thumbnail`}
                        fill
                        sizes="(max-width: 768px) 100vw, 33vw"
                        className="object-cover"
                      />
                    ) : course.coverImage ? (
                      <Image
                        src={course.coverImage}
                        alt={course.title}
                        fill
                        sizes="(max-width: 768px) 100vw, 33vw"
                        className="object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-neutral-600">
                        <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                    )}
              </div>
                  <div className="p-4">
                    <div className="text-lg font-semibold mb-1">{course.title}</div>
                    <div className="text-sm text-neutral-400">
                      {course.lessonsCount} lesson{course.lessonsCount !== 1 ? 's' : ''}
                      {course.modulesCount > 0 && (
                        <span className="ml-2">• {course.modulesCount} module{course.modulesCount !== 1 ? 's' : ''}</span>
                      )}
                      {user && courseProgress[course.id] !== undefined && (
                        <span className="ml-2 text-ccaBlue">• {courseProgress[course.id]}% Complete</span>
                      )}
                    </div>
                    {course.summary && (
                      <p className="text-sm text-neutral-500 mt-2 line-clamp-2">{course.summary}</p>
                    )}
                    {user && courseProgress[course.id] !== undefined && (
                      <div className="mt-3">
                        <div className="w-full h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-gradient-to-r from-ccaBlue to-ccaBlue/80 transition-all duration-300"
                            style={{ width: `${Math.max(courseProgress[course.id] || 0, 0)}%` }}
                          />
                        </div>
                      </div>
                    )}
              </div>
                {user && (
                  <button
                    onClick={async (e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      const now = await toggleSaved(user.uid, 'course', course.id, { title: course.title, slug: course.slug });
                      setSavedCourses(prev => ({ ...prev, [course.id]: now }));
                    }}
                    className={`absolute top-3 right-3 p-2 rounded-full backdrop-blur-sm transition ${
                      savedCourses[course.id] 
                        ? 'bg-red-500/90 text-white' 
                        : 'bg-neutral-900/80 text-neutral-400 hover:bg-neutral-800/90'
                    }`}
                    aria-label={savedCourses[course.id] ? 'Unsave course' : 'Save course'}
                  >
                    <svg className={`w-5 h-5 ${savedCourses[course.id] ? 'fill-current' : ''}`} viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 6 4 4 6.5 4c1.74 0 3.41 1 4.13 2.44C11.09 5 12.76 4 14.5 4 17 4 19 6 19 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                    </svg>
                </button>
                )}
            </Card>
          ))}
        </div>
        )}

        {viewerOpen && viewerInitial && (
          <CourseViewerModal
            courseSlug={viewerCourseSlug}
            courseTitle={viewerCourseTitle}
            modules={viewerModules}
            initialModuleId={viewerInitial.moduleId}
            initialLessonId={viewerInitial.lessonId}
            onClose={() => setViewerOpen(false)}
          />
        )}
      </main>
    </>
  );
}


