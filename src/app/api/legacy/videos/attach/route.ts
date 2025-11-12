import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebaseAdmin';
import { mux } from '@/lib/mux';
import { FieldValue } from 'firebase-admin/firestore';

async function getAuth(req: NextRequest): Promise<{ uid: string } | null> {
  const hdr = req.headers.get('authorization') || '';
  const token = hdr.toLowerCase().startsWith('bearer ') ? hdr.split(' ')[1] : '';
  if (!token || !adminAuth) return null;
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    return { uid: decoded.uid };
  } catch {
    return null;
  }
}

// POST /api/legacy/videos/attach
// Body: { creatorId: string, assetId: string, isSample?: boolean, title?: string, description?: string }
// Ensures the given Mux asset has a playback id (creates one if needed),
// then creates a Firestore video doc under legacy_creators/{creatorId}/videos.
export async function POST(req: NextRequest) {
  try {
    if (!adminDb) return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
    const auth = await getAuth(req);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const creatorIdRaw = String(body?.creatorId || '').trim();
    const assetId = String(body?.assetId || '').trim();
    const isSample = Boolean(body?.isSample);
    const title = String(body?.title || '').trim();
    const description = String(body?.description || '').trim();
    if (!creatorIdRaw || !assetId) {
      return NextResponse.json({ error: 'creatorId and assetId are required' }, { status: 400 });
    }

    // Resolve canonical legacy creator doc and ensure ownership
    let creatorDoc = await adminDb.collection('legacy_creators').doc(creatorIdRaw).get();
    if (!creatorDoc.exists) {
      const byOwner = await adminDb.collection('legacy_creators').where('ownerUserId', '==', creatorIdRaw).limit(1).get();
      if (!byOwner.empty) creatorDoc = byOwner.docs[0] as any;
    }
    if (!creatorDoc.exists) {
      return NextResponse.json({ error: 'Legacy creator not found' }, { status: 404 });
    }
    const canonicalId = (creatorDoc as any).id as string;
    const ownerId = (creatorDoc.data() as any)?.ownerUserId || canonicalId;
    if (ownerId !== auth.uid) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Retrieve asset
    const asset: any = await mux.video.assets.retrieve(assetId);
    if (!asset || !asset.id) {
      return NextResponse.json({ error: 'Asset not found in Mux' }, { status: 404 });
    }

    // Ensure playback id exists, create one if missing
    let playbackId: string | null =
      Array.isArray(asset.playback_ids) && asset.playback_ids[0]?.id ? asset.playback_ids[0].id : null;
    if (!playbackId) {
      const created = await mux.video.assets.createPlaybackId(assetId, {
        policy: isSample ? 'public' : 'signed',
      } as any);
      playbackId = created?.id || null;
    }

    const durationSec: number = asset?.duration ? Math.round(Number(asset.duration)) : 0;
    const animatedGifUrl = playbackId ? `https://image.mux.com/${playbackId}/animated.gif?width=320` : null;

    if (!playbackId) {
      return NextResponse.json({ error: 'Failed to create playback id' }, { status: 500 });
    }

    // Write video doc if not already present
    const videosRef = adminDb.collection(`legacy_creators/${canonicalId}/videos`);
    const existing = await videosRef.where('muxAssetId', '==', assetId).limit(1).get();
    if (!existing.empty) {
      // Update missing fields if any
      await existing.docs[0].ref.set(
        {
          muxPlaybackId: playbackId,
          muxAnimatedGifUrl: animatedGifUrl,
          title: title || (existing.docs[0].data() as any)?.title || 'Untitled Video',
          description: description || (existing.docs[0].data() as any)?.description || '',
          isSample,
          durationSec,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    } else {
      await videosRef.add({
        muxAssetId: assetId,
        muxPlaybackId: playbackId,
        muxAnimatedGifUrl: animatedGifUrl,
        title: title || 'Untitled Video',
        description: description || '',
        durationSec,
        isSample,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    }

    // Set featured if missing and this is a sample
    if (isSample) {
      try {
        const cref = adminDb.collection('legacy_creators').doc(canonicalId);
        const csnap = await cref.get();
        const cdata = csnap.exists ? (csnap.data() as any) : null;
        const hasFeatured = Boolean(cdata?.featured?.playbackId);
        if (!hasFeatured) {
          await cref.set(
            {
              featured: {
                playbackId,
                title: title || 'Featured',
                description: description || '',
                durationSec,
              },
              updatedAt: FieldValue.serverTimestamp(),
            },
            { merge: true }
          );
        }
      } catch {}
    }

    return NextResponse.json({ ok: true, playbackId });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Attach failed' }, { status: 500 });
  }
}

export const runtime = 'nodejs';


