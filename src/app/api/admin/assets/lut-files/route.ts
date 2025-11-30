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

// GET /api/admin/assets/lut-files
// Returns all individual LUT preview files from all assets
export async function GET(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!adminDb) {
    return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
  }

  try {
    // Get all assets in LUTs & Presets category
    const lutAssetsSnap = await adminDb
      .collection('assets')
      .where('category', '==', 'LUTs & Presets')
      .get();

    const allLUTs: Array<{
      id: string;
      assetId: string;
      assetTitle: string;
      lutName: string;
      beforeVideoPath?: string;
      afterVideoPath?: string;
      lutFilePath?: string;
      fileName?: string;
    }> = [];

    // Fetch LUT previews from each asset's subcollection
    for (const assetDoc of lutAssetsSnap.docs) {
      const assetId = assetDoc.id;
      const assetData = assetDoc.data();
      const assetTitle = assetData.title || 'Untitled';

      try {
        const lutPreviewsSnap = await adminDb
          .collection('assets')
          .doc(assetId)
          .collection('lutPreviews')
          .orderBy('lutName', 'asc')
          .get();

        lutPreviewsSnap.docs.forEach((doc: FirebaseFirestore.QueryDocumentSnapshot) => {
          const data = doc.data();
          allLUTs.push({
            id: doc.id,
            assetId,
            assetTitle,
            lutName: data.lutName || '',
            beforeVideoPath: data.beforeVideoPath,
            afterVideoPath: data.afterVideoPath,
            lutFilePath: data.lutFilePath,
            fileName: data.fileName,
          });
        });
      } catch (error) {
        // If orderBy fails, try without ordering
        try {
          const lutPreviewsSnap = await adminDb
            .collection('assets')
            .doc(assetId)
            .collection('lutPreviews')
            .get();

          const previews = lutPreviewsSnap.docs.map((doc: FirebaseFirestore.QueryDocumentSnapshot) => {
            const data = doc.data();
            return {
              id: doc.id,
              assetId,
              assetTitle,
              lutName: data.lutName || '',
              beforeVideoPath: data.beforeVideoPath,
              afterVideoPath: data.afterVideoPath,
              lutFilePath: data.lutFilePath,
              fileName: data.fileName,
            };
          });

          // Sort manually
          previews.sort((a, b) => {
            const nameA = (a.lutName || '').toLowerCase();
            const nameB = (b.lutName || '').toLowerCase();
            return nameA.localeCompare(nameB);
          });

          allLUTs.push(...previews);
        } catch (fallbackError) {
          console.error(`Error loading LUT previews for asset ${assetId}:`, fallbackError);
          // Continue with other assets even if one fails
        }
      }
    }

    return NextResponse.json({ luts: allLUTs });
  } catch (error: unknown) {
    console.error('Error fetching LUT files:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch LUT files';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

export const runtime = 'nodejs';

