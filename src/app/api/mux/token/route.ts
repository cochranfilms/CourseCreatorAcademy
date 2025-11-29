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
    const assetId = String(searchParams.get('assetId') || ''); // Optional: allow searching by assetId too
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
    const assetIdStr = assetId ? String(assetId).trim() : null;
    logInfo('mux.token.searching', { playbackId: playbackIdStr, assetId: assetIdStr });
    
    let lessonSnap: any = null;
    
    // First, try searching by playbackId
    lessonSnap = await adminDb.collectionGroup('lessons')
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
      
      // If assetId provided, try searching by assetId and verify playbackId matches
      if (assetIdStr) {
        logInfo('mux.token.trying_assetId', { assetId: assetIdStr });
        const assetSnap = await adminDb.collectionGroup('lessons')
          .where('muxAssetId', '==', assetIdStr)
          .limit(1)
          .get()
          .catch((err: any) => {
            logWarn('mux.token.assetId_search_error', { assetId: assetIdStr, error: err.message });
            return null as any;
          });
        
        if (assetSnap && !assetSnap.empty) {
          const lessonData = assetSnap.docs[0].data() as any;
          // If found by assetId, use it regardless of playbackId match (playbackId might be different)
          // Update with the requested playbackId to ensure sync
          await assetSnap.docs[0].ref.set({
            muxPlaybackId: playbackIdStr,
            updatedAt: adminDb.FieldValue.serverTimestamp(),
          }, { merge: true }).catch((err: any) => {
            logWarn('mux.token.update_playbackId_error', { error: err.message });
          });
          lessonSnap = assetSnap;
          logInfo('mux.token.found_by_assetId', { assetId: assetIdStr, playbackId: playbackIdStr, lessonPath: assetSnap.docs[0].ref.path });
        }
      }
    }
    
    // Fallback 1: Try to find by assetId from MUX API
    if ((!lessonSnap || lessonSnap.empty) && adminDb) {
      try {
        const { mux } = await import('@/lib/mux');
        logInfo('mux.token.fallback_search_by_mux', { playbackId: playbackIdStr });
        
        // Try to find asset by playbackId via MUX API
        // Since MUX doesn't have direct lookup, we'll search through lessons with muxAssetId
        // First, try to find lessons with muxUploadId and check their assets
        const lessonsWithUpload = await adminDb.collectionGroup('lessons')
          .where('muxUploadId', '!=', null)
          .limit(100)
          .get()
          .catch(() => null as any);
        
        if (lessonsWithUpload && !lessonsWithUpload.empty) {
          logInfo('mux.token.checking_uploads', { count: lessonsWithUpload.docs.length });
          for (const lessonDoc of lessonsWithUpload.docs) {
            const data = lessonDoc.data() as any;
            const uploadId = data.muxUploadId;
            const existingPlaybackId = data.muxPlaybackId;
            
            // Skip if already has a different playbackId
            if (existingPlaybackId && existingPlaybackId !== playbackIdStr) continue;
            
            if (!uploadId) continue;
            
            try {
              const upload = await mux.video.uploads.retrieve(uploadId).catch(() => null);
              if (upload?.asset_id) {
                const asset = await mux.video.assets.retrieve(upload.asset_id).catch(() => null);
                if (asset?.playback_ids?.[0]?.id === playbackIdStr) {
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
              logWarn('mux.token.upload_check_error', { uploadId, error: err.message });
              continue;
            }
          }
        }
        
        // Fallback 2: Search by muxAssetId if we can get assetId from MUX
        if ((!lessonSnap || lessonSnap.empty)) {
          try {
            // Try to get asset from MUX using the playbackId
            // We'll list recent assets and check their playback IDs
            // This is a last resort - it's expensive but might work
            logInfo('mux.token.fallback_search_by_asset_list', { playbackId: playbackIdStr });
            
            // Search for lessons with muxAssetId and check them via MUX API
            const lessonsWithAsset = await adminDb.collectionGroup('lessons')
              .where('muxAssetId', '!=', null)
              .limit(50) // Limit to avoid too many API calls
              .get()
              .catch(() => null as any);
            
            if (lessonsWithAsset && !lessonsWithAsset.empty) {
              logInfo('mux.token.checking_assets', { count: lessonsWithAsset.docs.length });
              for (const lessonDoc of lessonsWithAsset.docs) {
                const data = lessonDoc.data() as any;
                const assetId = data.muxAssetId;
                const existingPlaybackId = data.muxPlaybackId;
                
                // Skip if already has a different playbackId
                if (existingPlaybackId && existingPlaybackId !== playbackIdStr) continue;
                
                if (!assetId) continue;
                
                try {
                  const asset = await mux.video.assets.retrieve(assetId).catch(() => null);
                  if (asset) {
                    // Check all playback IDs (not just first one) - assets can have multiple playback IDs
                    const matchingPlaybackId = asset.playback_ids?.find((pid: any) => pid.id === playbackIdStr);
                    if (matchingPlaybackId) {
                      await lessonDoc.ref.set({
                        muxAssetId: asset.id,
                        muxPlaybackId: playbackIdStr,
                        muxAnimatedGifUrl: `https://image.mux.com/${playbackIdStr}/animated.gif?width=320`,
                        durationSec: asset.duration ? Math.round(Number(asset.duration)) : undefined,
                        updatedAt: adminDb.FieldValue.serverTimestamp(),
                      }, { merge: true }).catch(() => {});
                      lessonSnap = { docs: [lessonDoc], empty: false };
                      logInfo('mux.token.found_via_asset_fallback', { assetId, playbackId: playbackIdStr, lessonPath: lessonDoc.ref.path });
                      break;
                    }
                  }
                } catch (err: any) {
                  logWarn('mux.token.asset_check_error', { assetId, error: err.message });
                  continue;
                }
              }
            }
          } catch (err: any) {
            logWarn('mux.token.asset_fallback_error', { error: err.message });
          }
        }
      } catch (err: any) {
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


