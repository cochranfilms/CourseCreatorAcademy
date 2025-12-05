import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import { hasAccessToCreator } from '@/lib/entitlements';

// GET /api/legacy/creators/[slug]?userId=optional
// Returns public creator info and up to 3 sample videos.
// If userId is provided and user has active subscription to this creator,
// the response also includes all non-sample videos.
export async function GET(req: NextRequest, context: any) {
  try {
    if (!adminDb) {
      return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
    }

    const slug = decodeURIComponent(String(context?.params?.slug || ''));
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId') || undefined;

    // Find creator by kitSlug, fallback to doc id, then by ownerUserId
    let creatorDoc: FirebaseFirestore.QueryDocumentSnapshot | FirebaseFirestore.DocumentSnapshot | null = null;
    const bySlug = await adminDb.collection('legacy_creators').where('kitSlug', '==', slug).limit(1).get();
    if (!bySlug.empty) {
      creatorDoc = bySlug.docs[0];
    } else {
      const byId = await adminDb.collection('legacy_creators').doc(slug).get();
      if (byId.exists) creatorDoc = byId;
      if (!creatorDoc) {
        const byOwner = await adminDb.collection('legacy_creators').where('ownerUserId', '==', slug).limit(1).get();
        if (!byOwner.empty) creatorDoc = byOwner.docs[0];
      }
    }

    if (!creatorDoc || ("exists" in creatorDoc && !creatorDoc.exists)) {
      const soft = searchParams.get('soft');
      if (soft) return NextResponse.json({ creator: null });
      return NextResponse.json({ error: 'Creator not found' }, { status: 404 });
    }

    const creatorId = (creatorDoc as any).id as string;
    const cdata = (creatorDoc as any).data() as any;

    const creator = {
      id: creatorId,
      displayName: cdata.displayName || cdata.handle || 'Creator',
      handle: cdata.handle || '',
      avatarUrl: cdata.avatarUrl || null,
      bannerUrl: cdata.bannerUrl || null,
      bio: cdata.bio || '',
      kitSlug: cdata.kitSlug || creatorId,
      // Optional customizations for public page
      featured: cdata.featured || null,
      assets: cdata.assets || null,
      gear: cdata.gear || null,
    };

    // Determine subscription status (optional)
    // Uses hasAccessToCreator which checks for all-access membership OR per-creator subscription
    let subscribed = false;
    if (userId) {
      try {
        subscribed = await hasAccessToCreator(userId, creatorId);
      } catch (err) {
        // Silently fail - subscription check is optional
        console.error('Error checking subscription status:', err);
      }
    }

    // Fetch sample videos (visible to all)
    const samplesSnap = await adminDb
      .collection(`legacy_creators/${creatorId}/videos`)
      .where('isSample', '==', true)
      .orderBy('createdAt', 'desc')
      .limit(3)
      .get()
      .catch(async () => {
        // If index/order missing, just list and filter client-side
        const all = await adminDb.collection(`legacy_creators/${creatorId}/videos`).get();
        return { docs: all.docs.filter((d: any) => (d.data() as any)?.isSample).slice(0, 3) } as any;
      });

    const samples = samplesSnap.docs.map((d: any) => ({ id: d.id, ...(d.data() as any) }));

    // Include full (non-sample) videos only for subscribers
    let full: any[] = [];
    if (subscribed) {
      const fullSnap = await adminDb
        .collection(`legacy_creators/${creatorId}/videos`)
        .where('isSample', '==', false)
        .orderBy('createdAt', 'desc')
        .get()
        .catch(async () => {
          const all = await adminDb.collection(`legacy_creators/${creatorId}/videos`).get();
          return { docs: all.docs.filter((d: any) => !(d.data() as any)?.isSample) } as any;
        });
      full = fullSnap.docs.map((d: any) => ({ id: d.id, ...(d.data() as any) }));
    }

    return NextResponse.json({ creator, subscribed, samples, full });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';


