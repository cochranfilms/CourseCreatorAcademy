import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb, adminStorage } from '@/lib/firebaseAdmin';
import * as FirebaseFirestore from 'firebase-admin/firestore';
import * as path from 'path';

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

// PUT /api/admin/assets/update-preset-images
// Uploads before/after images for a preset and updates the document
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
    const presetId = formData.get('presetId') as string;
    const imageType = formData.get('imageType') as string; // 'before' or 'after'

    if (!file || !assetId || !presetId || !imageType) {
      return NextResponse.json(
        { error: 'Missing required fields: file, assetId, presetId, imageType' },
        { status: 400 }
      );
    }

    if (imageType !== 'before' && imageType !== 'after') {
      return NextResponse.json(
        { error: 'imageType must be "before" or "after"' },
        { status: 400 }
      );
    }

    // Get preset document to determine storage path
    const presetDoc = await adminDb
      .collection('assets')
      .doc(assetId)
      .collection('presets')
      .doc(presetId)
      .get();

    if (!presetDoc.exists) {
      return NextResponse.json({ error: 'Preset not found' }, { status: 404 });
    }

    const presetData = presetDoc.data();
    const storagePath = presetData?.storagePath || '';
    
    // Extract path structure from storage path
    // e.g., "assets/presets/Pack Name/Folder1/preset.xmp" -> need "Pack Name/Folder1/preset-before.png"
    const pathMatch = storagePath.match(/^assets\/presets\/(.+)$/);
    if (!pathMatch) {
      return NextResponse.json({ error: 'Invalid storage path format' }, { status: 400 });
    }
    
    const pathAfterPresets = pathMatch[1];
    const fileName = path.basename(storagePath);
    const dirName = path.dirname(pathAfterPresets);
    
    // Create storage path for image: assets/presets/{pack}/{folder}/{preset-name}-{before|after}.{ext}
    const presetName = fileName.replace(/\.[^/.]+$/, ''); // Remove extension
    const imageExt = path.extname(file.name) || '.png';
    const imageFileName = `${presetName}-${imageType}${imageExt}`;
    
    // Build the full path, preserving folder structure
    // If dirName is just the pack name (no subfolder), use it directly
    // If dirName includes subfolders, use the full path
    const imageStoragePath = `assets/presets/${dirName}/${imageFileName}`;

    // Upload image file
    const bucket = adminStorage.bucket();
    const imageFile = bucket.file(imageStoragePath);
    
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    await imageFile.save(buffer, {
      metadata: {
        contentType: file.type || 'image/png',
      },
    });

    // Generate signed URL
    const expiresAt = new Date();
    expiresAt.setFullYear(expiresAt.getFullYear() + 10);
    const [imageUrl] = await imageFile.getSignedUrl({
      action: 'read',
      expires: expiresAt,
    });

    // Update preset document
    const updateData: any = {
      updatedAt: FirebaseFirestore.FieldValue.serverTimestamp(),
    };

    if (imageType === 'before') {
      updateData.beforeImagePath = imageStoragePath;
      updateData.beforeImageUrl = imageUrl;
    } else {
      updateData.afterImagePath = imageStoragePath;
      updateData.afterImageUrl = imageUrl;
    }

    await adminDb
      .collection('assets')
      .doc(assetId)
      .collection('presets')
      .doc(presetId)
      .update(updateData);

    return NextResponse.json({
      success: true,
      storagePath: imageStoragePath,
      imageUrl,
    });
  } catch (error: unknown) {
    console.error('Error updating preset images:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to update preset images';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

