import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebaseAdmin';
import { mux } from '@/lib/mux';

// PUT /api/legacy/videos/[id]
// Update video metadata
export async function PUT(req: NextRequest, context: any) {
  try {
    if (!adminDb || !adminAuth) {
      return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
    }

    const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
    if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) {
      return NextResponse.json({ error: 'Missing Authorization header' }, { status: 401 });
    }
    const idToken = authHeader.split(' ')[1];
    const decoded = await adminAuth.verifyIdToken(idToken);
    const uid = decoded.uid;

    const videoId = String(context?.params?.id || '');
    if (!videoId) {
      return NextResponse.json({ error: 'Missing video ID' }, { status: 400 });
    }

    const body = await req.json();
    const { title, description, isSample, playlistId } = body;

    // Find the video document
    let videoDoc = null;
    let creatorId = '';

    // Search through all legacy creators to find the video
    const creatorsSnap = await adminDb.collection('legacy_creators').get();
    for (const creatorDoc of creatorsSnap.docs) {
      const vidRef = adminDb.collection(`legacy_creators/${creatorDoc.id}/videos`).doc(videoId);
      const vidSnap = await vidRef.get();
      if (vidSnap.exists) {
        videoDoc = vidSnap;
        creatorId = creatorDoc.id;
        break;
      }
    }

    if (!videoDoc || !videoDoc.exists) {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 });
    }

    // Verify ownership
    const creatorDoc = await adminDb.collection('legacy_creators').doc(creatorId).get();
    const creatorData = creatorDoc.exists ? (creatorDoc.data() as any) : {};
    const ownerId = creatorData.ownerUserId || creatorId;
    if (ownerId !== uid) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Update video document
    const updates: Record<string, any> = {};
    if (title !== undefined) updates.title = String(title);
    if (description !== undefined) updates.description = String(description);
    if (isSample !== undefined) updates.isSample = Boolean(isSample);
    if (playlistId !== undefined) updates.playlistId = playlistId || null;

    await videoDoc.ref.update({
      ...updates,
      updatedAt: new Date(),
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to update video' }, { status: 500 });
  }
}

// DELETE /api/legacy/videos/[id]
// Delete video (optionally delete from Mux)
export async function DELETE(req: NextRequest, context: any) {
  try {
    if (!adminDb || !adminAuth) {
      return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
    }

    const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
    if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) {
      return NextResponse.json({ error: 'Missing Authorization header' }, { status: 401 });
    }
    const idToken = authHeader.split(' ')[1];
    const decoded = await adminAuth.verifyIdToken(idToken);
    const uid = decoded.uid;

    const videoId = String(context?.params?.id || '');
    if (!videoId) {
      return NextResponse.json({ error: 'Missing video ID' }, { status: 400 });
    }

    const { searchParams } = new URL(req.url);
    const deleteMux = searchParams.get('deleteMux') === '1';

    // Find the video document
    let videoDoc = null;
    let creatorId = '';
    let videoData: any = null;

    const creatorsSnap = await adminDb.collection('legacy_creators').get();
    for (const creatorDoc of creatorsSnap.docs) {
      const vidRef = adminDb.collection(`legacy_creators/${creatorDoc.id}/videos`).doc(videoId);
      const vidSnap = await vidRef.get();
      if (vidSnap.exists) {
        videoDoc = vidSnap;
        creatorId = creatorDoc.id;
        videoData = vidSnap.data();
        break;
      }
    }

    if (!videoDoc || !videoDoc.exists) {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 });
    }

    // Verify ownership
    const creatorDoc = await adminDb.collection('legacy_creators').doc(creatorId).get();
    const creatorData = creatorDoc.exists ? (creatorDoc.data() as any) : {};
    const ownerId = creatorData.ownerUserId || creatorId;
    if (ownerId !== uid) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Delete from Mux if requested
    if (deleteMux && videoData?.muxAssetId) {
      try {
        await mux.video.assets.delete(videoData.muxAssetId);
      } catch (muxErr: any) {
        console.error('Mux delete error:', muxErr);
        // Continue with Firestore delete even if Mux delete fails
      }
    }

    // Delete Firestore document
    await videoDoc.ref.delete();

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to delete video' }, { status: 500 });
  }
}

export const runtime = 'nodejs';
