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
    const processedOverlayIds = new Set<string>();

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
        processedOverlayIds.add(doc.id);
        allOverlays.push({
          id: doc.id,
          ...doc.data(),
          assetId,
          assetTitle: assetData.title || 'Untitled',
        });
      });
    }

    // Also fetch from flat overlays collection
    const flatOverlaysSnap = await adminDb
      .collection('overlays')
      .orderBy('fileName', 'asc')
      .get();

    // Create a map of assetId -> asset title for quick lookup
    const assetMap = new Map<string, string>();
    overlayAssetsSnap.docs.forEach((doc) => {
      assetMap.set(doc.id, doc.data().title || 'Untitled');
    });

    flatOverlaysSnap.docs.forEach((doc: FirebaseFirestore.QueryDocumentSnapshot) => {
      // Skip if already processed from subcollection
      if (processedOverlayIds.has(doc.id)) {
        return;
      }

      const overlayData = doc.data();
      const assetId = overlayData.assetId;
      const assetTitle = assetMap.get(assetId) || overlayData.assetTitle || 'Untitled';

      allOverlays.push({
        id: doc.id,
        ...overlayData,
        assetId,
        assetTitle,
      });
    });

    return NextResponse.json({ overlays: allOverlays });
  } catch (err: any) {
    console.error('Error fetching overlays:', err);
    return NextResponse.json({ error: err?.message || 'Failed to fetch overlays' }, { status: 500 });
  }
}

export const runtime = 'nodejs';

