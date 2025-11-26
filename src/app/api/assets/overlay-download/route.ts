import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminStorage } from '@/lib/firebaseAdmin';

// GET /api/assets/overlay-download?assetId=xxx&overlayId=xxx
// Returns a signed download URL for an individual overlay
export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const assetId = searchParams.get('assetId');
    const overlayId = searchParams.get('overlayId');

    if (!assetId || !overlayId) {
      return NextResponse.json({ error: 'assetId and overlayId are required' }, { status: 400 });
    }

    if (!adminDb || !adminStorage) {
      return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
    }

    // Get overlay document (try subcollection first, then flat collection)
    let overlayDoc = await adminDb
      .collection('assets')
      .doc(assetId)
      .collection('overlays')
      .doc(overlayId)
      .get();

    if (!overlayDoc.exists) {
      // Try flat overlays collection
      overlayDoc = await adminDb
        .collection('overlays')
        .doc(overlayId)
        .get();
    }

    // If still not found, try finding by storagePath if provided as query param
    const storagePathParam = searchParams.get('storagePath');
    if (!overlayDoc.exists && storagePathParam) {
      const foundByPath = await adminDb
        .collection('overlays')
        .where('storagePath', '==', storagePathParam)
        .limit(1)
        .get();
      
      if (!foundByPath.empty) {
        overlayDoc = foundByPath.docs[0];
      }
    }

    if (!overlayDoc.exists) {
      console.error(`Overlay not found: assetId=${assetId}, overlayId=${overlayId}, storagePath=${storagePathParam || 'not provided'}`);
      return NextResponse.json({ error: 'Overlay not found' }, { status: 404 });
    }

    const overlayData = overlayDoc.data();
    // Use storagePath for download (not previewStoragePath which is for 720p preview)
    const storagePath = overlayData?.storagePath;

    if (!storagePath) {
      return NextResponse.json({ error: 'Overlay has no storage path' }, { status: 400 });
    }

    // Get signed URL from Firebase Storage
    const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID || 'course-creator-academy-866d6';
    const bucketName = `${projectId}.firebasestorage.app`;
    const bucket = adminStorage.bucket(bucketName);
    const file = bucket.file(storagePath);
    
    // Check if file exists
    const [exists] = await file.exists();
    if (!exists) {
      console.error(`File not found at path: ${storagePath}`);
      console.error(`Overlay data:`, {
        assetId,
        overlayId,
        storagePath,
        previewStoragePath: overlayData?.previewStoragePath,
        fileName: overlayData?.fileName
      });
      
      // If storagePath doesn't exist but previewStoragePath does, that's a data issue
      if (overlayData?.previewStoragePath && !overlayData?.previewStoragePath.includes('_720p')) {
        console.warn('Warning: previewStoragePath exists but storagePath file not found');
      }
      
      return NextResponse.json({ 
        error: 'File not found in storage',
        details: `Path: ${storagePath}`
      }, { status: 404 });
    }
    
    // Generate signed URL (valid for 1 hour)
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1);
    
    try {
      const [signedUrl] = await file.getSignedUrl({
        action: 'read',
        expires: expiresAt,
      });

      return NextResponse.json({ downloadUrl: signedUrl });
    } catch (signError: any) {
      console.error('Error generating signed URL:', signError);
      throw signError;
    }
  } catch (err: any) {
    console.error('Error generating download URL:', err);
    return NextResponse.json({ error: err?.message || 'Failed to generate download URL' }, { status: 500 });
  }
}

export const runtime = 'nodejs';

