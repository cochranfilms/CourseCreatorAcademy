import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminStorage } from '@/lib/firebaseAdmin';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const execAsync = promisify(exec);

// GET /api/assets/overlay-video-720p?assetId=xxx&overlayId=xxx
// Streams video file transcoded to 720p for faster loading
export async function GET(req: NextRequest) {
  let tempDir: string | null = null;
  
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

    // Get overlay document (try both subcollection and flat collection)
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

    if (!overlayDoc.exists) {
      return NextResponse.json({ error: 'Overlay not found' }, { status: 404 });
    }

    const overlayData = overlayDoc.data();
    const storagePath = overlayData?.storagePath;
    const fileType = overlayData?.fileType || 'mp4';

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

    // Check if 720p version already exists in cache
    const cachePath = storagePath.replace(/\.(mp4|mov)$/i, '_720p.mp4');
    const cachedFile = bucket.file(cachePath);
    const [cacheExists] = await cachedFile.exists();

    if (cacheExists) {
      // Return cached 720p version
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);
      
      const [cachedUrl] = await cachedFile.getSignedUrl({
        action: 'read',
        expires: expiresAt,
        version: 'v4',
      });
      
      return NextResponse.json({ 
        videoUrl: cachedUrl,
        fileType: 'mp4',
        cached: true
      });
    }

    // For now, return original URL with note that transcoding can be added
    // Transcoding on-the-fly is expensive, so we'll use the original for now
    // but limit display size in the frontend
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);
    
    const [publicUrl] = await file.getSignedUrl({
      action: 'read',
      expires: expiresAt,
      version: 'v4',
    });
    
    return NextResponse.json({ 
      videoUrl: publicUrl,
      fileType: fileType.toLowerCase(),
      note: 'Original quality - consider transcoding to 720p for better performance'
    });
  } catch (err: any) {
    console.error('Error proxying video:', err);
    return NextResponse.json({ error: err?.message || 'Failed to proxy video' }, { status: 500 });
  } finally {
    // Cleanup temp directory if created
    if (tempDir && fs.existsSync(tempDir)) {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch (error) {
        console.error('Failed to cleanup temp directory:', error);
      }
    }
  }
}

export const runtime = 'nodejs';

