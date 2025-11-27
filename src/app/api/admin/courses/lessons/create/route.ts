import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';
import { z } from 'zod';

const schema = z.object({
  courseId: z.string().min(1),
  moduleId: z.string().min(1),
  title: z.string().min(1),
  index: z.number().int().min(0),
  description: z.string().optional(),
  freePreview: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
    }
    const { courseId, moduleId, title, index, description, freePreview } = parsed.data;

    if (!adminDb) {
      return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
    }

    const courseRef = adminDb.collection('courses').doc(courseId);
    const courseDoc = await courseRef.get();
    if (!courseDoc.exists) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 });
    }

    const moduleRef = courseRef.collection('modules').doc(moduleId);
    const moduleDoc = await moduleRef.get();
    if (!moduleDoc.exists) {
      return NextResponse.json({ error: 'Module not found' }, { status: 404 });
    }

    const lessonRef = moduleRef.collection('lessons').doc();
    await lessonRef.set({
      title,
      index,
      description: description || '',
      freePreview: freePreview || false,
      durationSec: 0,
      resources: [],
      transcriptPath: null,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    // Update course lessonsCount
    const courseData = courseDoc.data();
    await courseRef.update({
      lessonsCount: (courseData?.lessonsCount || 0) + 1,
      updatedAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ lessonId: lessonRef.id });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to create lesson' }, { status: 500 });
  }
}

export const runtime = 'nodejs';

