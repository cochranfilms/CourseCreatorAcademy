#!/usr/bin/env node
/*
  Update Firestore documents to use existing 720p transcoded versions
  
  This script:
  1. Finds all overlay documents
  2. Checks if a 720p version exists in Storage (storagePath with _720p.mp4)
  3. Updates Firestore to use the 720p version for previews
  
  Usage:
    node scripts/update-overlays-to-720p.js [--assetId=xxx] [--all] [--dry-run]
*/

// Load env from .env.local first, then fallback to .env
try {
  require('dotenv').config({ path: '.env.local' });
} catch {}
require('dotenv').config();

const admin = require('firebase-admin');

// Initialize Firebase Admin
if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
        clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      }),
      storageBucket: `${process.env.FIREBASE_ADMIN_PROJECT_ID}.firebasestorage.app`,
    });
  } catch (error) {
    console.error('Failed to initialize Firebase Admin:', error);
    process.exit(1);
  }
}

const db = admin.firestore();
const storage = admin.storage();
const bucket = storage.bucket();

function getArg(name, def) {
  const arg = process.argv.find(a => a.startsWith(`--${name}=`));
  return arg ? arg.split('=')[1] : def;
}

function hasFlag(flag) {
  return process.argv.includes(`--${flag}`);
}

/**
 * Check if 720p version exists in Storage
 */
async function check720pExists(storagePath) {
  const cachePath = storagePath.replace(/\.(mp4|mov|avi|mkv|webm|m4v)$/i, '_720p.mp4');
  const cachedFile = bucket.file(cachePath);
  const [exists] = await cachedFile.exists();
  return exists ? cachePath : null;
}

/**
 * Update a single overlay document
 */
