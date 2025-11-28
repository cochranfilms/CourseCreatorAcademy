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
    const { assetId, newStoragePath, targetCategory } = await req.json();

    if (!assetId || !newStoragePath || !targetCategory) {
      return NextResponse.json(
        { error: 'Missing assetId, newStoragePath, or targetCategory' },
        { status: 400 }
      );
    }

    // Get the asset document
    const assetRef = adminDb.collection('assets').doc(assetId);
    const assetDoc = await assetRef.get();

    if (!assetDoc.exists) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
    }

    const assetData = assetDoc.data();
    const oldStoragePath = assetData?.storagePath;

    if (!oldStoragePath) {
      return NextResponse.json({ error: 'Asset has no storage path' }, { status: 400 });
    }

    // Validate category change
    const oldCategory = oldStoragePath.includes('/overlays/') ? 'Overlays' :
                       oldStoragePath.includes('/transitions/') ? 'Transitions' :
                       oldStoragePath.includes('/sfx/') ? 'SFX' :
                       oldStoragePath.includes('/plugins/') ? 'Plugins' : null;

    if (oldCategory === targetCategory) {
      return NextResponse.json({ error: 'Asset is already in this category' }, { status: 400 });
    }

    // Only allow moving between compatible categories
    const validMoves = [
      ['Overlays', 'Transitions'],
      ['Transitions', 'Overlays'],
      ['SFX', 'Plugins'],
      ['Plugins', 'SFX'],
    ];

    const isValidMove = validMoves.some(
      ([from, to]) => (oldCategory === from && targetCategory === to) ||
                      (oldCategory === to && targetCategory === from)
    );

    if (!isValidMove) {
      return NextResponse.json(
        { error: `Cannot move from ${oldCategory} to ${targetCategory}` },
        { status: 400 }
      );
    }

    const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID || 'course-creator-academy-866d6';
    const bucket = adminStorage.bucket(`${projectId}.firebasestorage.app`);

    // Extract folder name from old path (e.g., "pack-name" from "assets/overlays/pack-name.zip")
    const oldZipFileName = oldStoragePath.split('/').pop() || '';
    const oldFolderName = oldZipFileName.replace(/\.zip$/i, '');
    const oldFolderPath = oldStoragePath.replace(`/${oldZipFileName}`, '');

    // Build new paths
    const newZipFileName = oldZipFileName;
    const newFolderPath = newStoragePath.replace(`/${newZipFileName}`, '');
    const newFolderName = oldFolderName; // Keep same folder name

    // Step 1: Move the ZIP file
    const oldZipFile = bucket.file(oldStoragePath);
    const newZipFile = bucket.file(newStoragePath);

    // Check if old file exists
    const [oldZipExists] = await oldZipFile.exists();
    if (oldZipExists) {
      // Copy to new location
      await oldZipFile.copy(newZipFile);
      // Delete old file
      await oldZipFile.delete();
    }

    // Step 2: Move all files in the folder (individual overlay/transition files, previews, thumbnails)
    const oldFolderPrefix = `${oldFolderPath}/${oldFolderName}/`;
    const newFolderPrefix = `${newFolderPath}/${newFolderName}/`;

    // List all files in the old folder
    const [files] = await bucket.getFiles({ prefix: oldFolderPrefix });

    for (const file of files) {
      const oldFilePath = file.name;
      const relativePath = oldFilePath.replace(oldFolderPrefix, '');
      const newFilePath = `${newFolderPrefix}${relativePath}`;

      // Copy file to new location
      const newFile = bucket.file(newFilePath);
      await file.copy(newFile);
      // Delete old file
      await file.delete();
    }

    // Step 3: Update asset document storagePath
    await assetRef.update({
      storagePath: newStoragePath,
      updatedAt: FirebaseFirestore.FieldValue.serverTimestamp(),
    });

    // Step 4: Update all overlay/transition documents in the subcollection
    const overlaysSnapshot = await assetRef.collection('overlays').get();
    const updatePromises = overlaysSnapshot.docs.map(async (doc) => {
      const overlayData = doc.data();
      const oldOverlayPath = overlayData.storagePath || '';
      const newOverlayPath = oldOverlayPath.replace(oldFolderPrefix, newFolderPrefix);

      const updates: any = {
        storagePath: newOverlayPath,
      };

      // Update previewStoragePath if it exists
      if (overlayData.previewStoragePath) {
        const oldPreviewPath = overlayData.previewStoragePath;
        const newPreviewPath = oldPreviewPath.replace(oldFolderPrefix, newFolderPrefix);
        updates.previewStoragePath = newPreviewPath;
      }

      return doc.ref.update(updates);
    });

    await Promise.all(updatePromises);

    // Step 5: Update sound effects if this is an SFX/Plugins asset
    const soundEffectsSnapshot = await assetRef.collection('soundEffects').get();
    const sfxUpdatePromises = soundEffectsSnapshot.docs.map(async (doc) => {
      const sfxData = doc.data();
      const oldSfxPath = sfxData.storagePath || '';
      const newSfxPath = oldSfxPath.replace(oldFolderPrefix, newFolderPrefix);

      return doc.ref.update({
        storagePath: newSfxPath,
      });
    });

    await Promise.all(sfxUpdatePromises);

    return NextResponse.json({
      success: true,
      message: `Asset moved from ${oldCategory} to ${targetCategory}`,
      oldPath: oldStoragePath,
      newPath: newStoragePath,
    });
  } catch (error: any) {
    console.error('Error updating asset category:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update asset category' },
      { status: 500 }
    );
  }
}

