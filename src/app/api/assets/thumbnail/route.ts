import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminStorage } from '@/lib/firebaseAdmin';

// GET /api/assets/thumbnail?assetId=xxx
// Returns a signed URL for the asset thumbnail image
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

    // Get asset document from Firestore
    const assetDoc = await adminDb.collection('assets').doc(assetId).get();
    if (!assetDoc.exists) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
    }

    const assetData = assetDoc.data();
    
    // If thumbnailUrl is already set and is a direct URL, return it
    if (assetData?.thumbnailUrl && assetData.thumbnailUrl.startsWith('https://')) {
      return NextResponse.json({ thumbnailUrl: assetData.thumbnailUrl });
    }

    // Otherwise, try to generate from storage path
    const storagePath = assetData?.storagePath;
    if (!storagePath) {
      return NextResponse.json({ error: 'Asset has no storage path' }, { status: 400 });
    }

    // Generate thumbnail path from storage path
    // e.g., "assets/luts/sleektone-minimal-luts.zip" -> "assets/luts/sleektone-minimal-luts/preview.png"
    const zipFileName = storagePath.split('/').pop()?.replace('.zip', '') || '';
    const folderPath = storagePath.replace(`/${zipFileName}.zip`, '');
    const thumbnailPath = `${folderPath}/${zipFileName}/preview.png`;

    const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID || 'course-creator-academy-866d6';
    const bucketName = `${projectId}.firebasestorage.app`;
    const bucket = adminStorage.bucket(bucketName);
    const file = bucket.file(thumbnailPath);
    
    // Check if file exists
    const [exists] = await file.exists();
    if (!exists) {
      return NextResponse.json({ 
        error: 'Thumbnail not found',
        details: `Path: ${thumbnailPath}`
      }, { status: 404 });
    }
    
    // Generate signed URL (valid for 1 year for thumbnails)
    const expiresAt = new Date();
    expiresAt.setFullYear(expiresAt.getFullYear() + 1);
    
    try {
      const [signedUrl] = await file.getSignedUrl({
        action: 'read',
        expires: expiresAt,
      });

      return NextResponse.json({ thumbnailUrl: signedUrl });
    } catch (signError: any) {
      console.error('Error generating thumbnail URL:', signError);
      throw signError;
    }
  } catch (err: any) {
    console.error('Error generating thumbnail URL:', err);
    return NextResponse.json({ error: err?.message || 'Failed to generate thumbnail URL' }, { status: 500 });
  }
}

export const runtime = 'nodejs';