async function updateOverlay(overlayDoc, assetId, dryRun = false) {
  const overlayId = overlayDoc.id;
  const overlayData = overlayDoc.data();
  let storagePath = overlayData?.storagePath;

  if (!storagePath) {
    return { success: false, reason: 'no_storage_path' };
  }

  // If storagePath points to .mov, check for .mp4 version
  if (storagePath.toLowerCase().endsWith('.mov')) {
    const mp4Path = storagePath.replace(/\.mov$/i, '.mp4');
    const mp4File = bucket.file(mp4Path);
    const [mp4Exists] = await mp4File.exists();
    if (mp4Exists) {
      storagePath = mp4Path; // Use .mp4 version for checking 720p
    }
  }

  // Check if it's a video file
  const videoExtensions = ['.mp4', '.mov', '.avi', '.mkv', '.webm', '.m4v'];
  const isVideo = videoExtensions.some(ext => storagePath.toLowerCase().endsWith(ext));
  
  if (!isVideo) {
    return { success: false, reason: 'not_video' };
  }

  // Check if 720p version exists
  const previewPath = await check720pExists(storagePath);
  
  if (!previewPath) {
    return { success: false, reason: 'no_720p_version' };
  }

  // Check if already updated
  if (overlayData.previewStoragePath === previewPath) {
    return { success: true, reason: 'already_updated' };
  }

  console.log(`  Updating ${overlayData.fileName || overlayId}`);
  console.log(`    Original: ${storagePath}`);
  console.log(`    720p: ${previewPath}`);

  if (dryRun) {
    console.log(`    [DRY RUN] Would update Firestore`);
    return { success: true, reason: 'dry_run' };
  }

  try {
    // Try subcollection first
    const subcollectionDoc = await db
      .collection('assets')
      .doc(assetId)
      .collection('overlays')
      .doc(overlayId)
      .get();
    
    if (subcollectionDoc.exists) {
      const currentData = subcollectionDoc.data();
      // Only update if previewStoragePath is missing or different
      if (currentData.previewStoragePath !== previewPath) {
        await db
          .collection('assets')
          .doc(assetId)
          .collection('overlays')
          .doc(overlayId)
          .update({
            previewStoragePath: previewPath,
            transcoded720p: true,
            transcodedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        console.log(`    ✓ Updated Firestore subcollection document`);
      } else {
        console.log(`    ⏭ Already has correct previewStoragePath`);
      }
      return { success: true };
    } else {
      // Try flat overlays collection
      const flatDoc = await db.collection('overlays').doc(overlayId).get();
      if (flatDoc.exists) {
        const currentData = flatDoc.data();
        // Only update if previewStoragePath is missing or different
        if (currentData.previewStoragePath !== previewPath) {
          await db.collection('overlays').doc(overlayId).update({
            previewStoragePath: previewPath,
            transcoded720p: true,
            transcodedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
          console.log(`    ✓ Updated Firestore overlays collection document`);
        } else {
          console.log(`    ⏭ Already has correct previewStoragePath`);
        }
        return { success: true };
      } else {
        // Try finding by storagePath instead of overlayId
        const foundByPath = await db
          .collection('overlays')
          .where('assetId', '==', assetId)
          .where('storagePath', '==', storagePath)
          .get();
        
        if (!foundByPath.empty) {
          const doc = foundByPath.docs[0];
          const currentData = doc.data();
          if (currentData.previewStoragePath !== previewPath) {
            await db.collection('overlays').doc(doc.id).update({
              previewStoragePath: previewPath,
              transcoded720p: true,
              transcodedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            console.log(`    ✓ Updated Firestore overlays collection document (found by storagePath)`);
          } else {
            console.log(`    ⏭ Already has correct previewStoragePath`);
          }
          return { success: true };
        }
        
        console.log(`    ⚠ Document not found in any location`);
        return { success: false, reason: 'doc_not_found' };
      }
    }
  } catch (error) {
    console.error(`    ✗ Error updating: ${error.message}`);
    return { success: false, reason: 'error', error: error.message };
  }
}

/**
 * Main function
 */
async function main() {
  console.log('=== Update Firestore to Use 720p Versions ===\n');

  const assetId = getArg('assetId', null);
  const all = hasFlag('all');
  const dryRun = hasFlag('dry-run');

  if (dryRun) {
    console.log('⚠ DRY RUN MODE - No changes will be made\n');
  }

  if (!assetId && !all) {
    console.error('Error: Must provide --assetId=xxx or --all');
    console.error('\nUsage:');
    console.error('  node scripts/update-overlays-to-720p.js --all');
    console.error('  node scripts/update-overlays-to-720p.js --assetId=xxx');
    console.error('  node scripts/update-overlays-to-720p.js --all --dry-run');
    process.exit(1);
  }

  const results = {
    total: 0,
    updated: 0,
    skipped: 0,
    failed: 0,
    errors: [],
  };

  try {
    if (assetId) {
      // Update all overlays for a specific asset
      let overlayDocs = await db
        .collection('assets')
        .doc(assetId)
        .collection('overlays')
        .get();

      if (overlayDocs.empty) {
        // Try flat overlays collection
        overlayDocs = await db
          .collection('overlays')
          .where('assetId', '==', assetId)
          .get();
      }

      if (overlayDocs.empty) {
        console.log(`No overlays found for asset ${assetId}`);
        process.exit(0);
      }

      results.total = overlayDocs.size;
      console.log(`Found ${results.total} overlay(s) for asset ${assetId}\n`);

      for (const overlayDoc of overlayDocs.docs) {
        const result = await updateOverlay(overlayDoc, assetId, dryRun);
        if (result.success) {
          if (result.reason === 'already_updated') {
            results.skipped++;
          } else {
            results.updated++;
          }
        } else if (result.reason === 'not_video' || result.reason === 'no_720p_version') {
          results.skipped++;
        } else {
          results.failed++;
          results.errors.push({ overlayId: overlayDoc.id, reason: result.reason });
        }
      }
    } else if (all) {
      // Update all overlay videos
      console.log('Finding all overlay videos...\n');

      // Get all overlays from both structures
      const overlayAssetsSnap = await db
        .collection('assets')
        .where('category', '==', 'Overlays & Transitions')
        .get();

      const allOverlays = [];
      
      // Collect from subcollections
      for (const assetDoc of overlayAssetsSnap.docs) {
        const overlaysSnap = await db
          .collection('assets')
          .doc(assetDoc.id)
          .collection('overlays')
          .get();
        
        overlaysSnap.docs.forEach((overlayDoc) => {
          allOverlays.push({
            overlayDoc,
            assetId: assetDoc.id,
          });
        });
      }

      // Collect from flat overlays collection
      const flatOverlaysSnap = await db.collection('overlays').get();
      flatOverlaysSnap.docs.forEach((overlayDoc) => {
        const assetId = overlayDoc.data().assetId;
        if (assetId && !allOverlays.find(o => o.overlayDoc.id === overlayDoc.id)) {
          allOverlays.push({
            overlayDoc,
            assetId,
          });
        }
      });

      if (allOverlays.length === 0) {
        console.log('No overlays found');
        process.exit(0);
      }

      results.total = allOverlays.length;
      console.log(`Found ${results.total} overlay(s) across ${overlayAssetsSnap.size} asset(s)\n`);

      for (const { overlayDoc, assetId: aid } of allOverlays) {
        const result = await updateOverlay(overlayDoc, aid, dryRun);
        if (result.success) {
          if (result.reason === 'already_updated') {
            results.skipped++;
          } else {
            results.updated++;
          }
        } else if (result.reason === 'not_video' || result.reason === 'no_720p_version') {
          results.skipped++;
        } else {
          results.failed++;
          results.errors.push({ overlayId: overlayDoc.id, reason: result.reason });
        }
      }
    }

    // Print summary
    console.log('\n=== Update Summary ===');
    console.log(`Total: ${results.total}`);
    console.log(`Updated: ${results.updated}`);
    console.log(`Skipped: ${results.skipped}`);
    console.log(`Failed: ${results.failed}`);

    if (results.errors.length > 0) {
      console.log('\nErrors:');
      results.errors.forEach(({ overlayId, reason }) => {
        console.log(`  - ${overlayId}: ${reason}`);
      });
    }

    if (dryRun && results.updated > 0) {
      console.log('\n⚠ This was a dry run. Run without --dry-run to apply changes.');
    }

    if (results.failed > 0) {
      process.exit(1);
    }
  } catch (error) {
    console.error('\nFatal error:', error);
    process.exit(1);
  }
}

// Run the script
main().catch((error) => {
  console.error('Unhandled error:', error);
  process.exit(1);
});

