import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';

async function linkVideo() {
  try {
    // Validate Firebase Admin is initialized
    if (!adminDb) {
      return NextResponse.json(
        { 
          error: 'Firebase Admin not initialized',
          details: 'Check that FIREBASE_ADMIN_PROJECT_ID, FIREBASE_ADMIN_CLIENT_EMAIL, and FIREBASE_ADMIN_PRIVATE_KEY are set in .env.local'
        },
        { status: 500 }
      );
    }

    const db = adminDb;
    const courseId = 'technical-101';
    const moduleId = 'module-1';
    const lessonId = 'lesson-1';
    
    const muxAssetId = '02Vp3dV4QiLM22Ge2n004DfOFkxWJp6kpBhBtddLILwKw';
    const muxPlaybackId = 'Mv2sHA2ZvbpkEUn3W9PtO2XEP2kSG6zpOD1c02a8liqE';
    const lessonTitle = 'How To Shorten Background Music (Remix Tool)';

    // Check/create course
    const courseRef = db.collection('courses').doc(courseId);
    const courseDoc = await courseRef.get();
    
    if (!courseDoc.exists) {
      await courseRef.set({
        title: 'Technical 101',
        slug: courseId,
        summary: 'Technical course for testing',
        price: 0,
        isSubscription: false,
        featured: false,
        categories: [],
        modulesCount: 0,
        lessonsCount: 0,
        createdBy: 'admin',
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        published: false,
      });
    }

    // Check/create module
    const moduleRef = courseRef.collection('modules').doc(moduleId);
    const moduleDoc = await moduleRef.get();
    
    if (!moduleDoc.exists) {
      await moduleRef.set({
        title: 'Module 1: Introduction',
        index: 1,
      });
      
      const courseData = courseDoc.data();
      await courseRef.update({
        modulesCount: (courseData?.modulesCount || 0) + 1,
        updatedAt: FieldValue.serverTimestamp(),
      });
    }

    // Check/create lesson
    const lessonRef = moduleRef.collection('lessons').doc(lessonId);
    const lessonDoc = await lessonRef.get();
    
    const lessonData = {
      title: lessonTitle,
      index: 1,
      muxAssetId,
      muxPlaybackId,
      durationSec: 138, // 2:18 in seconds
      freePreview: false,
      resources: [],
      transcriptPath: null,
      updatedAt: FieldValue.serverTimestamp(),
    };

    if (!lessonDoc.exists) {
      await lessonRef.set({
        ...lessonData,
        createdAt: FieldValue.serverTimestamp(),
      });
      
      const courseData = courseDoc.data();
      await courseRef.update({
        lessonsCount: (courseData?.lessonsCount || 0) + 1,
        updatedAt: FieldValue.serverTimestamp(),
      });
    } else {
      await lessonRef.update(lessonData);
    }

    return NextResponse.json({
      success: true,
      message: 'Video linked successfully',
      path: `courses/${courseId}/modules/${moduleId}/lessons/${lessonId}`,
      courseId,
      moduleId,
      lessonId,
      muxAssetId,
      muxPlaybackId,
    });
  } catch (error: any) {
    console.error('Error linking video:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to link video' },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  return linkVideo();
}

export async function POST(req: NextRequest) {
  return linkVideo();
}

export const dynamic = 'force-dynamic';

