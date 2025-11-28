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

// GET /api/admin/assets/overlay-files
// Returns all individual overlay/transition files from all assets
export async function GET(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!adminDb) {
    return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
  }

  try {
    // Get all assets in Overlays & Transitions category
    const overlayAssetsSnap = await adminDb
      .collection('assets')
      .where('category', '==', 'Overlays & Transitions')
      .get();

    const allFiles: Array<{
      id: string;
      assetId: string;
      assetTitle: string;
      fileName: string;
      storagePath: string;
      previewStoragePath?: string;
      fileType?: string;
    }> = [];

    // Fetch overlay files from each asset's subcollection
    for (const assetDoc of overlayAssetsSnap.docs) {
      const assetId = assetDoc.id;
      const assetData = assetDoc.data();
      const assetTitle = assetData.title || 'Untitled';

      try {
        const overlaysSnap = await adminDb
          .collection('assets')
          .doc(assetId)
          .collection('overlays')
          .orderBy('fileName', 'asc')
          .get();

        overlaysSnap.docs.forEach((doc: FirebaseFirestore.QueryDocumentSnapshot) => {
          const data = doc.data();
          allFiles.push({
            id: doc.id,
            assetId,
            assetTitle,
            fileName: data.fileName || '',
            storagePath: data.storagePath || '',
            previewStoragePath: data.previewStoragePath,
            fileType: data.fileType,
          });
        });
      } catch (error) {
        console.error(`Error loading overlays for asset ${assetId}:`, error);
        // Continue with other assets even if one fails
      }
    }

    return NextResponse.json({ files: allFiles });
  } catch (error: unknown) {
    console.error('Error fetching overlay files:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch overlay files';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

