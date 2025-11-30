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

// GET /api/admin/assets/preset-files
// Returns all individual preset files from all assets
export async function GET(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!adminDb) {
    return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
  }

  try {
    // Get all assets in LUTs & Presets category with Presets subcategory
    const presetAssetsSnap = await adminDb
      .collection('assets')
      .where('category', '==', 'LUTs & Presets')
      .get();

    const allFiles: Array<{
      id: string;
      assetId: string;
      assetTitle: string;
      fileName: string;
      storagePath: string;
      fileType?: string;
      relativePath?: string;
      beforeImagePath?: string;
      beforeImageUrl?: string;
      afterImagePath?: string;
      afterImageUrl?: string;
    }> = [];

    // Fetch preset files from each asset's subcollection
    for (const assetDoc of presetAssetsSnap.docs) {
      const assetId = assetDoc.id;
      const assetData = assetDoc.data();
      const assetTitle = assetData.title || 'Untitled';
      
      // Check if this asset is a Preset (check storage path)
      const storagePath = assetData.storagePath || '';
      if (!storagePath.includes('/presets/')) {
        continue; // Skip LUTs, only process Presets
      }

      try {
        const presetsSnap = await adminDb
          .collection('assets')
          .doc(assetId)
          .collection('presets')
          .orderBy('fileName', 'asc')
          .get();

        presetsSnap.docs.forEach((doc: FirebaseFirestore.QueryDocumentSnapshot) => {
          const data = doc.data();
          allFiles.push({
            id: doc.id,
            assetId,
            assetTitle,
            fileName: data.fileName || '',
            storagePath: data.storagePath || '',
            fileType: data.fileType,
            relativePath: data.relativePath,
            beforeImagePath: data.beforeImagePath,
            beforeImageUrl: data.beforeImageUrl,
            afterImagePath: data.afterImagePath,
            afterImageUrl: data.afterImageUrl,
          });
        });
      } catch (error) {
        console.error(`Error loading presets for asset ${assetId}:`, error);
        // Continue with other assets even if one fails
      }
    }

    return NextResponse.json({ files: allFiles });
  } catch (error: unknown) {
    console.error('Error fetching preset files:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch preset files';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

