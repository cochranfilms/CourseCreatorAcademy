import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminStorage } from '@/lib/firebaseAdmin';
import * as FirebaseFirestore from 'firebase-admin/firestore';

// GET /api/assets/sound-effects?assetId=xxx
// Returns list of individual sound effects for an SFX asset pack
export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const assetId = searchParams.get('assetId');

    if (!assetId) {
      return NextResponse.json({ error: 'assetId is required' }, { status: 400 });
    }

    if (!adminDb || !adminStorage) {
      return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
    }

    // Get sound effects from subcollection
    const soundEffectsSnap = await adminDb
      .collection('assets')
      .doc(assetId)
      .collection('soundEffects')
      .orderBy('fileName', 'asc')
      .get();

    const soundEffects = soundEffectsSnap.docs.map((doc: FirebaseFirestore.QueryDocumentSnapshot) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return NextResponse.json({ soundEffects });
  } catch (err: any) {
    console.error('Error fetching sound effects:', err);
    return NextResponse.json({ error: err?.message || 'Failed to fetch sound effects' }, { status: 500 });
  }
}

export const runtime = 'nodejs';

