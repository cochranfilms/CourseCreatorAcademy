import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';

export async function GET(req: NextRequest) {
  try {
    if (!adminDb) return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
    const { searchParams } = new URL(req.url);
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '24', 10), 1), 100);
    const cursor = searchParams.get('cursor'); // ISO date millis or firestore timestamp string

    let ref = adminDb.collection('listings').orderBy('createdAt', 'desc').limit(limit);
    if (cursor) {
      try {
        // Accept millis
        const cur = Number(cursor);
        const ts = isNaN(cur) ? null : new Date(cur);
        if (ts) {
          ref = ref.startAfter(ts as any);
        }
      } catch {}
    }

    const snap = await ref.get();
    const results = await Promise.all(
      snap.docs.map(async (d: any) => {
        const data = d.data() as any;
        let creatorName = '';
        if (data.creatorId) {
          try {
            const u = await adminDb.collection('users').doc(String(data.creatorId)).get();
            const ud = u.exists ? (u.data() as any) : null;
            creatorName = ud?.displayName || '';
          } catch {}
        }
        return {
          id: d.id,
          title: data.title || '',
          price: data.price || 0,
          condition: data.condition || '',
          images: Array.isArray(data.images) ? data.images.slice(0, 3) : [],
          location: data.location || '',
          shipping: data.shipping ?? 0,
          creatorId: data.creatorId || '',
          creatorName,
          createdAt: (data.createdAt && (data.createdAt.toDate?.() || data.createdAt)) || null
        };
      })
    );
    const last = snap.docs[snap.docs.length - 1];
    const nextCursor = last ? String((last.get('createdAt')?.toDate?.() || last.get('createdAt') || '')?.getTime?.() || '') : null;
    return NextResponse.json({ listings: results, nextCursor });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to list' }, { status: 500 });
  }
}

export const runtime = 'nodejs';

