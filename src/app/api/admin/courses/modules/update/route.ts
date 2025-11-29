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
  moduleId: z.string().min(1),
  title: z.string().min(1).optional(),
  index: z.number().int().min(0).optional(),
});

export async function PUT(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
    }
    const { courseId, moduleId, title, index } = parsed.data;

    if (!adminDb) {
      return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
    }

    const moduleRef = adminDb
      .collection('courses').doc(courseId)
      .collection('modules').doc(moduleId);
    
    const moduleDoc = await moduleRef.get();
    if (!moduleDoc.exists) {
      return NextResponse.json({ error: 'Module not found' }, { status: 404 });
    }

    const updates: Record<string, any> = {
      updatedAt: FieldValue.serverTimestamp(),
    };
    
    if (title !== undefined) updates.title = title;
    if (index !== undefined) updates.index = index;

    await moduleRef.update(updates);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to update module' }, { status: 500 });
  }
}

export const runtime = 'nodejs';

