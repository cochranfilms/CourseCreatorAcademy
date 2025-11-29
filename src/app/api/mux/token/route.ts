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

    // Try to locate a course lesson by playbackId
    const playbackIdStr = String(playbackId).trim();
    logInfo('mux.token.searching', { playbackId: playbackIdStr });
    let lessonSnap = await adminDb.collectionGroup('lessons')
      .where('muxPlaybackId', '==', playbackIdStr)
      .limit(1)
      .get()
      .catch((err: any) => {
        logWarn('mux.token.collectionGroup_error', { playbackId: playbackIdStr, error: err.message });
        return null as any;
      });
    
    if (lessonSnap && !lessonSnap.empty) {
      logInfo('mux.token.found_by_playbackId', { playbackId: playbackIdStr, lessonPath: lessonSnap.docs[0].ref.path });
    } else {
      logWarn('mux.token.not_found_by_playbackId', { playbackId: playbackIdStr });
    }
    
    // Fallback 1: Try to find by assetId if we can get it from MUX
    if ((!lessonSnap || lessonSnap.empty) && adminDb) {
      try {
        const { mux } = await import('@/lib/mux');
        // Try to get asset from MUX to find assetId
        // Then search for lessons with that assetId
        try {
          // List recent assets from MUX to find the one with this playbackId
          // Note: MUX doesn't have a direct "get asset by playback ID" endpoint
          // So we'll search through lessons with muxAssetId instead
          logInfo('mux.token.fallback_search_by_asset', { playbackId: playbackIdStr });
          
          // Search for lessons with muxUploadId (recent uploads)
          const lessonsWithUpload = await adminDb.collectionGroup('lessons')
            .where('muxUploadId', '!=', null)
            .limit(100) // Increased limit for better coverage
            .get()
            .catch(() => null as any);
          
          if (lessonsWithUpload && !lessonsWithUpload.empty) {
            logInfo('mux.token.checking_uploads', { count: lessonsWithUpload.docs.length });
            // Check each lesson's upload to see if the asset matches this playbackId
            for (const lessonDoc of lessonsWithUpload.docs) {
              const data = lessonDoc.data() as any;
              const uploadId = data.muxUploadId;
              const existingPlaybackId = data.muxPlaybackId;
              
              // Skip if already has a different playbackId
              if (existingPlaybackId && existingPlaybackId !== playbackIdStr) continue;
              
              if (!uploadId) continue;
              
              try {
                // Get upload from MUX to find assetId
                const upload = await mux.video.uploads.retrieve(uploadId).catch(() => null);
                if (upload?.asset_id) {
                  // Get asset to check playbackId
                  const asset = await mux.video.assets.retrieve(upload.asset_id).catch(() => null);
                  if (asset?.playback_ids?.[0]?.id === playbackIdStr) {
                    // Found it! Update lesson with playbackId
                    await lessonDoc.ref.set({
                      muxAssetId: asset.id,
                      muxPlaybackId: playbackIdStr,
                      updatedAt: adminDb.FieldValue.serverTimestamp(),
                    }, { merge: true }).catch(() => {});
                    lessonSnap = { docs: [lessonDoc], empty: false };
                    logInfo('mux.token.playbackId_updated_via_fallback', { uploadId, assetId: asset.id, playbackId: playbackIdStr });
                    break;
                  }
                }
              } catch (err: any) {
                // Continue checking other lessons
                logWarn('mux.token.upload_check_error', { uploadId, error: err.message });
                continue;
              }
            }
          }
        } catch (err: any) {
          logWarn('mux.token.fallback_error', { error: err.message });
        }
      } catch (err: any) {
        // Ignore errors in fallback lookup
        logWarn('mux.token.fallback_lookup_error', { error: err.message });
      }
    }
    
    if (lessonSnap && !lessonSnap.empty) {
      const d = lessonSnap.docs[0];
      const courseId = getAncestorIdFromPath(d.ref.path, 'courses');
      if (!courseId) {
        logWarn('mux.token.invalid_path', { playbackId, path: d.ref.path });
        return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
      }
      // Require enrollment
      const uid = await getUserFromAuthHeader(req);
      if (!uid) {
        logWarn('mux.token.unauthorized', { playbackId, courseId });
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      const enr = await adminDb
        .collection('enrollments')
        .where('userId', '==', String(uid))
        .where('courseId', '==', String(courseId))
        .where('active', '==', true)
        .limit(1)
        .get()
        .catch(() => null as any);
      if (!enr || enr.empty) {
        logWarn('mux.token.not_enrolled', { playbackId, courseId, uid });
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      const token = generateMuxPlaybackToken(playbackId, { audience: 'v', expiresInSeconds: 15 * 60 });
      logInfo('mux.token.issued', { type: 'lesson', courseId });
      recordAudit('mux_token_issued', { playbackId, scope: 'course', courseId }).catch(()=>{});
      return NextResponse.json({ token });
    }

    logWarn('mux.token.not_found', { playbackId });
    return NextResponse.json({ error: 'Not found', message: 'Playback ID not found in any lesson. The video may still be processing.' }, { status: 404 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to mint token' }, { status: 500 });
  }
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';


