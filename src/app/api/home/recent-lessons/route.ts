import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import * as FirebaseFirestore from 'firebase-admin/firestore';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: NextRequest) {
  try {
    if (!adminDb) {
      return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
    }

    const allLessons: Array<{
      id: string;
      title: string;
      thumbnail: string;
      duration: string;
      courseSlug: string;
      courseId: string;
      moduleId: string;
      lessonId: string;
      muxPlaybackId?: string;
      muxAnimatedGifUrl?: string;
    }> = [];

    // Fetch all courses
    const coursesSnap = await adminDb.collection('courses').get();

    // Process all courses in parallel
    const coursePromises = coursesSnap.docs.map(async (courseDoc: FirebaseFirestore.QueryDocumentSnapshot) => {
      const courseData = courseDoc.data();
      const courseId = courseDoc.id;
      const courseSlug = courseData.slug || courseId;

      try {
        // Fetch all modules for this course
        const modulesSnap = await adminDb
          .collection(`courses/${courseId}/modules`)
          .orderBy('index', 'asc')
          .get();

        // Process all modules in parallel
        const modulePromises = modulesSnap.docs.map(async (moduleDoc: FirebaseFirestore.QueryDocumentSnapshot) => {
          const moduleId = moduleDoc.id;
          
          // Fetch all lessons for this module
          const lessonsSnap = await adminDb
            .collection(`courses/${courseId}/modules/${moduleId}/lessons`)
            .orderBy('index', 'asc')
            .get();

          lessonsSnap.forEach((lessonDoc: FirebaseFirestore.QueryDocumentSnapshot) => {
            const lessonData = lessonDoc.data();
            const durationSec = lessonData.durationSec || 0;
            const minutes = Math.floor(durationSec / 60);
            const seconds = durationSec % 60;
            const duration = `${minutes}:${seconds.toString().padStart(2, '0')}`;

            let thumbnail = '';
            if (lessonData.muxAnimatedGifUrl) {
              thumbnail = lessonData.muxAnimatedGifUrl;
            } else if (lessonData.muxPlaybackId) {
              thumbnail = `https://image.mux.com/${lessonData.muxPlaybackId}/thumbnail.jpg?width=640&fit_mode=preserve`;
            }

            allLessons.push({
              id: lessonDoc.id,
              title: lessonData.title || 'Untitled Lesson',
              thumbnail,
              duration,
              courseSlug,
              courseId,
              moduleId,
              lessonId: lessonDoc.id,
              muxPlaybackId: lessonData.muxPlaybackId,
              muxAnimatedGifUrl: lessonData.muxAnimatedGifUrl,
            });
          });
        });

        await Promise.all(modulePromises);
      } catch (error) {
        console.error(`Error fetching lessons for course ${courseId}:`, error);
      }
    });

    await Promise.all(coursePromises);

    // Sort by most recent (we'll use course/module/lesson structure as proxy)
    // Return only the 6 most recent
    return NextResponse.json({ lessons: allLessons.slice(0, 6) });
  } catch (error: any) {
    console.error('Error fetching recent lessons:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch lessons' }, { status: 500 });
  }
}

