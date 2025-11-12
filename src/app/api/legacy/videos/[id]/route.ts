import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebaseAdmin';
import { mux } from '@/lib/mux';

async function getUid(req: NextRequest): Promise<string | null> {
  const auth = req.headers.get('authorization') || '';
  const token = auth.toLowerCase().startsWith('bearer ') ? auth.split(' ')[1] : '';
  if (!token || !adminAuth) return null;
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    return decoded.uid || null;
  } catch {
    return null;
  }
}

export async function DELETE(req: NextRequest, context: any) {
  try {
    if (!adminDb) return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
    const uid = await getUid(req);
    if (!uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const videoId = String(context?.params?.id || '');
    if (!videoId) return NextResponse.json({ error: 'Missing video id' }, { status: 400 });

    // Resolve the legacy creator doc id this user owns
    let creatorId: string | null = null;
    try {
      const direct = await adminDb.collection('legacy_creators').doc(String(uid)).get();
      if (direct.exists) creatorId = direct.id;
    } catch {}
    if (!creatorId) {
      try {
        const byOwner = await adminDb.collection('legacy_creators').where('ownerUserId', '==', String(uid)).limit(1).get();
        if (!byOwner.empty) creatorId = byOwner.docs[0].id;
      } catch {}
    }
    if (!creatorId) return NextResponse.json({ error: 'Legacy creator not found' }, { status: 404 });

    // Load the video document to ensure it belongs to this creator
    const videoRef = adminDb.collection(`legacy_creators/${creatorId}/videos`).doc(videoId);
    const videoSnap = await videoRef.get();
    if (!videoSnap.exists) return NextResponse.json({ error: 'Video not found' }, { status: 404 });

    const data = videoSnap.data() as any;
    const muxAssetId: string | undefined = data?.muxAssetId;
    const deleteMuxParam = new URL(req.url).searchParams.get('deleteMux');
    const deleteMux = deleteMuxParam ? deleteMuxParam === '1' || deleteMuxParam === 'true' : true;

    // Delete Firestore doc
    await videoRef.delete();

    // Optionally delete the Mux asset
    if (deleteMux && muxAssetId) {
      try {
        await mux.video.assets.delete(muxAssetId);
      } catch {
        // Best effort; ignore if asset already removed or permission denied
      }
    }

    return NextResponse.json({ ok: true, deletedMux: Boolean(deleteMux && muxAssetId) });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to delete video' }, { status: 500 });
  }
}

export const runtime = 'nodejs';


