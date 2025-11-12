import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';

export async function GET(req: NextRequest, context: any) {
  try {
    if (!adminDb) return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
    const slug = String(context?.params?.slug || '');
    if (!slug) return NextResponse.json({ error: 'Missing slug' }, { status: 400 });

    // Resolve slug (id or kitSlug) to creatorId
    let creatorId = slug;
    const direct = await adminDb.collection('legacy_creators').doc(slug).get().catch(() => null as any);
    if (!direct || !direct.exists) {
      const q = await adminDb.collection('legacy_creators').where('kitSlug', '==', slug).limit(1).get().catch(() => null as any);
      if (!q || q.empty) return NextResponse.json({ opportunities: [] });
      creatorId = q.docs[0].id;
    }

    const snap = await adminDb
      .collection(`legacy_creators/${creatorId}/opportunities`)
      .orderBy('posted', 'desc')
      .limit(50)
      .get()
      .catch(() => null as any);

    if (!snap) return NextResponse.json({ opportunities: [] });
    const opportunities = snap.docs.map((d: any) => {
      const data = d.data() as any;
      return {
        id: d.id,
        title: data.title || '',
        location: data.location || '',
        type: data.type || '',
        applyUrl: data.applyUrl || '',
        description: data.description || '',
        posted: (data.posted && (data.posted.toDate?.() || data.posted)) || null
      };
    });

    return NextResponse.json({ opportunities });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to load opportunities' }, { status: 500 });
  }
}

export const runtime = 'nodejs';

