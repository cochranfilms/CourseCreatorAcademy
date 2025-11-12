import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebaseAdmin';
import { generateMuxPlaybackToken } from '@/lib/muxSigning';
import { z } from 'zod';
import { logInfo, logWarn } from '@/lib/log';
import { recordAudit } from '@/lib/audit';
import { hasAccessToCreator } from '@/lib/entitlements';

async function getUserFromAuthHeader(req: NextRequest): Promise<string | null> {
  const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
  if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) return null;
  const idToken = authHeader.split(' ')[1];
  if (!adminAuth) return null;
  try {
    const decoded = await adminAuth.verifyIdToken(idToken);
    return decoded.uid || null;
  } catch {
    return null;
  }
}

function getAncestorIdFromPath(path: string, collectionId: string): string | null {
  // Example paths:
  // legacy_creators/{creatorId}/videos/{videoId}
  // courses/{courseId}/modules/{moduleId}/lessons/{lessonId}
  const parts = path.split('/');
  for (let i = 0; i < parts.length; i++) {
    if (parts[i] === collectionId && i + 1 < parts.length) {
      return parts[i + 1] || null;
    }
  }
  return null;
}

export async function GET(req: NextRequest) {
  try {
    if (!adminDb) {
      return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
    }
    const { searchParams } = new URL(req.url);
    const playbackId = String(searchParams.get('playbackId') || '');
    const qsSchema = z.object({ playbackId: z.string().min(1) });
    const qsParsed = qsSchema.safeParse({ playbackId });
    if (!qsParsed.success) return NextResponse.json({ error: 'Missing playbackId' }, { status: 400 });

    // Try to locate a legacy creator video first
    const legacySnap = await adminDb.collectionGroup('videos')
      .where('muxPlaybackId', '==', String(playbackId))
      .limit(1)
      .get()
      .catch(() => null as any);

    if (legacySnap && !legacySnap.empty) {
      const d = legacySnap.docs[0];
      const data = d.data() as any;
      const isSample = Boolean(data?.isSample);
      const creatorId = getAncestorIdFromPath(d.ref.path, 'legacy_creators');
      if (!creatorId) return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
      if (!isSample) {
        // Require auth + entitlement (global CCA membership OR creator Legacy+ sub)
        const uid = await getUserFromAuthHeader(req);
        if (!uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const allowed = await hasAccessToCreator(uid, String(creatorId));
        if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      const token = generateMuxPlaybackToken(playbackId, { audience: 'v', expiresInSeconds: 15 * 60 });
      logInfo('mux.token.issued', { type: 'legacy', creatorId, isSample });
      recordAudit('mux_token_issued', { playbackId, scope: 'legacy', creatorId, isSample }).catch(()=>{});
      return NextResponse.json({ token });
    }

    // Try to locate a course lesson
    const lessonSnap = await adminDb.collectionGroup('lessons')
      .where('muxPlaybackId', '==', String(playbackId))
      .limit(1)
      .get()
      .catch(() => null as any);
    if (lessonSnap && !lessonSnap.empty) {
      const d = lessonSnap.docs[0];
      const courseId = getAncestorIdFromPath(d.ref.path, 'courses');
      if (!courseId) return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
      // Require enrollment
      const uid = await getUserFromAuthHeader(req);
      if (!uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      const enr = await adminDb
        .collection('enrollments')
        .where('userId', '==', String(uid))
        .where('courseId', '==', String(courseId))
        .where('active', '==', true)
        .limit(1)
        .get()
        .catch(() => null as any);
      if (!enr || enr.empty) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      const token = generateMuxPlaybackToken(playbackId, { audience: 'v', expiresInSeconds: 15 * 60 });
      logInfo('mux.token.issued', { type: 'lesson', courseId });
      recordAudit('mux_token_issued', { playbackId, scope: 'course', courseId }).catch(()=>{});
      return NextResponse.json({ token });
    }

    logWarn('mux.token.not_found', { playbackId });
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to mint token' }, { status: 500 });
  }
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';


