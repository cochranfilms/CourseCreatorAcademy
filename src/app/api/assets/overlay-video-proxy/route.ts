import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminStorage } from '@/lib/firebaseAdmin';

// GET /api/assets/overlay-video-proxy?assetId=xxx&overlayId=xxx
// Streams video file with proper range request support for video playback
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
    const fileType = overlayData?.fileType || 'mov';

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
    
    // Since overlay files are public, construct the public Firebase Storage URL
    // Format: https://firebasestorage.googleapis.com/v0/b/{bucket}/o/{encodedPath}?alt=media
    const encodedPath = encodeURIComponent(storagePath).replace(/%2F/g, '/');
    const publicUrl = `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodedPath}?alt=media`;
    
    // Return the public URL - Firebase Storage handles CORS and range requests
    return NextResponse.json({ videoUrl: publicUrl });
  } catch (err: any) {
    console.error('Error proxying video:', err);
    return NextResponse.json({ error: err?.message || 'Failed to proxy video' }, { status: 500 });
  }
}

export const runtime = 'nodejs';

