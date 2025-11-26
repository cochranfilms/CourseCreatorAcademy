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
    
    // Get file metadata
    const [metadata] = await file.getMetadata();
    const fileSize = parseInt(metadata.size || '0');
    
    // Determine content type
    const contentTypeMap: { [key: string]: string } = {
      'mov': 'video/quicktime',
      'mp4': 'video/mp4',
      'avi': 'video/x-msvideo',
      'mkv': 'video/x-matroska',
      'webm': 'video/webm',
      'm4v': 'video/x-m4v',
    };
    
    const contentType = metadata.contentType || contentTypeMap[fileType.toLowerCase()] || 'video/mp4';
    
    // Handle range requests for video seeking
    const range = req.headers.get('range');
    
    if (range) {
      const rangeMatch = range.match(/bytes=(\d+)-(\d*)/);
      if (!rangeMatch) {
        return new NextResponse(null, {
          status: 416,
          headers: {
            'Content-Range': `bytes */${fileSize}`,
          },
        });
      }
      
      const start = parseInt(rangeMatch[1], 10);
      const end = rangeMatch[2] ? parseInt(rangeMatch[2], 10) : fileSize - 1;
      const chunkSize = end - start + 1;
      
      // Create read stream for the range
      const stream = file.createReadStream({ start, end });
      
      // Convert Node stream to Web ReadableStream
      const webStream = new ReadableStream({
        start(controller) {
          stream.on('data', (chunk: Buffer) => {
            controller.enqueue(new Uint8Array(chunk));
          });
          stream.on('end', () => {
            controller.close();
          });
          stream.on('error', (err: Error) => {
            controller.error(err);
          });
        },
        cancel() {
          stream.destroy();
        },
      });
      
      return new NextResponse(webStream, {
        status: 206,
        headers: {
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': chunkSize.toString(),
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=3600',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
          'Access-Control-Allow-Headers': 'Range',
        },
      });
    } else {
      // Stream entire file
      const stream = file.createReadStream();
      
      // Convert Node stream to Web ReadableStream
      const webStream = new ReadableStream({
        start(controller) {
          stream.on('data', (chunk: Buffer) => {
            controller.enqueue(new Uint8Array(chunk));
          });
          stream.on('end', () => {
            controller.close();
          });
          stream.on('error', (err: Error) => {
            controller.error(err);
          });
        },
        cancel() {
          stream.destroy();
        },
      });
      
      return new NextResponse(webStream, {
        headers: {
          'Content-Type': contentType,
          'Accept-Ranges': 'bytes',
          'Content-Length': fileSize.toString(),
          'Cache-Control': 'public, max-age=3600',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
          'Access-Control-Allow-Headers': 'Range',
        },
      });
    }
  } catch (err: any) {
    console.error('Error proxying video:', err);
    return NextResponse.json({ error: err?.message || 'Failed to proxy video' }, { status: 500 });
  }
}

export const runtime = 'nodejs';

