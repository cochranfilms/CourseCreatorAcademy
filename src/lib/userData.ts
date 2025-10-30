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
  await setDoc(ref, {
    type,
    targetId,
    createdAt: serverTimestamp(),
    ...data,
  }, { merge: true });
  return true;
}

export async function isSaved(userId: string, type: SavedType, targetId: string) {
  if (!db) return false;
  const ref = doc(db, `users/${userId}/saved/${type}_${targetId}`);
  const snap = await getDoc(ref);
  return snap.exists() && !snap.data()?.removedAt;
}

// Progress tracking: users/{uid}/progress/courses/{courseId}
export async function markLessonWatched(userId: string, courseId: string, lessonPath: string) {
  if (!db) return;
  const ref = doc(db, `users/${userId}/progress/courses/${courseId}`);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, {
      completedLessons: [lessonPath],
      lastLessonPath: lessonPath,
      updatedAt: serverTimestamp(),
    });
    return;
  }
  await updateDoc(ref, {
    completedLessons: arrayUnion(lessonPath),
    lastLessonPath: lessonPath,
    updatedAt: serverTimestamp(),
  });
}

export async function unmarkLessonWatched(userId: string, courseId: string, lessonPath: string) {
  if (!db) return;
  const ref = doc(db, `users/${userId}/progress/courses/${courseId}`);
  await updateDoc(ref, {
    completedLessons: arrayRemove(lessonPath),
    updatedAt: serverTimestamp(),
  });
}

export async function isLessonWatched(userId: string, courseId: string, lessonPath: string) {
  if (!db) return false;
  const ref = doc(db, `users/${userId}/progress/courses/${courseId}`);
  const snap = await getDoc(ref);
  if (!snap.exists()) return false;
  const arr = (snap.data()?.completedLessons || []) as string[];
  return arr.includes(lessonPath);
}

// Get completed lessons for a course
export async function getCompletedLessons(userId: string, courseId: string): Promise<string[]> {
  if (!db) return [];
  const ref = doc(db, `users/${userId}/progress/courses/${courseId}`);
  const snap = await getDoc(ref);
  if (!snap.exists()) return [];
  return (snap.data()?.completedLessons || []) as string[];
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
