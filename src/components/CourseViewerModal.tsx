"use client";

import { useEffect, useMemo, useRef, useState } from 'react';
import MuxPlayer from '@mux/mux-player-react';
import { useAuth } from '@/contexts/AuthContext';
import { toggleSaved, isSaved, updateLessonProgress, getLessonProgress } from '@/lib/userData';
import { collection, doc, getDoc, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebaseClient';

export type CVLesson = {
  id: string;
  title: string;
  index: number;
  durationSec?: number;
  muxPlaybackId?: string | null;
  description?: string;
};

export type CVModule = {
  id: string;
  title: string;
  index: number;
  lessons: CVLesson[];
};

type Props = {
  courseSlug: string;
  courseTitle: string;
  modules: CVModule[];
  initialModuleId: string;
  initialLessonId: string;
  onClose: () => void;
};

export default function CourseViewerModal({ courseSlug, courseTitle, modules, initialModuleId, initialLessonId, onClose }: Props) {
  const { user } = useAuth();
  const [moduleId, setModuleId] = useState(initialModuleId);
  const [lessonId, setLessonId] = useState(initialLessonId);
  const [saved, setSaved] = useState(false);
  const [progressPct, setProgressPct] = useState(0);
  const [resumePos, setResumePos] = useState<number | null>(null);
  const progressDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const [fetchedDescription, setFetchedDescription] = useState<string | null>(null);

  const module = useMemo(() => modules.find(m => m.id === moduleId) || modules[0], [modules, moduleId]);
  const lesson = useMemo(() => module?.lessons.find(l => l.id === lessonId) || module?.lessons[0], [module, lessonId]);

  useEffect(() => {
    const loadSaved = async () => {
      if (!user || !lesson) return;
      const s = await isSaved(user.uid, 'lesson', `${courseSlug}|${moduleId}|${lessonId}`);
      setSaved(s);
      const p = await getLessonProgress(user.uid, courseSlug, `${moduleId}/${lessonId}`);
      if (p) {
        setProgressPct(p.progressPercent);
        if (p.lastPosition > 5) setResumePos(p.lastPosition);
      } else {
        setProgressPct(0);
        setResumePos(null);
      }
    };
    loadSaved();
  }, [user, courseSlug, moduleId, lessonId, lesson?.id]);

  // Fallback: fetch description directly if missing in props
  useEffect(() => {
    const maybeFetchDescription = async () => {
      setFetchedDescription(null);
      if (!db || !courseSlug || !moduleId || !lessonId) return;
      if (lesson?.description) return;
      try {
        const coursesRef = collection(db, 'courses');
        const snap = await getDocs(coursesRef);
        let courseId: string | null = null;
        snap.forEach((d) => {
          const data = d.data() as any;
          if (data.slug === courseSlug || d.id === courseSlug) {
            courseId = d.id;
          }
        });
        if (!courseId) return;
        const lref = doc(db, `courses/${courseId}/modules/${moduleId}/lessons/${lessonId}`);
        const lsnap = await getDoc(lref);
        const ldata = lsnap.data() as any;
        if (ldata?.description) setFetchedDescription(String(ldata.description));
      } catch {
        // ignore
      }
    };
    maybeFetchDescription();
  }, [db, courseSlug, moduleId, lessonId, lesson?.description]);

  const closeOnEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
  useEffect(() => {
    window.addEventListener('keydown', closeOnEsc);
    return () => window.removeEventListener('keydown', closeOnEsc);
  }, []);

  const handleTimeUpdate = (e: any) => {
    if (!user || !lesson?.durationSec || !lesson) return;
    const current = e.target.currentTime || 0;
    const pct = (current / lesson.durationSec) * 100;
    setProgressPct(pct);
    if (progressDebounceRef.current) clearTimeout(progressDebounceRef.current);
    progressDebounceRef.current = setTimeout(() => {
      updateLessonProgress(user.uid, courseSlug, `${moduleId}/${lessonId}`, pct, current).catch(() => {});
    }, 3000);
  };

  const handleEnded = () => {
    if (!user || !lesson) return;
    updateLessonProgress(user.uid, courseSlug, `${moduleId}/${lessonId}`, 100, lesson.durationSec || 0).catch(() => {});
    setProgressPct(100);
  };

  const gotoNext = () => {
    if (!module || !lesson) return;
    const idx = module.lessons.findIndex(l => l.id === lesson.id);
    if (idx >= 0 && idx < module.lessons.length - 1) {
      setLessonId(module.lessons[idx + 1].id);
    } else {
      // next module first lesson
      const mIdx = modules.findIndex(m => m.id === module.id);
      if (mIdx >= 0 && mIdx < modules.length - 1) {
        const nextM = modules[mIdx + 1];
        setModuleId(nextM.id);
        setLessonId(nextM.lessons[0]?.id || '');
      }
    }
  };

  if (!module || !lesson) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center" onClick={onClose}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      <div className="relative z-[201] m-4 md:m-8 w-full max-w-[1200px] mx-auto bg-neutral-900 border border-neutral-800 shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="grid grid-cols-1 md:grid-cols-[1fr_360px]">
          {/* Left: Player & header */}
          <div className="p-4">
            <div className="text-sm mb-2 text-neutral-400">{courseTitle}</div>
            <h2 className="text-xl md:text-2xl font-bold text-white">{lesson.title}</h2>
            <div className="mt-2 flex items-center gap-2">
              <button
                className={`px-3 py-1 border ${saved ? 'border-red-500 text-red-400' : 'border-neutral-700 text-neutral-300'} hover:bg-neutral-800`}
                onClick={async () => {
                  if (!user) return;
                  const now = await toggleSaved(user.uid, 'lesson', `${courseSlug}|${moduleId}|${lessonId}`, {
                    courseSlug, moduleId, lessonId, title: lesson.title, muxPlaybackId: lesson.muxPlaybackId, durationSec: lesson.durationSec,
                  });
                  setSaved(now);
                }}
              >
                {saved ? 'Saved' : 'Save'}
              </button>
              <button className="px-3 py-1 border border-neutral-700 text-neutral-300 hover:bg-neutral-800" onClick={gotoNext}>Next Lesson →</button>
              <button className="ml-auto px-3 py-1 border border-neutral-700 text-neutral-300 hover:bg-neutral-800" onClick={onClose}>Close ✕</button>
            </div>

            {progressPct > 0 && progressPct < 100 && (
              <div className="mt-3">
                <div className="flex items-center justify-between text-xs text-neutral-400 mb-1">
                  <span>Progress: {Math.round(progressPct)}%</span>
                </div>
                <div className="w-full h-1 bg-neutral-800 overflow-hidden">
                  <div className="h-full bg-ccaBlue" style={{ width: `${progressPct}%` }} />
                </div>
              </div>
            )}

            <div className="mt-3 bg-black border border-neutral-800">
              {lesson.muxPlaybackId ? (
                <MuxPlayer
                  playbackId={lesson.muxPlaybackId || undefined}
                  streamType="on-demand"
                  primaryColor="#3B82F6"
                  className="w-full"
                  style={{ aspectRatio: '16 / 9' }}
                  startTime={resumePos || undefined}
                  onTimeUpdate={handleTimeUpdate}
                  onEnded={handleEnded}
                />
              ) : (
                <div className="aspect-video flex items-center justify-center text-neutral-400">Video not available</div>
              )}
            </div>

          {lesson.description || fetchedDescription ? (
            <div className="mt-4">
              <h3 className="text-sm font-semibold text-neutral-300 mb-1">Description</h3>
              <div className="border border-neutral-800 bg-neutral-950 p-3 rounded max-h-64 overflow-y-auto">
                <p className="text-neutral-300 whitespace-pre-wrap">{lesson.description || fetchedDescription}</p>
              </div>
            </div>
          ) : null}
          </div>

          {/* Right: Playlist */}
          <div className="border-l border-neutral-800 bg-neutral-950 max-h-[85vh] overflow-y-auto p-3">
            <div className="text-sm text-neutral-400 mb-2">Playlist</div>
            {modules.map(m => (
              <div key={m.id} className="mb-3">
                <div className="text-neutral-300 font-medium mb-1">{m.title}</div>
                <div className="space-y-1">
                  {m.lessons.map(l => (
                    <button
                      key={l.id}
                      className={`w-full text-left px-2 py-2 border ${m.id === module.id && l.id === lesson.id ? 'border-ccaBlue text-white' : 'border-neutral-800 text-neutral-300 hover:bg-neutral-900'}`}
                      onClick={() => { setModuleId(m.id); setLessonId(l.id); }}
                    >
                      <div className="flex items-center justify-between">
                        <span className="truncate">{l.index}. {l.title}</span>
                        {typeof l.durationSec === 'number' && (
                          <span className="text-xs text-neutral-500 ml-2">{Math.floor((l.durationSec || 0)/60)}:{String((l.durationSec || 0)%60).padStart(2,'0')}</span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}


