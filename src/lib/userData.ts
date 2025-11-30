import { doc, setDoc, getDoc, updateDoc, arrayUnion, arrayRemove, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebaseClient';

export type SavedType = 'market' | 'video' | 'job' | 'asset' | 'course' | 'lesson';

export async function toggleSaved(userId: string, type: SavedType, targetId: string, data?: Record<string, any>) {
  if (!db) return false;
  const docId = `${type}_${targetId}`;
  const ref = doc(db, `users/${userId}/saved/${docId}`);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    // unsave
    await updateDoc(ref, { removedAt: serverTimestamp() });
    return false;
  }
  
  // Filter out undefined values from data object (Firestore doesn't accept undefined)
  const cleanData = data ? Object.fromEntries(
    Object.entries(data).filter(([_, value]) => value !== undefined)
  ) : {};
  
  await setDoc(ref, {
    type,
    targetId,
    createdAt: serverTimestamp(),
    ...cleanData,
  }, { merge: true });
  return true;
}

export async function isSaved(userId: string, type: SavedType, targetId: string) {
  if (!db) return false;
  const ref = doc(db, `users/${userId}/saved/${type}_${targetId}`);
  const snap = await getDoc(ref);
  return snap.exists() && !snap.data()?.removedAt;
}

// Progress tracking: users/{uid}/progress/{progressId}/courses/{courseId}
// Structure: 
// {
//   completedLessons: string[], // lessonPaths that are 80%+ watched
//   lessonProgress: { [lessonPath]: { progressPercent: number, lastPosition: number } },
//   lastLessonPath: string,
//   updatedAt: timestamp
// }

const COMPLETION_THRESHOLD = 80; // Minimum percentage to mark as complete
const PROGRESS_DOC_ID = 'default'; // single doc under /progress to host subcollections

export async function updateLessonProgress(
  userId: string, 
  courseId: string, 
  lessonPath: string, 
  progressPercent: number,
  lastPosition: number // seconds
) {
  if (!db) return;
  const ref = doc(db, `users/${userId}/progress/${PROGRESS_DOC_ID}/courses/${courseId}`);
  const snap = await getDoc(ref);
  
  const progressData = {
    progressPercent: Math.min(100, Math.max(0, Math.round(progressPercent))),
    lastPosition,
    updatedAt: serverTimestamp(),
  };

  if (!snap.exists()) {
    await setDoc(ref, {
      completedLessons: progressPercent >= COMPLETION_THRESHOLD ? [lessonPath] : [],
      lessonProgress: {
        [lessonPath]: progressData,
      },
      lastLessonPath: lessonPath,
      updatedAt: serverTimestamp(),
    });
    return;
  }

  const data = snap.data();
  const lessonProgress = data.lessonProgress || {};
  lessonProgress[lessonPath] = progressData;

  const completedLessons = new Set(data.completedLessons || []);
  
  // Add to completed if >= threshold, remove if not
  if (progressPercent >= COMPLETION_THRESHOLD) {
    completedLessons.add(lessonPath);
  } else {
    completedLessons.delete(lessonPath);
  }

  await updateDoc(ref, {
    completedLessons: Array.from(completedLessons),
    lessonProgress,
    lastLessonPath: lessonPath,
    updatedAt: serverTimestamp(),
  });
}

// Legacy function - kept for backward compatibility but now uses updateLessonProgress
export async function markLessonWatched(userId: string, courseId: string, lessonPath: string) {
  // This is now handled by updateLessonProgress
  // Keep for backward compatibility but updateLessonProgress should be used instead
  await updateLessonProgress(userId, courseId, lessonPath, 100, 0);
}

export async function getLessonProgress(
  userId: string, 
  courseId: string, 
  lessonPath: string
): Promise<{ progressPercent: number; lastPosition: number } | null> {
  if (!db) return null;
  const ref = doc(db, `users/${userId}/progress/${PROGRESS_DOC_ID}/courses/${courseId}`);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  
  const lessonProgress = snap.data()?.lessonProgress || {};
  return lessonProgress[lessonPath] || null;
}

export async function unmarkLessonWatched(userId: string, courseId: string, lessonPath: string) {
  if (!db) return;
  const ref = doc(db, `users/${userId}/progress/${PROGRESS_DOC_ID}/courses/${courseId}`);
  await updateDoc(ref, {
    completedLessons: arrayRemove(lessonPath),
    updatedAt: serverTimestamp(),
  });
}

export async function isLessonWatched(userId: string, courseId: string, lessonPath: string) {
  if (!db) return false;
  const ref = doc(db, `users/${userId}/progress/${PROGRESS_DOC_ID}/courses/${courseId}`);
  const snap = await getDoc(ref);
  if (!snap.exists()) return false;
  const arr = (snap.data()?.completedLessons || []) as string[];
  return arr.includes(lessonPath);
}

// Get completed lessons for a course
export async function getCompletedLessons(userId: string, courseId: string): Promise<string[]> {
  if (!db) return [];
  const ref = doc(db, `users/${userId}/progress/${PROGRESS_DOC_ID}/courses/${courseId}`);
  const snap = await getDoc(ref);
  if (!snap.exists()) return [];
  return (snap.data()?.completedLessons || []) as string[];
}

// Get lesson progress percentage
export async function getLessonProgressPercent(userId: string, courseId: string, lessonPath: string): Promise<number> {
  const progress = await getLessonProgress(userId, courseId, lessonPath);
  return progress?.progressPercent || 0;
}

// Get course progress percentage
export async function getCourseProgress(userId: string, courseId: string, totalLessons: number): Promise<number> {
  if (!db || totalLessons === 0) return 0;
  const completed = await getCompletedLessons(userId, courseId);
  return Math.round((completed.length / totalLessons) * 100);
}

// Get module progress percentage
export function getModuleProgress(completedLessons: string[], moduleId: string, moduleLessons: string[]): number {
  if (moduleLessons.length === 0) return 0;
  const completed = moduleLessons.filter(lessonPath => completedLessons.includes(lessonPath)).length;
  return Math.round((completed / moduleLessons.length) * 100);
}
