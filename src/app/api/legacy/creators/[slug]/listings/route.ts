import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';

export async function GET(req: NextRequest, context: { params: { slug: string } }) {
  try {
    if (!adminDb) return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
    const slug = String(context.params?.slug || '');
    if (!slug) return NextResponse.json({ error: 'Missing slug' }, { status: 400 });

    // Resolve slug to creatorId
    let creatorId = slug;
    const slugDoc = await adminDb.collection('legacy_creators').doc(slug).get().catch(() => null as any);
    if (!slugDoc || !slugDoc.exists) {
      // If slug is not a doc id, try to match by kitSlug field
      const q = await adminDb.collection('legacy_creators').where('kitSlug', '==', slug).limit(1).get().catch(() => null as any);
      if (!q || q.empty) return NextResponse.json({ listings: [] });
      creatorId = q.docs[0].id;
    }

    // Query listings for this creator
    const snap = await adminDb
      .collection('listings')
      .where('creatorId', '==', String(creatorId))
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get()
      .catch(() => null as any);
    if (!snap) return NextResponse.json({ listings: [] });

    const listings = snap.docs.map((d: any) => {
      const data = d.data() as any;
      return {
        id: d.id,
        title: data.title || '',
        price: data.price || 0,
        condition: data.condition || '',
        images: Array.isArray(data.images) ? data.images.slice(0, 3) : [],
        location: data.location || '',
        shipping: data.shipping ?? 0,
        createdAt: (data.createdAt && (data.createdAt.toDate?.() || data.createdAt)) || null
      };
    });

    return NextResponse.json({ listings });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to load listings' }, { status: 500 });
  }
}

export const runtime = 'nodejs';

