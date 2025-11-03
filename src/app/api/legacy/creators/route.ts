import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';

// GET /api/legacy/creators
// Returns the list of Legacy creators (public fields only)
export async function GET(req: NextRequest) {
  try {
    if (!adminDb) {
      return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
    }

    const snap = await adminDb.collection('legacy_creators').orderBy('order', 'asc').get().catch(async () => {
      // If no index for order, just list all
      return await adminDb.collection('legacy_creators').get();
    });
    const creators = snap.docs.map((d) => {
      const data = d.data() as any;
      return {
        id: d.id,
        handle: data.handle || '',
        displayName: data.displayName || '',
        avatarUrl: data.avatarUrl || null,
        bannerUrl: data.bannerUrl || null,
        connectAccountId: data.connectAccountId || null,
        samplesCount: Number(data.samplesCount || 0),
        kitSlug: data.kitSlug || d.id,
      };
    });
    return NextResponse.json({ creators });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to list creators' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';


