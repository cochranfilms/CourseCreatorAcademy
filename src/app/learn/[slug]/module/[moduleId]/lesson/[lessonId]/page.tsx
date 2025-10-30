"use client";

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import MuxPlayer from '@mux/mux-player-react';
import { collection, doc, getDoc, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { markLessonWatched, toggleSaved, isSaved } from '@/lib/userData';

type Lesson = {
  id: string;
  title: string;
  index: number;
  durationSec?: number;
  freePreview?: boolean;
  muxAssetId?: string | null;
  muxPlaybackId?: string | null;
};

export default function LessonPage() {
  const params = useParams();
  const slug = (params?.slug as string) || '';
  const moduleId = (params?.moduleId as string) || '';
  const lessonId = (params?.lessonId as string) || '';

  const [loading, setLoading] = useState(true);
  const [courseTitle, setCourseTitle] = useState('');
  const [moduleTitle, setModuleTitle] = useState('');
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const { user } = useAuth();
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    async function fetchLesson() {
      if (!db || !slug || !moduleId || !lessonId) {
        setLoading(false);
        return;
      }

      try {
        // Find the course by slug → get courseId
        const coursesRef = collection(db, 'courses');
        const coursesSnap = await getDocs(coursesRef);
        let courseId: string | null = null;
        let courseData: any = null;
        coursesSnap.forEach((d) => {
          const data = d.data();
          if (data.slug === slug || d.id === slug) {
            courseId = d.id;
            courseData = data;
          }
        });

        if (!courseId) {
          setLoading(false);
          return;
        }
        setCourseTitle(courseData?.title || 'Course');

        // Read the module doc for its title
        const moduleRef = doc(db, `courses/${courseId}/modules/${moduleId}`);
        const moduleSnap = await getDoc(moduleRef);
        const moduleData = moduleSnap.data();
        setModuleTitle((moduleData as any)?.title || 'Module');

        // Read the lesson
        const lessonRef = doc(db, `courses/${courseId}/modules/${moduleId}/lessons/${lessonId}`);
        const lessonSnap = await getDoc(lessonRef);
        const lData = lessonSnap.data() as any;
        if (lessonSnap.exists()) {
          setLesson({
            id: lessonSnap.id,
            title: lData?.title || 'Lesson',
            index: lData?.index || 0,
            durationSec: lData?.durationSec,
            freePreview: lData?.freePreview || false,
            muxAssetId: lData?.muxAssetId || null,
            muxPlaybackId: lData?.muxPlaybackId || null,
          });
        }
      } catch (err) {
        console.error('Error loading lesson:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchLesson();
  }, [slug, moduleId, lessonId]);

  // Mark watched when lesson loads
  useEffect(() => {
    if (!user || !lesson) return;
    markLessonWatched(user.uid, slug, `${moduleId}/${lessonId}`);
  }, [user, lesson]);

  useEffect(() => {
    async function checkSaved() {
      if (!user) return;
      const s = await isSaved(user.uid, 'lesson', `${slug}|${moduleId}|${lessonId}`);
      setSaved(s);
    }
    checkSaved();
  }, [user, slug, moduleId, lessonId]);

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="animate-pulse">
          <div className="h-6 bg-neutral-800 rounded w-1/3 mb-4"></div>
          <div className="h-96 bg-neutral-900 rounded border border-neutral-800"></div>
        </div>
      </main>
    );
  }

  if (!lesson) {
    return (
      <main className="max-w-7xl mx-auto px-6 py-8">
        <Link href={`/learn/${slug}`} className="text-ccaBlue hover:underline mb-4 inline-block">
          ← Back to {courseTitle || 'Course'}
        </Link>
        <h1 className="text-3xl md:text-4xl font-bold mb-2">Lesson Not Found</h1>
        <p className="text-neutral-400">This lesson does not exist or is not available.</p>
      </main>
    );
  }

  return (
    <main className="max-w-7xl mx-auto px-6 py-8">
      <div className="mb-4 text-sm">
        <Link href={`/learn/${slug}`} className="text-ccaBlue hover:underline">
          ← Back to {courseTitle || 'Course'}
        </Link>
      </div>

      <h1 className="text-2xl md:text-3xl font-bold">{lesson.title}</h1>
      <div className="mt-2">
        <button
          onClick={async () => {
            if (!user) return;
            const nowSaved = await toggleSaved(user.uid, 'lesson', `${slug}|${moduleId}|${lessonId}`, {
              courseSlug: slug,
              moduleId,
              lessonId,
              title: lesson.title,
              muxPlaybackId: lesson.muxPlaybackId,
              durationSec: lesson.durationSec,
            });
            setSaved(nowSaved);
          }}
          className={`inline-flex items-center gap-2 text-sm px-3 py-1 border ${saved ? 'border-red-500 text-red-400' : 'border-neutral-700 text-neutral-400'} hover:bg-neutral-800`}
        >
          <svg className={`w-4 h-4 ${saved ? 'fill-red-500' : ''}`} viewBox="0 0 24 24" fill="currentColor"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 6 4 4 6.5 4c1.74 0 3.41 1 4.13 2.44C11.09 5 12.76 4 14.5 4 17 4 19 6 19 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
          {saved ? 'Saved' : 'Save'}
        </button>
      </div>
      <p className="text-neutral-400 mt-1">{moduleTitle} • {lesson.index > 0 ? `Lesson ${lesson.index}` : 'Lesson'}</p>
      {lesson.durationSec ? (
        <p className="text-neutral-500 text-sm mt-1">{formatDuration(lesson.durationSec)}</p>
      ) : null}

      <div className="mt-6 rounded-2xl overflow-hidden border border-neutral-800 bg-black">
        {lesson.muxPlaybackId ? (
          <MuxPlayer
            className="w-full h-full"
            style={{ aspectRatio: '16 / 9' }}
            playbackId={lesson.muxPlaybackId}
            autoPlay={false}
            streamType="on-demand"
            primaryColor="#3B82F6"
            accentColor="#1f2937"
          />
        ) : (
          <div className="aspect-video flex items-center justify-center text-neutral-400">
            Video not available yet.
          </div>
        )}
      </div>
    </main>
  );
}


