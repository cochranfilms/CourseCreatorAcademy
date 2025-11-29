import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';
import { mux } from '@/lib/mux';
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
  lessonId: z.string().min(1),
  playbackId: z.string().min(1).optional(),
  assetId: z.string().min(1).optional(),
}).refine(data => data.playbackId || data.assetId, {
  message: 'Either playbackId or assetId must be provided',
});

export async function POST(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid body', details: parsed.error.errors }, { status: 400 });
    }
    const { courseId, moduleId, lessonId, playbackId, assetId } = parsed.data;

    if (!adminDb) {
      return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
    }

    // Verify lesson exists
    const lessonRef = adminDb
      .collection('courses').doc(courseId)
      .collection('modules').doc(moduleId)
      .collection('lessons').doc(lessonId);
    
    const lessonDoc = await lessonRef.get();
    if (!lessonDoc.exists) {
      return NextResponse.json({ error: 'Lesson not found' }, { status: 404 });
    }

    let finalPlaybackId = playbackId;
    let finalAssetId = assetId;
    let durationSec = 0;

    // If only assetId provided, fetch playbackId and duration from MUX
    if (assetId && !playbackId) {
      try {
        console.log(`[link-mux] Fetching asset ${assetId} from MUX`);
        const asset = await mux.video.assets.retrieve(assetId);
        console.log(`[link-mux] Asset retrieved:`, { id: asset.id, playbackIds: asset.playback_ids });
        finalAssetId = asset.id;
        finalPlaybackId = asset.playback_ids?.[0]?.id || undefined;
        durationSec = asset.duration ? Math.round(Number(asset.duration)) : 0;
        
        if (!finalPlaybackId) {
          return NextResponse.json({ 
            error: 'Asset found but has no playback ID. The asset may still be processing.' 
          }, { status: 400 });
        }
      } catch (err: any) {
        console.error(`[link-mux] Error fetching asset ${assetId}:`, err);
        const errorMessage = err?.message || err?.toString() || 'Unknown error';
        const statusCode = err?.status || err?.statusCode || err?.response?.status || 500;
        const muxErrorData = err?.response?.data || err?.body || err?.data || err?.error;
        
        // Check if MUX says the ID format is invalid
        const isInvalidFormat = muxErrorData?.error?.messages?.some((msg: string) => 
          msg.includes('Failed to parse ID') || msg.includes('invalid')
        ) || errorMessage.includes('Failed to parse ID');
        
        return NextResponse.json({ 
          error: isInvalidFormat 
            ? 'Invalid Asset ID format. The ID you provided might be a Playback ID instead, or the Asset ID may be incorrect. Please check the MUX dashboard and use the correct Asset ID from the asset details page.'
            : 'Failed to fetch asset from MUX', 
          details: errorMessage,
          muxError: muxErrorData,
          assetId: assetId,
          hint: isInvalidFormat 
            ? 'Asset IDs are found in the MUX dashboard under "Asset ID" (not "Playback ID"). If you have a Playback ID, use the "Playback ID" field instead. Make sure you\'re copying the full Asset ID from the MUX dashboard.'
            : undefined,
          stack: process.env.NODE_ENV === 'development' ? err?.stack : undefined,
        }, { status: statusCode >= 400 && statusCode < 600 ? statusCode : 400 });
      }
    } 
    // If only playbackId provided, fetch assetId and duration from MUX
    else if (playbackId && !assetId) {
      try {
        // MUX doesn't have a direct "get asset by playback ID" endpoint
        // We'll need to list assets and find the one with this playback ID
        // For now, we'll just use the playbackId and let the webhook fill in assetId later
        // Or we can search through recent uploads
        finalPlaybackId = playbackId;
        
        // Try to get asset from upload if muxUploadId exists
        const lessonData = lessonDoc.data();
        if (lessonData?.muxUploadId) {
          try {
            const upload = await mux.video.uploads.retrieve(lessonData.muxUploadId);
            if (upload.asset_id) {
              const asset = await mux.video.assets.retrieve(upload.asset_id);
              finalAssetId = asset.id;
              durationSec = asset.duration ? Math.round(Number(asset.duration)) : 0;
            }
          } catch (uploadErr: any) {
            console.warn(`[link-mux] Upload lookup failed:`, uploadErr.message);
            // Ignore upload lookup errors
          }
        }
      } catch (err: any) {
        console.error(`[link-mux] Error in playbackId-only path:`, err);
        return NextResponse.json({ 
          error: 'Failed to fetch asset details from MUX', 
          details: err.message || String(err),
          stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
        }, { status: 500 });
      }
    }
    // If both provided, verify they match and get duration
    else if (playbackId && assetId) {
      try {
        console.log(`[link-mux] Verifying asset ${assetId} matches playbackId ${playbackId}`);
        const asset = await mux.video.assets.retrieve(assetId);
        const assetPlaybackId = asset.playback_ids?.[0]?.id;
        
        if (assetPlaybackId !== playbackId) {
          return NextResponse.json({ 
            error: 'Playback ID does not match the provided asset ID',
            providedPlaybackId: playbackId,
            assetPlaybackId: assetPlaybackId,
          }, { status: 400 });
        }
        
        finalAssetId = asset.id;
        finalPlaybackId = playbackId;
        durationSec = asset.duration ? Math.round(Number(asset.duration)) : 0;
      } catch (err: any) {
        console.error(`[link-mux] Error verifying asset:`, err);
        const errorMessage = err.message || err.toString() || 'Unknown error';
        const statusCode = err.status || err.statusCode || 500;
        return NextResponse.json({ 
          error: 'Failed to verify asset from MUX', 
          details: errorMessage,
          muxError: err.response?.data || err.body || undefined,
          stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
        }, { status: statusCode >= 400 && statusCode < 600 ? statusCode : 500 });
      }
    }

    if (!finalPlaybackId) {
      return NextResponse.json({ error: 'Could not determine playback ID' }, { status: 400 });
    }

    // Generate animated GIF thumbnail URL
    const animatedGifUrl = finalPlaybackId 
      ? `https://image.mux.com/${finalPlaybackId}/animated.gif?width=320`
      : null;

    // Update lesson document
    try {
      const updates: Record<string, any> = {
        muxPlaybackId: finalPlaybackId,
        muxAnimatedGifUrl: animatedGifUrl,
        updatedAt: FieldValue.serverTimestamp(),
      };

      if (finalAssetId) {
        updates.muxAssetId = finalAssetId;
      }

      if (durationSec > 0) {
        updates.durationSec = durationSec;
      }

      console.log(`[link-mux] Updating lesson ${lessonId} with:`, updates);
      await lessonRef.set(updates, { merge: true });
      console.log(`[link-mux] Successfully updated lesson ${lessonId}`);

      return NextResponse.json({ 
        success: true,
        playbackId: finalPlaybackId,
        assetId: finalAssetId,
        durationSec,
      });
    } catch (firestoreErr: any) {
      console.error(`[link-mux] Error updating Firestore:`, firestoreErr);
      return NextResponse.json({ 
        error: 'Failed to update lesson document', 
        details: firestoreErr.message || String(firestoreErr),
        stack: process.env.NODE_ENV === 'development' ? firestoreErr.stack : undefined,
      }, { status: 500 });
    }
  } catch (err: any) {
    console.error('[link-mux] Unexpected error:', err);
    return NextResponse.json({ 
      error: err.message || 'Failed to link playback ID',
      details: String(err),
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    }, { status: 500 });
  }
}

export const runtime = 'nodejs';

