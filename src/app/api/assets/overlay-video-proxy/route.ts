import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminStorage } from '@/lib/firebaseAdmin';

// GET /api/assets/overlay-video-proxy?assetId=xxx&overlayId=xxx
// Returns a signed URL for video playback (with proper CORS headers)
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

    // Get overlay document
    const overlayDoc = await adminDb
      .collection('assets')
      .doc(assetId)
      .collection('overlays')
      .doc(overlayId)
      .get();

    if (!overlayDoc.exists) {
      return NextResponse.json({ error: 'Overlay not found' }, { status: 404 });
    }

    const overlayData = overlayDoc.data();
    const storagePath = overlayData?.storagePath;

    if (!storagePath) {
      return NextResponse.json({ error: 'Overlay has no storage path' }, { status: 400 });
    }

    // Get file from Firebase Storage
    const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID || 'course-creator-academy-866d6';
    const bucketName = `${projectId}.firebasestorage.app`;
    const bucket = adminStorage.bucket(bucketName);
    const file = bucket.file(storagePath);
    
    // Check if file exists
    const [exists] = await file.exists();
    if (!exists) {
      console.error(`File not found at path: ${storagePath}`);
      return NextResponse.json({ 
        error: 'File not found in storage',
        details: `Path: ${storagePath}`
      }, { status: 404 });
    }
    
    // Generate signed URL for video playback (valid for 1 hour)
    // Use responseType: 'stream' to allow video playback
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1);
    
    try {
      const [signedUrl] = await file.getSignedUrl({
        action: 'read',
        expires: expiresAt,
        version: 'v4',
      });

      // Return the signed URL - Firebase Storage handles CORS if configured
      return NextResponse.json({ videoUrl: signedUrl });
    } catch (signError: any) {
      console.error('Error generating signed URL:', signError);
      throw signError;
    }
  } catch (err: any) {
    console.error('Error getting video URL:', err);
    return NextResponse.json({ error: err?.message || 'Failed to get video URL' }, { status: 500 });
  }
}

export const runtime = 'nodejs';

