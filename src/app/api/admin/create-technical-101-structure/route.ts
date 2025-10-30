import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';

/**
 * Create Technical 101 course structure with 5 modules and 30 lessons
 * This is a one-time setup script
 */
async function createTechnical101Structure() {
  try {
    if (!adminDb) {
      return NextResponse.json(
        { error: 'Firebase Admin not initialized' },
        { status: 500 }
      );
    }

    const db = adminDb;
    const courseId = 'technical-101';

    // Course structure
    const modules = [
      {
        id: 'module-1',
        title: 'Module 1: Introduction & Fundamentals',
        lessons: [
          { id: 'lesson-1', title: 'How To Shorten Background Music (Remix Tool)', hasVideo: true },
          { id: 'lesson-2', title: 'Welcome to Technical 101' },
          { id: 'lesson-3', title: 'Understanding Your Workflow' },
          { id: 'lesson-4', title: 'Essential Tools & Software' },
          { id: 'lesson-5', title: 'Setting Up Your Workspace' },
          { id: 'lesson-6', title: 'Course Overview & Expectations' },
        ]
      },
      {
        id: 'module-2',
        title: 'Module 2: Audio Fundamentals',
        lessons: [
          { id: 'lesson-1', title: 'Understanding Audio Levels' },
          { id: 'lesson-2', title: 'Audio Mixing Basics' },
          { id: 'lesson-3', title: 'EQ and Frequency Management' },
          { id: 'lesson-4', title: 'Compression Techniques' },
          { id: 'lesson-5', title: 'Working with Background Music' },
          { id: 'lesson-6', title: 'Sound Design Essentials' },
        ]
      },
      {
        id: 'module-3',
        title: 'Module 3: Video Editing Techniques',
        lessons: [
          { id: 'lesson-1', title: 'Basic Editing Principles' },
          { id: 'lesson-2', title: 'Cutting Techniques' },
          { id: 'lesson-3', title: 'Transitions & Effects' },
          { id: 'lesson-4', title: 'Color Correction Basics' },
          { id: 'lesson-5', title: 'Working with Multiple Tracks' },
          { id: 'lesson-6', title: 'Timeline Organization' },
        ]
      },
      {
        id: 'module-4',
        title: 'Module 4: Advanced Techniques',
        lessons: [
          { id: 'lesson-1', title: 'Advanced Color Grading' },
          { id: 'lesson-2', title: 'Motion Graphics Basics' },
          { id: 'lesson-3', title: 'Advanced Audio Mixing' },
          { id: 'lesson-4', title: 'Visual Effects Integration' },
          { id: 'lesson-5', title: 'Multi-Camera Editing' },
          { id: 'lesson-6', title: 'Advanced Workflow Tips' },
        ]
      },
      {
        id: 'module-5',
        title: 'Module 5: Finalizing & Export',
        lessons: [
          { id: 'lesson-1', title: 'Export Settings Explained' },
          { id: 'lesson-2', title: 'Quality vs File Size' },
          { id: 'lesson-3', title: 'Codec Selection' },
          { id: 'lesson-4', title: 'Optimizing for Different Platforms' },
          { id: 'lesson-5', title: 'Final Review Process' },
          { id: 'lesson-6', title: 'Course Wrap-Up & Next Steps' },
        ]
      },
    ];

    // Get or create course
    const courseRef = db.collection('courses').doc(courseId);
    const courseDoc = await courseRef.get();
    
    if (!courseDoc.exists) {
      await courseRef.set({
        title: 'Technical 101',
        slug: courseId,
        summary: 'Master the technical fundamentals of video production, audio editing, and post-production workflows.',
        price: 0,
        isSubscription: false,
        featured: true,
        categories: ['editing', 'audio', 'technical'],
        modulesCount: modules.length,
        lessonsCount: modules.reduce((sum, mod) => sum + mod.lessons.length, 0),
        createdBy: 'admin',
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        published: true,
      });
    } else {
      // Update course with correct counts
      await courseRef.update({
        modulesCount: modules.length,
        lessonsCount: modules.reduce((sum, mod) => sum + mod.lessons.length, 0),
        updatedAt: FieldValue.serverTimestamp(),
        published: true,
      });
    }

    // Create modules and lessons
    const createdModules = [];
    const createdLessons = [];

    for (let moduleIndex = 0; moduleIndex < modules.length; moduleIndex++) {
      const module = modules[moduleIndex];
      const moduleRef = courseRef.collection('modules').doc(module.id);
      const moduleDoc = await moduleRef.get();

      if (!moduleDoc.exists) {
        await moduleRef.set({
          title: module.title,
          index: moduleIndex + 1,
        });
        createdModules.push(module.id);
      }

      // Create lessons for this module
      for (let lessonIndex = 0; lessonIndex < module.lessons.length; lessonIndex++) {
        const lesson = module.lessons[lessonIndex];
        const lessonRef = moduleRef.collection('lessons').doc(lesson.id);
        const lessonDoc = await lessonRef.get();

        const lessonData: any = {
          title: lesson.title,
          index: lessonIndex + 1,
          durationSec: 0,
          freePreview: moduleIndex === 0 && lessonIndex === 0, // First lesson is free preview
          resources: [],
          transcriptPath: null,
          updatedAt: FieldValue.serverTimestamp(),
        };

        // If this is lesson-1 in module-1, it already has a video, so keep it
        if (module.id === 'module-1' && lesson.id === 'lesson-1') {
          const existingLesson = lessonDoc.data();
          if (existingLesson?.muxAssetId) {
            lessonData.muxAssetId = existingLesson.muxAssetId;
            lessonData.muxPlaybackId = existingLesson.muxPlaybackId;
            lessonData.durationSec = existingLesson.durationSec || 138;
          }
        }

        if (!lessonDoc.exists) {
          lessonData.createdAt = FieldValue.serverTimestamp();
          await lessonRef.set(lessonData);
          createdLessons.push(`${module.id}/${lesson.id}`);
        } else {
          // Update existing lesson but preserve video data
          const existingData = lessonDoc.data();
          if (existingData?.muxAssetId) {
            lessonData.muxAssetId = existingData.muxAssetId;
            lessonData.muxPlaybackId = existingData.muxPlaybackId;
            lessonData.durationSec = existingData.durationSec || lessonData.durationSec;
          }
          await lessonRef.update(lessonData);
        }
      }
    }

    const totalLessons = modules.reduce((sum, mod) => sum + mod.lessons.length, 0);

    return NextResponse.json({
      success: true,
      message: 'Technical 101 course structure created successfully',
      course: {
        id: courseId,
        modules: modules.length,
        lessons: totalLessons,
      },
      created: {
        modules: createdModules.length > 0 ? createdModules : 'All modules already existed',
        lessons: createdLessons.length > 0 ? createdLessons.length : 'All lessons already existed',
      },
      structure: modules.map(mod => ({
        module: mod.title,
        lessons: mod.lessons.length,
        lessonTitles: mod.lessons.map(l => l.title),
      })),
    });
  } catch (error: any) {
    console.error('Error creating course structure:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create course structure' },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  return createTechnical101Structure();
}

export async function POST(req: NextRequest) {
  return createTechnical101Structure();
}

export const dynamic = 'force-dynamic';

