import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb, adminStorage } from '@/lib/firebaseAdmin';
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

// POST /api/admin/assets/update-lut-videos
// Updates beforeVideoPath and/or afterVideoPath for a LUT preview
export async function POST(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!adminDb || !adminStorage) {
    return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
  }

  try {
    const { assetId, lutPreviewId, beforeVideoPath, afterVideoPath } = await req.json();

    if (!assetId || !lutPreviewId) {
      return NextResponse.json(
        { error: 'Missing assetId or lutPreviewId' },
        { status: 400 }
      );
    }

    if (!beforeVideoPath && !afterVideoPath) {
      return NextResponse.json(
        { error: 'Must provide at least one of beforeVideoPath or afterVideoPath' },
        { status: 400 }
      );
    }

    // Get the LUT preview document
    const lutPreviewRef = adminDb
      .collection('assets')
      .doc(assetId)
      .collection('lutPreviews')
      .doc(lutPreviewId);
    
    const lutPreviewDoc = await lutPreviewRef.get();

    if (!lutPreviewDoc.exists) {
      return NextResponse.json({ error: 'LUT preview not found' }, { status: 404 });
    }

    // Update Firestore document
    const updates: Record<string, string> = {};
    if (beforeVideoPath) {
      updates.beforeVideoPath = beforeVideoPath;
    }
    if (afterVideoPath) {
      updates.afterVideoPath = afterVideoPath;
    }

    await lutPreviewRef.update({
      ...updates,
      updatedAt: FirebaseFirestore.FieldValue.serverTimestamp(),
    });

    return NextResponse.json({
      success: true,
      message: 'LUT videos updated successfully',
      beforeVideoPath: beforeVideoPath || lutPreviewDoc.data()?.beforeVideoPath,
      afterVideoPath: afterVideoPath || lutPreviewDoc.data()?.afterVideoPath,
    });
  } catch (error: unknown) {
    console.error('Error updating LUT videos:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to update LUT videos';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

// PUT /api/admin/assets/update-lut-videos
// Uploads a video file and returns the storage path
export async function PUT(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!adminDb || !adminStorage) {
    return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const assetId = formData.get('assetId') as string;
    const lutPreviewId = formData.get('lutPreviewId') as string;
    const videoType = formData.get('videoType') as string; // 'before' or 'after'

    if (!file || !assetId || !lutPreviewId || !videoType) {
      return NextResponse.json(
        { error: 'Missing required fields: file, assetId, lutPreviewId, videoType' },
        { status: 400 }
      );
    }

    if (videoType !== 'before' && videoType !== 'after') {
      return NextResponse.json(
        { error: 'videoType must be "before" or "after"' },
        { status: 400 }
      );
    }

    // Get LUT preview to determine pack name
    const lutPreviewDoc = await adminDb
      .collection('assets')
      .doc(assetId)
      .collection('lutPreviews')
      .doc(lutPreviewId)
      .get();

    if (!lutPreviewDoc.exists) {
      return NextResponse.json({ error: 'LUT preview not found' }, { status: 404 });
    }

    const lutPreviewData = lutPreviewDoc.data();
    const assetDoc = await adminDb.collection('assets').doc(assetId).get();
    const assetData = assetDoc.data();
    
    // Extract pack name from storagePath (e.g., "assets/luts/Pack Name.zip" -> "Pack Name")
    const storagePath = assetData?.storagePath || '';
    const packName = storagePath
      .replace(/^assets\/luts\//, '')
      .replace(/\.zip$/, '')
      .trim() || 'Unknown Pack';
    
    const lutName = lutPreviewData?.lutName || 'unknown';
    
    // Create storage path: assets/luts/{packName}/{lutName}-{before|after}.mp4
    // Sanitize lutName for filename
    const sanitizedLutName = lutName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const fileName = `${sanitizedLutName}-${videoType}.mp4`;
    const videoStoragePath = `assets/luts/${packName}/${fileName}`;

    // Upload file using Admin SDK
    const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID || 'course-creator-academy-866d6';
    const bucket = adminStorage.bucket(`${projectId}.firebasestorage.app`);
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    
    const bucketFile = bucket.file(videoStoragePath);
    await bucketFile.save(fileBuffer, {
      metadata: {
        contentType: file.type || 'video/mp4',
      },
    });

    return NextResponse.json({
      success: true,
      storagePath: videoStoragePath,
    });
  } catch (error: unknown) {
    console.error('Error uploading LUT video:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to upload video';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

export const runtime = 'nodejs';

