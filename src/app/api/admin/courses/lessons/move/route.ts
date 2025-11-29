import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';
import { z } from 'zod';

/**
 * Verify user is authorized (info@cochranfilms.com)
 */
async function verifyAuth(req: NextRequest): Promise<{ uid: string; email: string } | null> {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7);
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    if (decoded.email !== 'info@cochranfilms.com') {
      return null;
    }
    return { uid: decoded.uid, email: decoded.email };
  } catch {
    return null;
  }
}

const schema = z.object({
  courseId: z.string().min(1),
  sourceModuleId: z.string().min(1),
  targetModuleId: z.string().min(1),
  lessonId: z.string().min(1),
  newIndex: z.number().int().min(0).optional(),
});

export async function POST(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
    }
    const { courseId, sourceModuleId, targetModuleId, lessonId, newIndex } = parsed.data;

    if (!adminDb) {
      return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
    }

    // Verify both modules exist
    const courseRef = adminDb.collection('courses').doc(courseId);
    const sourceModuleRef = courseRef.collection('modules').doc(sourceModuleId);
    const targetModuleRef = courseRef.collection('modules').doc(targetModuleId);

    const [sourceModuleDoc, targetModuleDoc] = await Promise.all([
      sourceModuleRef.get(),
      targetModuleRef.get(),
    ]);

    if (!sourceModuleDoc.exists) {
      return NextResponse.json({ error: 'Source module not found' }, { status: 404 });
    }
    if (!targetModuleDoc.exists) {
      return NextResponse.json({ error: 'Target module not found' }, { status: 404 });
    }

    // Get the lesson document
    const sourceLessonRef = sourceModuleRef.collection('lessons').doc(lessonId);
    const lessonDoc = await sourceLessonRef.get();
    
    if (!lessonDoc.exists) {
      return NextResponse.json({ error: 'Lesson not found' }, { status: 404 });
    }

    const lessonData = lessonDoc.data();

    // If moving to the same module, just update index if provided
    if (sourceModuleId === targetModuleId) {
      if (newIndex !== undefined) {
        await sourceLessonRef.update({
          index: newIndex,
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
      return NextResponse.json({ success: true });
    }

    // Get lessons in target module to determine new index if not provided
    const targetLessonsSnapshot = await targetModuleRef.collection('lessons')
      .orderBy('index', 'asc')
      .get();
    
    const targetLessons = targetLessonsSnapshot.docs.map(doc => doc.data().index || 0);
    const maxIndex = targetLessons.length > 0 ? Math.max(...targetLessons) : -1;
    const finalIndex = newIndex !== undefined ? newIndex : maxIndex + 1;

    // Create lesson in target module
    const targetLessonRef = targetModuleRef.collection('lessons').doc(lessonId);
    await targetLessonRef.set({
      ...lessonData,
      index: finalIndex,
      updatedAt: FieldValue.serverTimestamp(),
    });

    // Delete lesson from source module
    await sourceLessonRef.delete();

    // Update course lesson counts if needed (optional, as counts might be managed elsewhere)
    // For now, we'll leave counts as-is since they might be managed by other processes

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to move lesson' }, { status: 500 });
  }
}

export const runtime = 'nodejs';

