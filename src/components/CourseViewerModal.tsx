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
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-2 sm:p-4" onClick={onClose}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      <div className="relative z-[201] w-full max-w-[1200px] max-h-[95vh] sm:max-h-[90vh] bg-neutral-900 border border-neutral-800 shadow-2xl overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] flex-1 min-h-0 overflow-hidden">
          {/* Left: Player & header */}
          <div className="p-2 sm:p-4 overflow-y-auto min-h-0 flex flex-col">
            <div className="text-xs sm:text-sm mb-1 sm:mb-2 text-neutral-400 truncate">{courseTitle}</div>
            <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-white mb-2 sm:mb-0 line-clamp-2">{lesson.title}</h2>
            <div className="mt-2 flex flex-wrap items-center gap-1.5 sm:gap-2">
              <button
                className={`px-2 sm:px-3 py-1 text-xs sm:text-sm border ${saved ? 'border-red-500 text-red-400' : 'border-neutral-700 text-neutral-300'} hover:bg-neutral-800 transition-colors`}
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
              <button className="px-2 sm:px-3 py-1 text-xs sm:text-sm border border-neutral-700 text-neutral-300 hover:bg-neutral-800 transition-colors whitespace-nowrap" onClick={gotoNext}>
                <span className="hidden sm:inline">Next Lesson →</span>
                <span className="sm:hidden">Next →</span>
              </button>
              <button className="ml-auto px-2 sm:px-3 py-1 text-xs sm:text-sm border border-neutral-700 text-neutral-300 hover:bg-neutral-800 transition-colors" onClick={onClose}>
                <span className="hidden sm:inline">Close ✕</span>
                <span className="sm:hidden">✕</span>
              </button>
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

            <div className="mt-2 sm:mt-3 bg-black border border-neutral-800 flex-shrink-0">
              {lesson.muxPlaybackId ? (
              <MuxPlayer
                playbackId={lesson.muxPlaybackId || undefined}
                streamType="on-demand"
                primaryColor="#3B82F6"
                className="w-full"
                style={{ aspectRatio: '16 / 9', maxHeight: 'calc(95vh - 300px)' }}
                playsInline
                preload="metadata"
                // @ts-ignore
                preferMse
                // Cap resolution to reduce device decoder pressure on Safari/iOS
                // @ts-ignore
                maxResolution="540p"
                // Reduce iOS/Safari edge cases
                // @ts-ignore
                disablePictureInPicture
                // @ts-ignore
                autoPictureInPicture={false}
                startTime={resumePos || undefined}
                onTimeUpdate={handleTimeUpdate}
                onEnded={handleEnded}
              />
              ) : (
                <div className="aspect-video flex items-center justify-center text-neutral-400 text-sm">Video not available</div>
              )}
            </div>

          {lesson.description || fetchedDescription ? (
            <div className="mt-3 sm:mt-4 flex-shrink-0">
              <h3 className="text-xs sm:text-sm font-semibold text-neutral-300 mb-1">Description</h3>
              <div className="border border-neutral-800 bg-neutral-950 p-2 sm:p-3 rounded max-h-32 sm:max-h-48 md:max-h-64 overflow-y-auto">
                <p className="text-xs sm:text-sm text-neutral-300 whitespace-pre-wrap">{lesson.description || fetchedDescription}</p>
              </div>
            </div>
          ) : null}
          </div>

          {/* Right: Playlist */}
          <div className="border-t lg:border-t-0 lg:border-l border-neutral-800 bg-neutral-950 overflow-y-auto p-2 sm:p-3 flex-shrink-0 lg:max-h-full">
            <div className="text-xs sm:text-sm text-neutral-400 mb-2 font-medium">Playlist</div>
            {modules.map(m => (
              <div key={m.id} className="mb-2 sm:mb-3">
                <div className="text-xs sm:text-sm text-neutral-300 font-medium mb-1 truncate">{m.title}</div>
                <div className="space-y-0.5 sm:space-y-1">
                  {m.lessons.map(l => (
                    <button
                      key={l.id}
                      className={`w-full text-left px-1.5 sm:px-2 py-1.5 sm:py-2 border text-xs sm:text-sm transition-colors ${m.id === module.id && l.id === lesson.id ? 'border-ccaBlue bg-ccaBlue/10 text-white' : 'border-neutral-800 text-neutral-300 hover:bg-neutral-900'}`}
                      onClick={() => { setModuleId(m.id); setLessonId(l.id); }}
                    >
                      <div className="flex items-center justify-between gap-1 sm:gap-2">
                        <span className="truncate flex-1 min-w-0">{l.index}. {l.title}</span>
                        {typeof l.durationSec === 'number' && (
                          <span className="text-xs text-neutral-500 whitespace-nowrap flex-shrink-0">{Math.floor((l.durationSec || 0)/60)}:{String((l.durationSec || 0)%60).padStart(2,'0')}</span>
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


