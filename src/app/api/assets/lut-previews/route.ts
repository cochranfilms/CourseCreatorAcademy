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
    // Try with orderBy first, fallback to no ordering if it fails (missing index or field)
    let lutPreviewsSnap;
    try {
      lutPreviewsSnap = await adminDb
        .collection('assets')
        .doc(assetId)
        .collection('lutPreviews')
        .orderBy('lutName', 'asc')
        .get();
    } catch (orderByError: any) {
      // If orderBy fails (missing index or field), try without ordering
      console.warn(`[LUT Previews] orderBy failed for asset ${assetId}, fetching without order:`, orderByError?.message);
      lutPreviewsSnap = await adminDb
        .collection('assets')
        .doc(assetId)
        .collection('lutPreviews')
        .get();
    }

    let lutPreviews = lutPreviewsSnap.docs.map((doc: FirebaseFirestore.QueryDocumentSnapshot) => ({
      id: doc.id,
      ...doc.data(),
    }));

    // Sort manually if orderBy failed
    lutPreviews.sort((a: any, b: any) => {
      const nameA = (a.lutName || '').toLowerCase();
      const nameB = (b.lutName || '').toLowerCase();
      return nameA.localeCompare(nameB);
    });

    // If no previews found in subcollection, check flat collection for legacy documents
    if (lutPreviews.length === 0) {
      let flatSnap;
      try {
        flatSnap = await adminDb
          .collection('lutPreviews')
          .where('assetId', '==', assetId)
          .orderBy('lutName', 'asc')
          .get();
      } catch (orderByError: any) {
        // If orderBy fails, try without ordering
        console.warn(`[LUT Previews] orderBy failed for flat collection, fetching without order:`, orderByError?.message);
        flatSnap = await adminDb
          .collection('lutPreviews')
          .where('assetId', '==', assetId)
          .get();
      }

      const flatPreviews = flatSnap.docs.map((doc: FirebaseFirestore.QueryDocumentSnapshot) => ({
        id: doc.id,
        ...doc.data(),
      }));

      // Sort manually
      flatPreviews.sort((a: any, b: any) => {
        const nameA = (a.lutName || '').toLowerCase();
        const nameB = (b.lutName || '').toLowerCase();
        return nameA.localeCompare(nameB);
      });

      lutPreviews.push(...flatPreviews);
    }

    return NextResponse.json({ lutPreviews });
  } catch (err: any) {
    console.error('Error fetching LUT previews:', err);
    return NextResponse.json({ error: err?.message || 'Failed to fetch LUT previews' }, { status: 500 });
  }
}

export const runtime = 'nodejs';

