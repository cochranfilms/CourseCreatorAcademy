import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminStorage } from '@/lib/firebaseAdmin';

// GET /api/assets/overlay-video-proxy?assetId=xxx&overlayId=xxx
// Streams the video file for playback (not download)
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
    const fileName = overlayData?.fileName || 'video';
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
    
    // Get file metadata
    const [metadata] = await file.getMetadata();
    
    // Determine content type based on file extension
    const contentTypeMap: { [key: string]: string } = {
      'mov': 'video/quicktime',
      'mp4': 'video/mp4',
      'avi': 'video/x-msvideo',
      'mkv': 'video/x-matroska',
      'webm': 'video/webm',
      'm4v': 'video/x-m4v',
    };
    
    const contentType = metadata.contentType || contentTypeMap[fileType.toLowerCase()] || 'video/mp4';
    
    // Get range header for video streaming support
    const range = req.headers.get('range');
    
    if (range) {
      // Handle range requests for video seeking
      const [start, end] = range.replace(/bytes=/, '').split('-').map(Number);
      const fileSize = parseInt(metadata.size || '0');
      const chunkSize = (end || fileSize - 1) - start + 1;
      
      const stream = file.createReadStream({ start, end: end || fileSize - 1 });
      
      return new NextResponse(stream as any, {
        status: 206,
        headers: {
          'Content-Range': `bytes ${start}-${end || fileSize - 1}/${fileSize}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': chunkSize.toString(),
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=3600',
        },
      });
    } else {
      // Stream entire file
      const stream = file.createReadStream();
      
      return new NextResponse(stream as any, {
        headers: {
          'Content-Type': contentType,
          'Accept-Ranges': 'bytes',
          'Cache-Control': 'public, max-age=3600',
        },
      });
    }
  } catch (err: any) {
    console.error('Error proxying video:', err);
    return NextResponse.json({ error: err?.message || 'Failed to proxy video' }, { status: 500 });
  }
}

export const runtime = 'nodejs';

