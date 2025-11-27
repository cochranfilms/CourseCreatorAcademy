import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';
import { z } from 'zod';

const schema = z.object({
  title: z.string().min(1),
  slug: z.string().min(1),
});

export async function POST(req: NextRequest) {
  try {
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
    }
    const { title, slug } = parsed.data;

    if (!adminDb) {
      return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
    }

    const courseRef = adminDb.collection('courses').doc();
    await courseRef.set({
      title,
      slug,
      summary: '',
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

    return NextResponse.json({ courseId: courseRef.id });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to create course' }, { status: 500 });
  }
}

export const runtime = 'nodejs';

