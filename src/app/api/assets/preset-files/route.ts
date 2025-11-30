import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminStorage } from '@/lib/firebaseAdmin';
import * as FirebaseFirestore from 'firebase-admin/firestore';

// GET /api/assets/preset-files?assetId=xxx
// Returns list of individual preset files for a preset asset pack
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

    // Get preset files from subcollection
    let presetFilesSnap;
    try {
      presetFilesSnap = await adminDb
        .collection('assets')
        .doc(assetId)
        .collection('presets')
        .orderBy('fileName', 'asc')
        .get();
    } catch (orderByError: any) {
      // If orderBy fails (missing index or field), try without ordering
      console.warn(`[Preset Files] orderBy failed for asset ${assetId}, fetching without order:`, orderByError?.message);
      presetFilesSnap = await adminDb
        .collection('assets')
        .doc(assetId)
        .collection('presets')
        .get();
    }

    let presetFiles = presetFilesSnap.docs.map((doc: FirebaseFirestore.QueryDocumentSnapshot) => ({
      id: doc.id,
      ...doc.data(),
    }));

    // Sort manually if orderBy failed
    presetFiles.sort((a: any, b: any) => {
      const nameA = (a.fileName || '').toLowerCase();
      const nameB = (b.fileName || '').toLowerCase();
      return nameA.localeCompare(nameB);
    });

    // Generate signed URLs for before/after images if they exist
    const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID || 'course-creator-academy-866d6';
    const bucket = adminStorage.bucket(`${projectId}.firebasestorage.app`);

    for (const preset of presetFiles) {
      if (preset.beforeImagePath && !preset.beforeImageUrl) {
        try {
          const expiresAt = new Date();
          expiresAt.setFullYear(expiresAt.getFullYear() + 10);
          const [url] = await bucket.file(preset.beforeImagePath).getSignedUrl({
            action: 'read',
            expires: expiresAt,
          });
          preset.beforeImageUrl = url;
        } catch (error) {
          console.error(`Failed to generate signed URL for ${preset.beforeImagePath}:`, error);
        }
      }

      if (preset.afterImagePath && !preset.afterImageUrl) {
        try {
          const expiresAt = new Date();
          expiresAt.setFullYear(expiresAt.getFullYear() + 10);
          const [url] = await bucket.file(preset.afterImagePath).getSignedUrl({
            action: 'read',
            expires: expiresAt,
          });
          preset.afterImageUrl = url;
        } catch (error) {
          console.error(`Failed to generate signed URL for ${preset.afterImagePath}:`, error);
        }
      }
    }

    return NextResponse.json({ presetFiles });
  } catch (err: any) {
    console.error('Error fetching preset files:', err);
    return NextResponse.json({ error: err?.message || 'Failed to fetch preset files' }, { status: 500 });
  }
}

export const runtime = 'nodejs';

