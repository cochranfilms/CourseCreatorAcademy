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

export async function POST(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!adminDb || !adminStorage) {
    return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
  }

  try {
    const { assetId, overlayId, targetCategory } = await req.json();

    if (!assetId || !overlayId || !targetCategory) {
      return NextResponse.json(
        { error: 'Missing assetId, overlayId, or targetCategory' },
        { status: 400 }
      );
    }

    // Only allow Overlays and Transitions
    if (targetCategory !== 'Overlays' && targetCategory !== 'Transitions') {
      return NextResponse.json(
        { error: 'targetCategory must be "Overlays" or "Transitions"' },
        { status: 400 }
      );
    }

    // Get the overlay document
    const overlayRef = adminDb
      .collection('assets')
      .doc(assetId)
      .collection('overlays')
      .doc(overlayId);
    
    const overlayDoc = await overlayRef.get();

    if (!overlayDoc.exists) {
      return NextResponse.json({ error: 'Overlay file not found' }, { status: 404 });
    }

    const overlayData = overlayDoc.data();
    const oldStoragePath = overlayData?.storagePath;

    if (!oldStoragePath) {
      return NextResponse.json({ error: 'Overlay file has no storage path' }, { status: 400 });
    }

    // Determine current category
    const oldCategory = oldStoragePath.includes('/overlays/') ? 'Overlays' :
                       oldStoragePath.includes('/transitions/') ? 'Transitions' : null;

    if (!oldCategory) {
      return NextResponse.json(
        { error: 'Could not determine current category from storage path' },
        { status: 400 }
      );
    }

    if (oldCategory === targetCategory) {
      return NextResponse.json(
        { error: 'File is already in this category' },
        { status: 400 }
      );
    }

    // Build new storage path
    const newStoragePath = oldStoragePath.replace(
      oldCategory === 'Overlays' ? '/overlays/' : '/transitions/',
      targetCategory === 'Overlays' ? '/overlays/' : '/transitions/'
    );

    const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID || 'course-creator-academy-866d6';
    const bucket = adminStorage.bucket(`${projectId}.firebasestorage.app`);

    // Step 1: Move the main file
    const oldFile = bucket.file(oldStoragePath);
    const newFile = bucket.file(newStoragePath);

    const [oldFileExists] = await oldFile.exists();
    if (oldFileExists) {
      // Copy to new location
      await oldFile.copy(newFile);
      // Delete old file
      await oldFile.delete();
    }

    // Step 2: Move preview file if it exists
    let newPreviewPath: string | undefined;
    if (overlayData.previewStoragePath) {
      const oldPreviewPath = overlayData.previewStoragePath;
      newPreviewPath = oldPreviewPath.replace(
        oldCategory === 'Overlays' ? '/overlays/' : '/transitions/',
        targetCategory === 'Overlays' ? '/overlays/' : '/transitions/'
      );

      const oldPreviewFile = bucket.file(oldPreviewPath);
      const newPreviewFile = bucket.file(newPreviewPath);

      const [oldPreviewExists] = await oldPreviewFile.exists();
      if (oldPreviewExists) {
        // Copy to new location
        await oldPreviewFile.copy(newPreviewFile);
        // Delete old file
        await oldPreviewFile.delete();
      }
    }

    // Step 3: Update Firestore document
    const updates: Record<string, string> = {
      storagePath: newStoragePath,
    };

    if (newPreviewPath) {
      updates.previewStoragePath = newPreviewPath;
    }

    await overlayRef.update({
      ...updates,
      updatedAt: FirebaseFirestore.FieldValue.serverTimestamp(),
    });

    return NextResponse.json({
      success: true,
      message: `File moved from ${oldCategory} to ${targetCategory}`,
      oldPath: oldStoragePath,
      newPath: newStoragePath,
      oldPreviewPath: overlayData.previewStoragePath,
      newPreviewPath,
    });
  } catch (error: unknown) {
    console.error('Error updating overlay category:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to update overlay category';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

