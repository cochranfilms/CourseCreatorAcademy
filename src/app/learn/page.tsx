"use client";

import { useEffect, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebaseClient';
import Link from 'next/link';

type Course = {
  id: string;
  title: string;
  slug: string;
  summary?: string;
  coverImage?: string;
  lessonsCount: number;
  modulesCount: number;
  featured?: boolean;
};

export default function LearnPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchCourses() {
      try {
        const coursesRef = collection(db, 'courses');
        const snapshot = await getDocs(coursesRef);
        
        const coursesData: Course[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          coursesData.push({
            id: doc.id,
            title: data.title || 'Untitled Course',
            slug: data.slug || doc.id,
            summary: data.summary,
            coverImage: data.coverImage,
            lessonsCount: data.lessonsCount || 0,
            modulesCount: data.modulesCount || 0,
            featured: data.featured || false,
          });
        });

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
            <Link
              key={course.id}
              href={`/learn/${course.slug}`}
              className="rounded-2xl overflow-hidden border border-neutral-800 bg-gradient-to-b from-neutral-900 to-neutral-950 hover:border-ccaBlue transition cursor-pointer group"
            >
              <div className="h-40 bg-neutral-800 group-hover:bg-neutral-700 transition">
                {course.coverImage ? (
                  <img
                    src={course.coverImage}
                    alt={course.title}
                    className="w-full h-full object-cover"
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
          ))}
        </div>
      )}
    </main>
  );
}


