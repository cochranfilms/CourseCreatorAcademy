import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminStorage } from '@/lib/firebaseAdmin';

// GET /api/assets/lut-download?assetId=xxx&previewId=xxx
// Returns a signed download URL for an individual LUT .cube file
export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const assetId = searchParams.get('assetId');
    const previewId = searchParams.get('previewId');

    if (!assetId || !previewId) {
      return NextResponse.json({ error: 'assetId and previewId are required' }, { status: 400 });
    }

    if (!adminDb || !adminStorage) {
      return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
    }

    // Get LUT preview document
    const previewDoc = await adminDb
      .collection('assets')
      .doc(assetId)
      .collection('lutPreviews')
      .doc(previewId)
      .get();

    if (!previewDoc.exists) {
      return NextResponse.json({ error: 'LUT preview not found' }, { status: 404 });
    }

    const previewData = previewDoc.data();
    const lutFilePath = previewData?.lutFilePath;
    const fileName = previewData?.fileName || 'lut.cube';

    console.log('[LUT Download API] Preview data:', {
      previewId,
      assetId,
      lutFilePath,
      fileName,
    });

    if (!lutFilePath) {
      console.log('[LUT Download API] No lutFilePath found in preview document');
      // Fallback to full pack download if no individual file
      return NextResponse.json({ 
        error: 'Individual LUT file not available, use pack download',
        fallback: true 
      }, { status: 404 });
    }

    // Get file from Firebase Storage
    const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID || 'course-creator-academy-866d6';
    const bucketName = `${projectId}.firebasestorage.app`;
    const bucket = adminStorage.bucket(bucketName);
    const file = bucket.file(lutFilePath);
    
    // Check if file exists
    const [exists] = await file.exists();
    console.log('[LUT Download API] File exists check:', { exists, path: lutFilePath });
    
    if (!exists) {
      console.error('[LUT Download API] File not found in storage:', lutFilePath);
      return NextResponse.json({ 
        error: 'LUT file not found in storage',
        details: `Path: ${lutFilePath}`
      }, { status: 404 });
    }
    
    // Generate signed URL (valid for 1 hour)
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1);
    
    const [downloadUrl] = await file.getSignedUrl({
      action: 'read',
      expires: expiresAt,
    });

    console.log('[LUT Download API] Generated download URL successfully');

    return NextResponse.json({ 
      downloadUrl,
      fileName,
    });
  } catch (err: any) {
    console.error('Error fetching LUT download:', err);
    return NextResponse.json({ error: err?.message || 'Failed to get download URL' }, { status: 500 });
  }
}

export const runtime = 'nodejs';

