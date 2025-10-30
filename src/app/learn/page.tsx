"use client";

import { useEffect, useState } from 'react';
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { db } from '@/lib/firebaseClient';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@/contexts/AuthContext';
import { isSaved, toggleSaved } from '@/lib/userData';

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
  const { user } = useAuth();
  const [savedCourses, setSavedCourses] = useState<Record<string, boolean>>({});

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

  // Compute saved state for courses
  useEffect(() => {
    async function computeSaved() {
      if (!user || courses.length === 0) return;
      const saved: Record<string, boolean> = {};
      for (const course of courses) {
        saved[course.id] = await isSaved(user.uid, 'course', course.id);
      }
      setSavedCourses(saved);
    }
    computeSaved();
  }, [user, courses]);

  if (loading) {
    return (
      <main className="max-w-7xl mx-auto px-6 py-8">
        <h1 className="text-3xl md:text-4xl font-bold">All Courses</h1>
        <div className="mt-6 grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="rounded-2xl overflow-hidden border border-neutral-800 bg-gradient-to-b from-neutral-900 to-neutral-950 animate-pulse">
              <div className="h-40 bg-neutral-800" />
              <div className="p-4">
                <div className="h-5 bg-neutral-800 rounded w-3/4 mb-2"></div>
                <div className="h-4 bg-neutral-800 rounded w-1/2"></div>
              </div>
            </div>
          ))}
        </div>
      </main>
    );
  }

  return (
    <main className="max-w-7xl mx-auto px-6 py-8">
      <h1 className="text-3xl md:text-4xl font-bold">All Courses</h1>
      {courses.length === 0 ? (
        <div className="mt-8 text-center text-neutral-400">
          <p>No courses available yet.</p>
        </div>
      ) : (
      <div className="mt-6 grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {courses.map((course) => (
            <div
              key={course.id}
              className="rounded-2xl overflow-hidden border border-neutral-800 bg-gradient-to-b from-neutral-900 to-neutral-950 hover:border-ccaBlue transition group relative"
            >
              <Link
                href={`/learn/${course.slug}` as any}
                className="block"
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
                  </div>
                  {course.summary && (
                    <p className="text-sm text-neutral-500 mt-2 line-clamp-2">{course.summary}</p>
                  )}
                </div>
              </Link>
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
            </div>
        ))}
      </div>
      )}
    </main>
  );
}


