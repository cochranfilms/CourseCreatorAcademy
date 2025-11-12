import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebaseAdmin';
import { mux } from '@/lib/mux';
import { FieldValue } from 'firebase-admin/firestore';

async function getUid(req: NextRequest): Promise<string | null> {
  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.toLowerCase().startsWith('bearer ') ? authHeader.split(' ')[1] : '';
  if (!token || !adminAuth) return null;
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    return decoded.uid || null;
  } catch {
    return null;
  }
}

// POST /api/legacy/backfill/videos
// Body: { creatorId: string }
// For a given legacy creator, scan recent Mux assets for matching passthrough. If any videos
// are missing in Firestore, create them. Also set featured if absent.
export async function POST(req: NextRequest) {
  try {
    if (!adminDb) return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
    const uid = await getUid(req);
    if (!uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { creatorId } = await req.json().catch(() => ({}));
    if (!creatorId) return NextResponse.json({ error: 'creatorId is required' }, { status: 400 });

    // Verify the caller owns this legacy creator (or has an existing mapping)
    const legacyDoc = await adminDb.collection('legacy_creators').doc(String(creatorId)).get();
    if (!legacyDoc.exists) {
      const byOwner = await adminDb.collection('legacy_creators').where('ownerUserId', '==', String(creatorId)).limit(1).get();
      if (byOwner.empty) return NextResponse.json({ error: 'Legacy creator not found' }, { status: 404 });
    }
    const canonicalId = legacyDoc.exists ? legacyDoc.id : (await adminDb.collection('legacy_creators').where('ownerUserId', '==', String(creatorId)).limit(1).get()).docs[0].id;

    // Only allow owner or same uid creator mapping
    const ownerId = (legacyDoc.exists ? (legacyDoc.data() as any)?.ownerUserId : creatorId) || creatorId;
    if (ownerId !== uid) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    let added = 0;
    let updatedFeatured = false;

    // Fetch recent assets (up to 100). If many, this can be extended with pagination.
    const assets = await mux.video.assets.list({ limit: 100 } as any);
    const videosRef = adminDb.collection(`legacy_creators/${canonicalId}/videos`);

    for (const a of (assets?.data || [])) {
      const data: any = a;
      const passthroughRaw: any = data?.passthrough;
      let pt: any = null;
      try { pt = typeof passthroughRaw === 'string' ? JSON.parse(passthroughRaw) : passthroughRaw; } catch {}
      if (!pt || pt.legacyCreatorId !== String(canonicalId)) continue;

      const muxAssetId: string | undefined = data?.id;
      const muxPlaybackId: string | undefined = data?.playback_ids?.[0]?.id;
      const durationSec: number = data?.duration ? Math.round(Number(data.duration)) : 0;
      const isSample: boolean = Boolean(pt?.isSample);
      const title: string = pt?.title || 'Untitled Video';
      const description: string = pt?.description || '';
      const animatedGifUrl = muxPlaybackId ? `https://image.mux.com/${muxPlaybackId}/animated.gif?width=320` : null;

      if (!muxAssetId) continue;

      // Check if present
      const existing = await videosRef.where('muxAssetId', '==', muxAssetId).limit(1).get();
      if (!existing.empty) continue;

      await videosRef.add({
        muxAssetId,
        muxPlaybackId: muxPlaybackId || null,
        muxAnimatedGifUrl: animatedGifUrl,
        title,
        description,
        durationSec,
        isSample,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      added++;
    }

    // Ensure featured exists if we added at least one sample with playbackId
    if (added > 0) {
      try {
        const cRef = adminDb.collection('legacy_creators').doc(canonicalId);
        const cSnap = await cRef.get();
        const cData = cSnap.exists ? (cSnap.data() as any) : null;
        const hasFeatured = Boolean(cData?.featured?.playbackId);
        if (!hasFeatured) {
          const anySample = await videosRef.where('isSample', '==', true).limit(1).get();
          if (!anySample.empty) {
            const d = anySample.docs[0].data() as any;
            if (d?.muxPlaybackId) {
              await cRef.set({
                featured: {
                  playbackId: d.muxPlaybackId,
                  title: d.title || 'Featured',
                  description: d.description || '',
                  durationSec: d.durationSec || 0,
                },
                updatedAt: FieldValue.serverTimestamp(),
              }, { merge: true });
              updatedFeatured = true;
            }
          }
        }
      } catch {}
    }

    return NextResponse.json({ ok: true, added, updatedFeatured });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Backfill failed' }, { status: 500 });
  }
}

export const runtime = 'nodejs';


