import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';

export async function GET(req: NextRequest) {
  try {
    if (!adminDb) return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
    const { searchParams } = new URL(req.url);
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '24', 10), 1), 100);
    const cursor = searchParams.get('cursor');

    let ref = adminDb.collection('opportunities').orderBy('posted', 'desc').limit(limit);
    if (cursor) {
      try {
        const cur = Number(cursor);
        const ts = isNaN(cur) ? null : new Date(cur);
        if (ts) ref = ref.startAfter(ts as any);
      } catch {}
    }

    const snap = await ref.get();
    const jobs = snap.docs.map((d: any) => {
      const data = d.data() as any;
      return {
        id: d.id,
        title: data.title || '',
        company: data.company || '',
        location: data.location || 'Remote',
        type: data.type || 'Freelance',
        applyUrl: data.applyUrl || '',
        posted: (data.posted && (data.posted.toDate?.() || data.posted)) || null
      };
    });
    const last = snap.docs[snap.docs.length - 1];
    const nextCursor = last ? String((last.get('posted')?.toDate?.() || last.get('posted') || '')?.getTime?.() || '') : null;
    return NextResponse.json({ jobs, nextCursor });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to list jobs' }, { status: 500 });
  }
}

export const runtime = 'nodejs';

