import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import { mux } from '@/lib/mux';
import { FieldValue } from 'firebase-admin/firestore';
import { z } from 'zod';

const schema = z.object({
  courseId: z.string().min(1),
  moduleId: z.string().min(1),
  lessonId: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
    }
    const { courseId, moduleId, lessonId, title, description } = parsed.data;

    if (!adminDb) {
      return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
    }

    // Verify course, module, and lesson exist
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

    const lessonRef = moduleRef.collection('lessons').doc(lessonId);
    const lessonDoc = await lessonRef.get();
    if (!lessonDoc.exists) {
      return NextResponse.json({ error: 'Lesson not found' }, { status: 404 });
    }

    // Create MUX direct upload
    const isDev = process.env.NODE_ENV !== 'production';
    const allowedOrigins = (process.env.CORS_ALLOWED_ORIGINS || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const corsOrigin = isDev
      ? '*'
      : (allowedOrigins[0] ||
        process.env.NEXT_PUBLIC_SITE_URL ||
        process.env.SITE_URL ||
        'https://coursecreatoracademy.vercel.app');

    const upload = await mux.video.uploads.create({
      cors_origin: corsOrigin,
      new_asset_settings: {
        playback_policy: ['public'], // Course videos use public playback for public viewing
        passthrough: JSON.stringify({
          courseId,
          moduleId,
          lessonId,
          title,
          description: description || '',
        }),
      },
    });

    // Update lesson document with upload info (will be updated by webhook when ready)
    await lessonRef.set({
      title,
      description: description || '',
      muxUploadId: upload.id,
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    // Return direct MUX URL - UpChunk can upload directly to MUX when cors_origin is set correctly
    // Using proxy causes 413 errors because Vercel has a 4.5MB body size limit for serverless functions
    // MUX direct uploads support CORS when cors_origin is configured, so we can bypass the proxy
    return NextResponse.json({ 
      uploadId: upload.id, 
      uploadUrl: upload.url // Direct MUX URL - avoids Vercel 413 errors on large uploads
    });
  } catch (err: any) {
    console.error('Error creating upload:', err);
    return NextResponse.json({ error: err.message || 'Failed to create upload' }, { status: 500 });
  }
}

export const runtime = 'nodejs';

