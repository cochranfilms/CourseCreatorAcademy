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
        const asset = await mux.video.assets.retrieve(assetId);
        finalAssetId = asset.id;
        finalPlaybackId = asset.playback_ids?.[0]?.id || undefined;
        durationSec = asset.duration ? Math.round(Number(asset.duration)) : 0;
        
        if (!finalPlaybackId) {
          return NextResponse.json({ 
            error: 'Asset found but has no playback ID. The asset may still be processing.' 
          }, { status: 400 });
        }
      } catch (err: any) {
        return NextResponse.json({ 
          error: 'Failed to fetch asset from MUX', 
          details: err.message 
        }, { status: 500 });
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
          } catch {
            // Ignore upload lookup errors
          }
        }
      } catch (err: any) {
        return NextResponse.json({ 
          error: 'Failed to fetch asset details from MUX', 
          details: err.message 
        }, { status: 500 });
      }
    }
    // If both provided, verify they match and get duration
    else if (playbackId && assetId) {
      try {
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
        return NextResponse.json({ 
          error: 'Failed to verify asset from MUX', 
          details: err.message 
        }, { status: 500 });
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

    await lessonRef.set(updates, { merge: true });

    return NextResponse.json({ 
      success: true,
      playbackId: finalPlaybackId,
      assetId: finalAssetId,
      durationSec,
    });
  } catch (err: any) {
    console.error('Error linking MUX playback ID:', err);
    return NextResponse.json({ error: err.message || 'Failed to link playback ID' }, { status: 500 });
  }
}

export const runtime = 'nodejs';

