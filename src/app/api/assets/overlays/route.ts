import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminStorage } from '@/lib/firebaseAdmin';
import * as FirebaseFirestore from 'firebase-admin/firestore';

// GET /api/assets/overlays
// Returns list of all individual overlays from all overlay assets
export async function GET(req: NextRequest) {
  try {
    if (!adminDb || !adminStorage) {
      return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
    }

    // Get all overlay assets
    const overlayAssetsSnap = await adminDb
      .collection('assets')
      .where('category', '==', 'Overlays & Transitions')
      .get();

    const allOverlays: any[] = [];

    // Fetch overlays from each asset's subcollection
    for (const assetDoc of overlayAssetsSnap.docs) {
      const assetId = assetDoc.id;
      const assetData = assetDoc.data();

      const overlaysSnap = await adminDb
        .collection('assets')
        .doc(assetId)
        .collection('overlays')
        .orderBy('fileName', 'asc')
        .get();

      overlaysSnap.docs.forEach((doc: FirebaseFirestore.QueryDocumentSnapshot) => {
        allOverlays.push({
          id: doc.id,
          ...doc.data(),
          assetId,
          assetTitle: assetData.title || 'Untitled',
        });
      });
    }

    return NextResponse.json({ overlays: allOverlays });
  } catch (err: any) {
    console.error('Error fetching overlays:', err);
    return NextResponse.json({ error: err?.message || 'Failed to fetch overlays' }, { status: 500 });
  }
}

export const runtime = 'nodejs';

