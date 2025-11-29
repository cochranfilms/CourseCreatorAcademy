import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import { mux } from '@/lib/mux';
import { FieldValue } from 'firebase-admin/firestore';
import { z } from 'zod';

const schema = z.object({
  lessonId: z.string().min(1),
  courseId: z.string().min(1),
  moduleId: z.string().min(1),
  assetId: z.string().min(1), // MUX Asset ID
});

/**
 * Convert an existing MUX asset to use signed playback policy.
 * This creates a new signed playback ID and updates the lesson document.
 */
export async function POST(req: NextRequest) {
  try {
    // Verify admin access
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const idToken = authHeader.substring(7);
    const { adminAuth } = await import('@/lib/firebaseAdmin');
    if (!adminAuth) {
      return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
    }
    const decoded = await adminAuth.verifyIdToken(idToken);
    if (decoded.email !== 'info@cochranfilms.com') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid body', details: parsed.error }, { status: 400 });
    }
    const { lessonId, courseId, moduleId, assetId } = parsed.data;

    if (!adminDb) {
      return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
    }

    // Verify lesson exists
    const lessonRef = adminDb
      .collection('courses')
      .doc(courseId)
      .collection('modules')
      .doc(moduleId)
      .collection('lessons')
      .doc(lessonId);
    const lessonDoc = await lessonRef.get();
    if (!lessonDoc.exists) {
      return NextResponse.json({ error: 'Lesson not found' }, { status: 404 });
    }

    // Fetch asset from MUX
    console.log(`[convert-to-signed] Fetching asset ${assetId} from MUX`);
    let asset;
    try {
      asset = await mux.video.assets.retrieve(assetId);
    } catch (err: any) {
      console.error(`[convert-to-signed] Error fetching asset ${assetId}:`, err);
      if (err?.status === 400 && err?.response?.data?.error?.messages?.some((m: string) => m.includes('Failed to parse ID'))) {
        return NextResponse.json(
          { 
            error: 'Invalid Asset ID',
            message: 'The provided Asset ID appears to be invalid. Please verify it from the MUX dashboard.',
            details: err.response?.data
          },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { error: 'Failed to fetch asset from MUX', details: err?.message || String(err) },
        { status: 500 }
      );
    }

    if (!asset) {
      return NextResponse.json({ error: 'Asset not found in MUX' }, { status: 404 });
    }

    // Check if asset already has a signed playback ID
    const existingSignedPlaybackId = asset.playback_ids?.find((pid: any) => pid.policy === 'signed');
    if (existingSignedPlaybackId) {
      console.log(`[convert-to-signed] Asset already has signed playback ID: ${existingSignedPlaybackId.id}`);
      // Update lesson with existing signed playback ID if not already set
      const lessonData = lessonDoc.data() as any;
      if (lessonData?.muxPlaybackId !== existingSignedPlaybackId.id) {
        await lessonRef.set({
          muxPlaybackId: existingSignedPlaybackId.id,
          muxAssetId: assetId,
          muxAnimatedGifUrl: `https://image.mux.com/${existingSignedPlaybackId.id}/animated.gif?width=320`,
          durationSec: asset.duration ? Math.round(Number(asset.duration)) : undefined,
          updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
      }
      return NextResponse.json({
        success: true,
        message: 'Asset already has a signed playback ID',
        playbackId: existingSignedPlaybackId.id,
        assetId,
      });
    }

    // Create a new signed playback ID
    console.log(`[convert-to-signed] Creating signed playback ID for asset ${assetId}`);
    let newPlaybackId;
    try {
      const playbackIdResponse = await mux.video.assets.createPlaybackId(assetId, {
        policy: 'signed',
      } as any);
      newPlaybackId = playbackIdResponse?.id;
      if (!newPlaybackId) {
        return NextResponse.json({ error: 'Failed to create signed playback ID' }, { status: 500 });
      }
      console.log(`[convert-to-signed] Created signed playback ID: ${newPlaybackId}`);
    } catch (err: any) {
      console.error(`[convert-to-signed] Error creating playback ID:`, err);
      return NextResponse.json(
        { error: 'Failed to create signed playback ID', details: err?.message || String(err) },
        { status: 500 }
      );
    }

    // Update lesson document with new signed playback ID
    const durationSec = asset.duration ? Math.round(Number(asset.duration)) : undefined;
    await lessonRef.set({
      muxPlaybackId: newPlaybackId,
      muxAssetId: assetId,
      muxAnimatedGifUrl: `https://image.mux.com/${newPlaybackId}/animated.gif?width=320`,
      durationSec,
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    console.log(`[convert-to-signed] Successfully updated lesson ${lessonId} with signed playback ID ${newPlaybackId}`);

    return NextResponse.json({
      success: true,
      message: 'Successfully converted asset to signed playback',
      playbackId: newPlaybackId,
      assetId,
      durationSec,
    });
  } catch (err: any) {
    console.error('[convert-to-signed] Unexpected error:', err);
    return NextResponse.json(
      { error: 'Internal server error', details: err?.message || String(err) },
      { status: 500 }
    );
  }
}

export const runtime = 'nodejs';

