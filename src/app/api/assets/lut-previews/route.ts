import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminStorage } from '@/lib/firebaseAdmin';
import * as FirebaseFirestore from 'firebase-admin/firestore';

// GET /api/assets/lut-previews?assetId=xxx
// Returns list of individual LUT previews for a LUT asset pack
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

    // Get LUT previews from subcollection (preferred location)
    const lutPreviewsSnap = await adminDb
      .collection('assets')
      .doc(assetId)
      .collection('lutPreviews')
      .orderBy('lutName', 'asc')
      .get();

    const lutPreviews = lutPreviewsSnap.docs.map((doc: FirebaseFirestore.QueryDocumentSnapshot) => ({
      id: doc.id,
      ...doc.data(),
    }));

    // If no previews found in subcollection, check flat collection for legacy documents
    if (lutPreviews.length === 0) {
      const flatSnap = await adminDb
        .collection('lutPreviews')
        .where('assetId', '==', assetId)
        .orderBy('lutName', 'asc')
        .get();

      flatSnap.docs.forEach((doc: FirebaseFirestore.QueryDocumentSnapshot) => {
        lutPreviews.push({
          id: doc.id,
          ...doc.data(),
        });
      });
    }

    return NextResponse.json({ lutPreviews });
  } catch (err: any) {
    console.error('Error fetching LUT previews:', err);
    return NextResponse.json({ error: err?.message || 'Failed to fetch LUT previews' }, { status: 500 });
  }
}

export const runtime = 'nodejs';

