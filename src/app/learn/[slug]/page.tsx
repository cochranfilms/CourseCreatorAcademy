"use client";

import { useEffect, useState } from 'react';
import { doc, getDoc, collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebaseClient';
import Link from 'next/link';

type Lesson = {
  id: string;
  title: string;
  index: number;
  durationSec?: number;
  freePreview?: boolean;
  muxAssetId?: string;
  muxPlaybackId?: string;
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

export default function CourseDetailPage({ params }: { params: Promise<{ slug: string }> | { slug: string } }) {
  const [course, setCourse] = useState<Course | null>(null);
  const [loading, setLoading] = useState(true);
  const [slug, setSlug] = useState<string>('');

  useEffect(() => {
    // Handle both Promise and sync params (Next.js 15 compatibility)
    async function extractSlug() {
      if (params instanceof Promise) {
        const resolved = await params;
        setSlug(resolved.slug);
      } else if (params && typeof params === 'object' && 'slug' in params) {
        setSlug(params.slug);
      }
    }
    extractSlug();
  }, [params]);

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
        
        let courseDoc = null;
        let courseId = null;
        
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

  return (
    <main className="max-w-7xl mx-auto px-6 py-8">
      <Link href="/learn" className="text-ccaBlue hover:underline mb-4 inline-block">
        ← Back to All Courses
      </Link>

      <div className="mt-6">
        <h1 className="text-4xl md:text-5xl font-bold mb-4">{course.title}</h1>
        {course.summary && (
          <p className="text-lg text-neutral-400 mb-6 max-w-3xl">{course.summary}</p>
        )}
        
        <div className="flex gap-4 text-sm text-neutral-400 mb-8">
          <span>{course.lessonsCount} lesson{course.lessonsCount !== 1 ? 's' : ''}</span>
          <span>•</span>
          <span>{course.modulesCount} module{course.modulesCount !== 1 ? 's' : ''}</span>
        </div>

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
                  <h2 className="text-xl font-semibold">
                    {module.title}
                  </h2>
                  <p className="text-sm text-neutral-400 mt-1">
                    {module.lessons.length} lesson{module.lessons.length !== 1 ? 's' : ''}
                  </p>
                </div>
                
                <div className="divide-y divide-neutral-800">
                  {module.lessons.map((lesson, index) => (
                    <div
                      key={lesson.id}
                      className="px-6 py-4 hover:bg-neutral-900/40 transition flex items-center justify-between group"
                    >
                      <div className="flex items-center gap-4 flex-1">
                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-neutral-800 flex items-center justify-center text-sm text-neutral-400 group-hover:bg-ccaBlue group-hover:text-white transition">
                          {lesson.index}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{lesson.title}</span>
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
                        </div>
                      </div>
                      
                      {lesson.muxPlaybackId ? (
                        <Link
                          href={`/learn/${course.slug}/module/${module.id}/lesson/${lesson.id}` as any}
                          className="text-ccaBlue hover:text-white transition px-4 py-2 rounded hover:bg-ccaBlue/20"
                        >
                          Watch →
                        </Link>
                      ) : (
                        <span className="text-neutral-600 text-sm px-4 py-2">
                          Coming Soon
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

