"use client";

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Image from 'next/image';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebaseClient';
import Link from 'next/link';
import CourseViewerModal from '@/components/CourseViewerModal';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { isLessonWatched, toggleSaved, isSaved, getCompletedLessons, getModuleProgress, getLessonProgressPercent } from '@/lib/userData';

type Lesson = {
  id: string;
  title: string;
  index: number;
  durationSec?: number;
  freePreview?: boolean;
  muxAssetId?: string;
  muxPlaybackId?: string;
  muxAnimatedGifUrl?: string;
  description?: string;
};

type Module = {
  id: string;
  title: string;
  index: number;
  lessons: Lesson[];
};

type Course = {
  id: string;
  title: string;
  slug: string;
  summary?: string;
  coverImage?: string;
  lessonsCount: number;
  modulesCount: number;
  featured?: boolean;
  modules: Module[];
};

export default function CourseDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [course, setCourse] = useState<Course | null>(null);
  const [loading, setLoading] = useState(true);
  const slug = params?.slug as string || '';
  const { user } = useAuth();
  const [savedCourse, setSavedCourse] = useState(false);
  const [savedLessons, setSavedLessons] = useState<Record<string, boolean>>({});
  const [watchedLessons, setWatchedLessons] = useState<Record<string, boolean>>({});
  const [completedLessons, setCompletedLessons] = useState<string[]>([]);
  const [courseProgress, setCourseProgress] = useState<number>(0);
  const [moduleProgress, setModuleProgress] = useState<Record<string, number>>({});
  const [lessonProgress, setLessonProgress] = useState<Record<string, number>>({});
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerModuleId, setViewerModuleId] = useState<string>('');
  const [viewerLessonId, setViewerLessonId] = useState<string>('');

  useEffect(() => {
    async function fetchCourse() {
      if (!slug || !db) {
        setLoading(false);
        return;
      }

      try {
        // Find course by slug
        const coursesRef = collection(db, 'courses');
        const snapshot = await getDocs(coursesRef);
        
        let courseDoc: any = null;
        let courseId: string | null = null;
        
        snapshot.forEach((doc) => {
          const data = doc.data();
          if (data.slug === slug || doc.id === slug) {
            courseDoc = data;
            courseId = doc.id;
          }
        });

        if (!courseDoc || !courseId) {
          setLoading(false);
          return;
        }

        // Fetch modules
        const modulesRef = collection(db, `courses/${courseId}/modules`);
        const modulesSnapshot = await getDocs(query(modulesRef, orderBy('index', 'asc')));
        
        const modules: Module[] = [];
        
        for (const moduleDoc of modulesSnapshot.docs) {
          const moduleData = moduleDoc.data();
          
          // Fetch lessons for this module
          const lessonsRef = collection(db, `courses/${courseId}/modules/${moduleDoc.id}/lessons`);
          const lessonsSnapshot = await getDocs(query(lessonsRef, orderBy('index', 'asc')));
          
          const lessons: Lesson[] = [];
          lessonsSnapshot.forEach((lessonDoc) => {
            const lessonData = lessonDoc.data();
            lessons.push({
              id: lessonDoc.id,
              title: lessonData.title || 'Untitled Lesson',
              index: lessonData.index || 0,
              durationSec: lessonData.durationSec,
              freePreview: lessonData.freePreview || false,
              muxAssetId: lessonData.muxAssetId,
              muxPlaybackId: lessonData.muxPlaybackId,
              muxAnimatedGifUrl: lessonData.muxAnimatedGifUrl,
              description: lessonData.description,
            });
          });

          modules.push({
            id: moduleDoc.id,
            title: moduleData.title || 'Untitled Module',
            index: moduleData.index || 0,
            lessons,
          });
        }

        setCourse({
          id: courseId,
          title: courseDoc.title || 'Untitled Course',
          slug: courseDoc.slug || courseId,
          summary: courseDoc.summary,
          coverImage: courseDoc.coverImage,
          lessonsCount: courseDoc.lessonsCount || 0,
          modulesCount: courseDoc.modulesCount || 0,
          featured: courseDoc.featured || false,
          modules,
        });
      } catch (error) {
        console.error('Error fetching course:', error);
      } finally {
        setLoading(false);
      }
    }

    if (slug) {
      fetchCourse();
    }
  }, [slug]);

  // Open modal via deep link ?lesson=moduleId/lessonId
  useEffect(() => {
    const q = searchParams?.get('lesson');
    if (q && course) {
      const [mod, les] = q.split('/');
      if (mod && les) {
        setViewerModuleId(mod);
        setViewerLessonId(les);
        setViewerOpen(true);
      }
    }
  }, [searchParams, course]);

  useEffect(() => {
    async function computeStates() {
      if (!user || !course) return;
      try {
        const sc = await isSaved(user.uid, 'course', course.id);
        setSavedCourse(sc);
      } catch {}

      const saved: Record<string, boolean> = {};
      const watched: Record<string, boolean> = {};
      for (const mod of course.modules) {
        for (const les of mod.lessons) {
          const key = `${mod.id}/${les.id}`;
          try { saved[key] = await isSaved(user.uid, 'lesson', `${course.slug}|${mod.id}|${les.id}`); } catch { saved[key] = false; }
          try { watched[key] = await isLessonWatched(user.uid, course.slug, key); } catch { watched[key] = false; }
        }
      }
      setSavedLessons(saved);
      setWatchedLessons(watched);

      // Get completed lessons and calculate progress
      try {
        const completed = await getCompletedLessons(user.uid, course.slug);
        setCompletedLessons(completed);

        // Calculate course progress
        const totalLessons = course.modules.reduce((sum, mod) => sum + mod.lessons.length, 0);
        const courseProgressValue = totalLessons > 0 ? Math.round((completed.length / totalLessons) * 100) : 0;
        setCourseProgress(courseProgressValue);

        // Calculate module progress
        const modProgress: Record<string, number> = {};
        const lessonProgressMap: Record<string, number> = {};
        for (const mod of course.modules) {
          const moduleLessonPaths = mod.lessons.map(les => `${mod.id}/${les.id}`);
          modProgress[mod.id] = getModuleProgress(completed, mod.id, moduleLessonPaths);
          
          // Get individual lesson progress
          for (const les of mod.lessons) {
            const lessonPath = `${mod.id}/${les.id}`;
            const progress = await getLessonProgressPercent(user.uid, course.slug, lessonPath);
            lessonProgressMap[lessonPath] = progress;
          }
        }
        // Initialize all modules with progress (even if 0)
        setModuleProgress(modProgress);
        setLessonProgress(lessonProgressMap);
      } catch (error) {
        console.error('Error fetching progress:', error);
      }
    }
    computeStates();
  }, [user, course]);

  if (loading) {
    return (
      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="animate-pulse">
          <div className="h-8 bg-neutral-800 rounded w-1/3 mb-4"></div>
          <div className="h-4 bg-neutral-800 rounded w-2/3 mb-8"></div>
          <div className="space-y-6">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="border border-neutral-800 rounded-lg p-4">
                <div className="h-6 bg-neutral-800 rounded w-1/4 mb-4"></div>
                <div className="space-y-2">
                  {[...Array(4)].map((_, j) => (
                    <div key={j} className="h-4 bg-neutral-800 rounded w-full"></div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    );
  }

  if (!course) {
    return (
      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="text-center">
          <h1 className="text-3xl md:text-4xl font-bold mb-4">Course Not Found</h1>
          <p className="text-neutral-400 mb-8">The course you're looking for doesn't exist.</p>
          <Link href="/learn" className="text-ccaBlue hover:underline">
            ← Back to All Courses
          </Link>
        </div>
      </main>
    );
  }

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getMuxThumbnailUrl = (playbackId?: string, durationSec?: number) => {
    if (!playbackId) return '';
    const time = durationSec && durationSec > 0 ? Math.floor(durationSec / 2) : 1;
    // See Mux Image API: https://docs.mux.com/guides/video/create-video-thumbnails
    return `https://image.mux.com/${playbackId}/thumbnail.jpg?time=${time}&width=320&fit_mode=preserve`;
  };

  return (
    <main className="max-w-7xl mx-auto px-6 py-8">
      <Link href="/learn" className="text-ccaBlue hover:underline mb-4 inline-block">
        ← Back to All Courses
      </Link>

      <div className="mt-6">
        <div className="flex items-center justify-between gap-3 mb-4">
          <h1 className="text-4xl md:text-5xl font-bold">{course.title}</h1>
          {user && (
            <button
              onClick={async () => {
                if (!user || !course) return;
                const nowSaved = await toggleSaved(user.uid, 'course', course.id, { title: course.title, slug: course.slug });
                setSavedCourse(nowSaved);
              }}
              className={`inline-flex items-center gap-2 text-sm px-3 py-1 border ${savedCourse ? 'border-red-500 text-red-400' : 'border-neutral-700 text-neutral-400'} hover:bg-neutral-800`}
            >
              <svg className={`w-4 h-4 ${savedCourse ? 'fill-red-500' : ''}`} viewBox="0 0 24 24" fill="currentColor"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 6 4 4 6.5 4c1.74 0 3.41 1 4.13 2.44C11.09 5 12.76 4 14.5 4 17 4 19 6 19 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
              {savedCourse ? 'Saved' : 'Save Course'}
            </button>
          )}
        </div>
        {course.summary && (
          <p className="text-lg text-neutral-400 mb-6 max-w-3xl">{course.summary}</p>
        )}
        
        <div className="flex gap-4 text-sm text-neutral-400 mb-8">
          <span>{course.lessonsCount} lesson{course.lessonsCount !== 1 ? 's' : ''}</span>
          <span>•</span>
          <span>{course.modulesCount} module{course.modulesCount !== 1 ? 's' : ''}</span>
          {user && (
            <>
              <span>•</span>
              <span className="text-ccaBlue font-medium">{courseProgress}% Complete</span>
            </>
          )}
        </div>

        {/* Course Progress Bar */}
        {user && (
          <div className="mb-6">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-neutral-400">Overall Progress</span>
              <span className="text-ccaBlue font-medium">{courseProgress}%</span>
            </div>
            <div className="w-full h-2 bg-neutral-800 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-ccaBlue to-ccaBlue/80 transition-all duration-300"
                style={{ width: `${Math.max(courseProgress, 0)}%` }}
              />
            </div>
          </div>
        )}

        {course.modules.length === 0 ? (
          <div className="text-center text-neutral-400 py-12">
            <p>No modules or lessons available yet.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {course.modules.map((module) => (
              <div
                key={module.id}
                className="border border-neutral-800 rounded-lg bg-neutral-950/60 backdrop-blur-sm overflow-hidden"
              >
                <div className="bg-neutral-900/60 px-6 py-4 border-b border-neutral-800">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-xl font-semibold">
                        {module.title}
                      </h2>
                      <p className="text-sm text-neutral-400 mt-1">
                        {module.lessons.length} lesson{module.lessons.length !== 1 ? 's' : ''}
                        {user && moduleProgress[module.id] !== undefined && (
                          <span className="ml-2 text-ccaBlue">• {moduleProgress[module.id]}% Complete</span>
                        )}
                      </p>
                    </div>
                    {user && moduleProgress[module.id] !== undefined && (
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-neutral-400">{moduleProgress[module.id]}%</span>
                        <div className="w-24 h-2 bg-neutral-800 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-gradient-to-r from-ccaBlue to-ccaBlue/80 transition-all duration-300"
                            style={{ width: `${Math.max(moduleProgress[module.id] || 0, 0)}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="divide-y divide-neutral-800">
                  {module.lessons.map((lesson, index) => (
                    <div
                      key={lesson.id}
                      className="px-6 py-4 hover:bg-neutral-900/40 transition flex items-center justify-between group"
                    >
                      <div className="flex items-center gap-4 flex-1">
                        {/* Lesson thumbnail from Mux */}
                        {lesson.muxPlaybackId ? (
                          <div className="relative w-24 h-14 rounded overflow-hidden bg-neutral-800 flex-shrink-0">
                            {lesson.muxAnimatedGifUrl ? (
                              <img
                                src={lesson.muxAnimatedGifUrl}
                                alt={`${lesson.title} animated thumbnail`}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <Image
                                src={getMuxThumbnailUrl(lesson.muxPlaybackId, lesson.durationSec) || ''}
                                alt={`${lesson.title} thumbnail`}
                                fill
                                sizes="96px"
                                className="object-cover"
                                priority={false}
                              />
                            )}
                          </div>
                        ) : (
                          <div className="w-24 h-14 rounded bg-neutral-800 flex-shrink-0" />
                        )}
                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-neutral-800 flex items-center justify-center text-sm text-neutral-400 group-hover:bg-ccaBlue group-hover:text-white transition">
                          {lesson.index}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{lesson.title}</span>
                            {watchedLessons[`${module.id}/${lesson.id}`] && (
                              <span className="inline-flex items-center text-xs text-green-400 gap-1">
                                <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg>
                                Watched
                              </span>
                            )}
                            {lesson.freePreview && (
                              <span className="text-xs px-2 py-1 rounded bg-ccaBlue/20 text-ccaBlue border border-ccaBlue/30">
                                Preview
                              </span>
                            )}
                            {lesson.muxPlaybackId && (
                              <span className="text-xs text-neutral-500">• Video Available</span>
                            )}
                          </div>
                          {lesson.durationSec && (
                            <p className="text-sm text-neutral-500 mt-1">
                              {formatDuration(lesson.durationSec)}
                            </p>
                          )}
                          {user && lessonProgress[`${module.id}/${lesson.id}`] !== undefined && lessonProgress[`${module.id}/${lesson.id}`] > 0 && (
                            <div className="mt-2 flex items-center gap-2">
                              <div className="flex-1 h-1 bg-neutral-800 rounded-full overflow-hidden max-w-[200px]">
                                <div 
                                  className={`h-full transition-all duration-300 ${
                                    lessonProgress[`${module.id}/${lesson.id}`] >= 80 
                                      ? 'bg-green-500' 
                                      : 'bg-ccaBlue'
                                  }`}
                                  style={{ width: `${lessonProgress[`${module.id}/${lesson.id}`]}%` }}
                                />
                              </div>
                              <span className="text-xs text-neutral-400">
                                {lessonProgress[`${module.id}/${lesson.id}`]}%
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {user && (
                          <button
                            onClick={async () => {
                              if (!user || !course) return;
                              const key = `${module.id}/${lesson.id}`;
                              const nowSaved = await toggleSaved(user.uid, 'lesson', `${course.slug}|${module.id}|${lesson.id}`, {
                                courseSlug: course.slug,
                                moduleId: module.id,
                                lessonId: lesson.id,
                                title: lesson.title,
                                muxPlaybackId: lesson.muxPlaybackId,
                                durationSec: lesson.durationSec,
                              });
                              setSavedLessons(prev => ({ ...prev, [key]: nowSaved }));
                            }}
                            className={`inline-flex items-center gap-1 text-xs px-2 py-1 border ${savedLessons[`${module.id}/${lesson.id}`] ? 'border-red-500 text-red-400' : 'border-neutral-700 text-neutral-400'} hover:bg-neutral-800`}
                          >
                            <svg className={`w-4 h-4 ${savedLessons[`${module.id}/${lesson.id}`] ? 'fill-red-500' : ''}`} viewBox="0 0 24 24" fill="currentColor"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 6 4 4 6.5 4c1.74 0 3.41 1 4.13 2.44C11.09 5 12.76 4 14.5 4 17 4 19 6 19 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
                            {savedLessons[`${module.id}/${lesson.id}`] ? 'Saved' : 'Save'}
                          </button>
                        )}
                        {lesson.muxPlaybackId ? (
                          <button
                            onClick={() => {
                              setViewerModuleId(module.id);
                              setViewerLessonId(lesson.id);
                              setViewerOpen(true);
                              const sp = new URLSearchParams(Array.from(searchParams?.entries() || []));
                              sp.set('lesson', `${module.id}/${lesson.id}`);
                              router.replace(`/learn/${course.slug}?${sp.toString()}`);
                            }}
                            className="text-ccaBlue hover:text-white transition px-3 py-1 hover:bg-ccaBlue/20 text-sm border border-transparent"
                          >
                            Watch →
                          </button>
                        ) : (
                          <span className="text-neutral-600 text-sm px-3 py-1">Coming Soon</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      {viewerOpen && course && (
        <CourseViewerModal
          courseSlug={course.slug}
          courseTitle={course.title}
          modules={course.modules.map(m => ({ id: m.id, title: m.title, index: m.index, lessons: m.lessons.map(l => ({ id: l.id, title: l.title, index: l.index, durationSec: l.durationSec, muxPlaybackId: l.muxPlaybackId, description: l.description })) }))}
          initialModuleId={viewerModuleId}
          initialLessonId={viewerLessonId}
          onClose={() => {
            setViewerOpen(false);
            const sp = new URLSearchParams(Array.from(searchParams?.entries() || []));
            sp.delete('lesson');
            router.replace(`/learn/${course.slug}${sp.toString() ? `?${sp.toString()}` : ''}`);
          }}
        />
      )}
    </main>
  );
}

