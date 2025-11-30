import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';
import * as FirebaseFirestore from 'firebase-admin/firestore';

/**
 * Verify user is authorized (info@cochranfilms.com)
 */
async function verifyAuth(req: NextRequest): Promise<{ uid: string; email: string } | null> {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7);
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    if (decoded.email !== 'info@cochranfilms.com') {
      return null;
    }
    return { uid: decoded.uid, email: decoded.email };
  } catch {
    return null;
  }
}

// POST /api/admin/assets/update-asset-title
// Updates the title of an asset and all related lutPreview documents
export async function POST(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!adminDb) {
    return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
  }

  try {
    const { assetId, title } = await req.json();

    if (!assetId || !title) {
      return NextResponse.json(
        { error: 'Missing assetId or title' },
        { status: 400 }
      );
    }

    // Get the asset document
    const assetRef = adminDb.collection('assets').doc(assetId);
    const assetDoc = await assetRef.get();

    if (!assetDoc.exists) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
    }

    // Update asset document
    await assetRef.update({
      title: title.trim(),
      updatedAt: FirebaseFirestore.FieldValue.serverTimestamp(),
    });

    // Update all lutPreview documents for this asset
    const lutPreviewsSnap = await adminDb
      .collection('assets')
      .doc(assetId)
      .collection('lutPreviews')
      .get();

    const updatePromises = lutPreviewsSnap.docs.map((doc: FirebaseFirestore.QueryDocumentSnapshot) =>
      doc.ref.update({
        assetTitle: title.trim(),
        updatedAt: FirebaseFirestore.FieldValue.serverTimestamp(),
      })
    );

    await Promise.all(updatePromises);

    return NextResponse.json({
      success: true,
      message: 'Asset title updated successfully',
      title: title.trim(),
      previewsUpdated: lutPreviewsSnap.size,
    });
  } catch (error: unknown) {
    console.error('Error updating asset title:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to update asset title';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

export const runtime = 'nodejs';

