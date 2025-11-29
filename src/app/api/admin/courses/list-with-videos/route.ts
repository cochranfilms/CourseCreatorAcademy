import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';

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

export async function GET(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    if (!adminDb) {
      return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
    }

    const coursesSnapshot = await adminDb.collection('courses')
      .orderBy('title', 'asc')
      .get();

    const courses = await Promise.all(
      coursesSnapshot.docs.map(async (courseDoc) => {
        const courseData = courseDoc.data();
        const modulesSnapshot = await courseDoc.ref
          .collection('modules')
          .orderBy('index', 'asc')
          .get();

        const modules = await Promise.all(
          modulesSnapshot.docs.map(async (moduleDoc) => {
            const moduleData = moduleDoc.data();
            const lessonsSnapshot = await moduleDoc.ref
              .collection('lessons')
              .orderBy('index', 'asc')
              .get();

            const lessons = lessonsSnapshot.docs.map((lessonDoc) => {
              const lessonData = lessonDoc.data();
              return {
                id: lessonDoc.id,
                title: lessonData.title || 'Untitled Lesson',
                description: lessonData.description || '',
                index: lessonData.index || 0,
                freePreview: lessonData.freePreview || false,
                durationSec: lessonData.durationSec || 0,
                muxAssetId: lessonData.muxAssetId || null,
                muxPlaybackId: lessonData.muxPlaybackId || null,
                muxAnimatedGifUrl: lessonData.muxAnimatedGifUrl || null,
                hasVideo: !!(lessonData.muxAssetId && lessonData.muxPlaybackId),
              };
            });

            return {
              id: moduleDoc.id,
              title: moduleData.title || 'Untitled Module',
              index: moduleData.index || 0,
              lessons,
            };
          })
        );

        return {
          id: courseDoc.id,
          title: courseData.title || 'Untitled Course',
          slug: courseData.slug || courseDoc.id,
          modules,
        };
      })
    );

    return NextResponse.json({ courses });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to list courses' }, { status: 500 });
  }
}

export const runtime = 'nodejs';

