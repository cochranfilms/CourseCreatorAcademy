#!/usr/bin/env node
/*
  Transcode overlay videos to 720p for faster preview loading
  
  This script:
  1. Finds all overlay video files (.mp4, .mov)
  2. Downloads each video
  3. Transcodes to 720p using ffmpeg
  4. Uploads the 720p version back to Storage with _720p suffix
  5. Optionally updates Firestore to use the 720p version for previews
  
  Requirements:
  - ffmpeg must be installed and available in PATH
  - FIREBASE_ADMIN_PROJECT_ID
  - FIREBASE_ADMIN_CLIENT_EMAIL
  - FIREBASE_ADMIN_PRIVATE_KEY
  
  Usage:
    node scripts/transcode-overlays-to-720p.js [--assetId=xxx] [--all] [--update-firestore]
*/

// Load env from .env.local first, then fallback to .env
try {
  require('dotenv').config({ path: '.env.local' });
} catch {}
require('dotenv').config();

const admin = require('firebase-admin');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

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
 * Check if ffmpeg is available
 */
async function checkFfmpeg() {
  try {
    await execAsync('ffmpeg -version');
    return true;
  } catch (error) {
    console.error('Error: ffmpeg is not installed or not in PATH');
    console.error('Please install ffmpeg: https://ffmpeg.org/download.html');
    return false;
  }
}

/**
 * Download a file from Firebase Storage to a local path
 */
async function downloadFile(storagePath, localPath) {
  const file = bucket.file(storagePath);
  await fs.ensureDir(path.dirname(localPath));
  await file.download({ destination: localPath });
  console.log(`  Downloaded: ${storagePath}`);
}

/**
 * Upload a file to Firebase Storage
 */
async function uploadFile(localPath, storagePath, contentType) {
  const file = bucket.file(storagePath);
  await file.save(await fs.readFile(localPath), {
    metadata: {
      contentType: contentType || 'video/mp4',
    },
  });
  console.log(`  Uploaded: ${storagePath}`);
}

/**
 * Transcode video to 720p using ffmpeg
 */
async function transcodeTo720p(inputPath, outputPath) {
  // FFmpeg command to transcode to 720p:
  // -vf scale=1280:720:force_original_aspect_ratio=decrease - scales to max 720p maintaining aspect ratio
  // -c:v libx264 - H.264 codec
  // -preset fast - faster encoding
  // -crf 23 - good quality
  // -c:a aac - AAC audio
  // -b:a 128k - audio bitrate
  // -movflags +faststart - web optimization
  const command = `ffmpeg -i "${inputPath}" -vf "scale=1280:720:force_original_aspect_ratio=decrease" -c:v libx264 -preset fast -crf 23 -c:a aac -b:a 128k -movflags +faststart -y "${outputPath}"`;
  
  try {
    const { stdout, stderr } = await execAsync(command);
    if (stderr && !stderr.includes('frame=')) {
      console.log(`  Transcoding output: ${stderr.substring(0, 200)}...`);
    }
    return true;
  } catch (error) {
    console.error(`  Transcoding failed: ${error.message}`);
    if (error.stderr) {
      console.error(`  FFmpeg error: ${error.stderr.substring(0, 500)}`);
    }
    return false;
  }
}

/**
 * Process a single overlay video
 */
async function transcodeOverlay(overlayDoc, assetId, updateFirestore = false) {
  const overlayId = overlayDoc.id;
  const overlayData = overlayDoc.data();
  const storagePath = overlayData?.storagePath;
  const fileName = overlayData?.fileName || 'overlay';

  if (!storagePath) {
    console.log(`  Skipping: No storage path`);
    return { success: false, reason: 'no_storage_path' };
  }

  // Check if it's a video file
  const videoExtensions = ['.mp4', '.mov', '.avi', '.mkv', '.webm', '.m4v'];
  const isVideo = videoExtensions.some(ext => storagePath.toLowerCase().endsWith(ext));
  
  if (!isVideo) {
    console.log(`  Skipping: Not a video file`);
    return { success: false, reason: 'not_video' };
  }

  // Check if 720p version already exists
  const cachePath = storagePath.replace(/\.(mp4|mov|avi|mkv|webm|m4v)$/i, '_720p.mp4');
  const cachedFile = bucket.file(cachePath);
  const [cacheExists] = await cachedFile.exists();

  if (cacheExists) {
    console.log(`  ⏭ Skipping: 720p version already exists at ${cachePath}`);
    return { success: true, reason: 'already_exists' };
  }

  console.log(`\nTranscoding: ${fileName} (${overlayId})`);

  // Create temporary directory
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'transcode-720p-'));
  const fileId = overlayId || path.basename(storagePath, path.extname(storagePath));
  const inputPath = path.join(tempDir, `${fileId}${path.extname(storagePath)}`);
  const outputPath = path.join(tempDir, `${fileId}_720p.mp4`);

  try {
    // Download original file
    await downloadFile(storagePath, inputPath);

    // Transcode to 720p
    console.log(`  Transcoding to 720p...`);
    const transcoded = await transcodeTo720p(inputPath, outputPath);
    if (!transcoded) {
      return { success: false, reason: 'transcode_failed' };
    }

    // Check if output file exists
    if (!(await fs.pathExists(outputPath))) {
      console.error(`  Error: Output file not created`);
      return { success: false, reason: 'output_missing' };
    }

    // Get file size for logging
    const stats = await fs.stat(outputPath);
    const originalStats = await fs.stat(inputPath);
    const sizeReduction = ((1 - stats.size / originalStats.size) * 100).toFixed(1);
    console.log(`  Transcoded: ${(stats.size / 1024 / 1024).toFixed(2)} MB (${sizeReduction}% smaller)`);

    // Upload 720p version
    await uploadFile(outputPath, cachePath, 'video/mp4');

    // Optionally update Firestore to use 720p version for previews
    if (updateFirestore) {
      // Add previewStoragePath field pointing to 720p version
      // Try subcollection first
      const subcollectionDoc = await db
        .collection('assets')
        .doc(assetId)
        .collection('overlays')
        .doc(overlayId)
        .get();
      
      if (subcollectionDoc.exists) {
        await db
          .collection('assets')
          .doc(assetId)
          .collection('overlays')
          .doc(overlayId)
          .update({
            previewStoragePath: cachePath,
            transcoded720p: true,
            transcodedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        console.log(`  ✓ Updated Firestore subcollection document`);
      } else {
        // Try flat overlays collection
        const flatDoc = await db.collection('overlays').doc(overlayId).get();
        if (flatDoc.exists) {
          await db.collection('overlays').doc(overlayId).update({
            previewStoragePath: cachePath,
            transcoded720p: true,
            transcodedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
          console.log(`  ✓ Updated Firestore overlays collection document`);
        }
      }
    }

    return { success: true };
  } catch (error) {
    console.error(`  Error processing overlay: ${error.message}`);
    return { success: false, reason: 'error', error: error.message };
  } finally {
    // Clean up temporary files
    try {
      await fs.remove(tempDir);
    } catch (error) {
      console.error(`  Warning: Failed to clean up temp directory: ${error.message}`);
    }
  }
}

/**
 * Main function
 */
async function main() {
  console.log('=== Transcode Overlay Videos to 720p ===\n');

  // Check if ffmpeg is available
  const ffmpegAvailable = await checkFfmpeg();
  if (!ffmpegAvailable) {
    process.exit(1);
  }

  const assetId = getArg('assetId', null);
  const all = hasFlag('all');
  const updateFirestore = hasFlag('update-firestore');

  if (!assetId && !all) {
    console.error('Error: Must provide --assetId=xxx or --all');
    console.error('\nUsage:');
    console.error('  node scripts/transcode-overlays-to-720p.js --all');
    console.error('  node scripts/transcode-overlays-to-720p.js --assetId=xxx');
    console.error('  node scripts/transcode-overlays-to-720p.js --all --update-firestore');
    process.exit(1);
  }

  const results = {
    total: 0,
    transcoded: 0,
    skipped: 0,
    failed: 0,
    errors: [],
  };

  try {
    if (assetId) {
      // First, verify the asset exists
      const assetDoc = await db.collection('assets').doc(assetId).get();
      if (!assetDoc.exists) {
        console.error(`\n❌ Error: Asset ${assetId} does not exist in Firestore`);
        console.error('Please verify the asset ID is correct.');
        process.exit(1);
      }
      
      const assetData = assetDoc.data();
      console.log(`\nAsset found: ${assetData?.title || 'Untitled'}`);
      console.log(`Category: ${assetData?.category || 'N/A'}`);
      console.log(`Storage path: ${assetData?.storagePath || 'N/A'}\n`);

      // Transcode all overlays for a specific asset
      console.log('Checking subcollection: assets/' + assetId + '/overlays/');
      const overlayDocs = await db
        .collection('assets')
        .doc(assetId)
        .collection('overlays')
        .get();

      console.log(`  Found ${overlayDocs.size} overlay(s) in subcollection`);

      if (overlayDocs.empty) {
        // Try flat overlays collection
        console.log('\nChecking flat collection: overlays (where assetId == ' + assetId + ')');
        const flatOverlays = await db
          .collection('overlays')
          .where('assetId', '==', assetId)
          .get();
        
        console.log(`  Found ${flatOverlays.size} overlay(s) in flat collection`);
        
        // If still empty, check if there are any overlays with similar assetId or check storage
        if (flatOverlays.empty) {
          console.log('\n⚠️  No overlays found in Firestore for this asset.');
          console.log('Checking if there are overlays in Storage...');
          
          // Check if asset has a storagePath that suggests overlays exist
          const storagePath = assetData?.storagePath;
          if (storagePath && (storagePath.includes('/overlays/') || storagePath.includes('/transitions/'))) {
            const folderPath = storagePath.replace('.zip', '');
            console.log(`\nAsset storage path: ${storagePath}`);
            console.log(`Expected overlay folder: ${folderPath}`);
            console.log('\nPossible reasons:');
            console.log('  1. Overlays may not have been extracted from the ZIP yet');
            console.log('  2. Overlay documents may not have been created in Firestore');
            console.log('  3. The assetId in overlay documents may be different');
            console.log('\nTry running:');
            console.log(`  node scripts/unzip-overlay-assets.js --assetId=${assetId}`);
            console.log(`  node scripts/create-overlay-docs-from-storage.js --assetId=${assetId}`);
          }
        }
        
        results.total = flatOverlays.size;
        console.log(`\nFound ${results.total} overlay(s) for asset ${assetId}\n`);

        for (const overlayDoc of flatOverlays.docs) {
          const result = await transcodeOverlay(overlayDoc, assetId, updateFirestore);
          if (result.success) {
            if (result.reason === 'already_exists') {
              results.skipped++;
            } else {
              results.transcoded++;
            }
          } else if (result.reason === 'not_video') {
            results.skipped++;
          } else {
            results.failed++;
            results.errors.push({ overlayId: overlayDoc.id, reason: result.reason });
          }
        }
      } else {
        results.total = overlayDocs.size;
        console.log(`\nFound ${results.total} overlay(s) for asset ${assetId}\n`);

        for (const overlayDoc of overlayDocs.docs) {
          const result = await transcodeOverlay(overlayDoc, assetId, updateFirestore);
          if (result.success) {
            if (result.reason === 'already_exists') {
              results.skipped++;
            } else {
              results.transcoded++;
            }
          } else if (result.reason === 'not_video') {
            results.skipped++;
          } else {
            results.failed++;
            results.errors.push({ overlayId: overlayDoc.id, reason: result.reason });
          }
        }
      }
    } else if (all) {
      // Transcode all overlay videos
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
        const result = await transcodeOverlay(overlayDoc, aid, updateFirestore);
        if (result.success) {
          if (result.reason === 'already_exists') {
            results.skipped++;
          } else {
            results.transcoded++;
          }
        } else if (result.reason === 'not_video') {
          results.skipped++;
        } else {
          results.failed++;
          results.errors.push({ overlayId: overlayDoc.id, reason: result.reason });
        }
      }
    }

    // Print summary
    console.log('\n=== Transcoding Summary ===');
    console.log(`Total: ${results.total}`);
    console.log(`Transcoded: ${results.transcoded}`);
    console.log(`Skipped: ${results.skipped}`);
    console.log(`Failed: ${results.failed}`);

    if (results.errors.length > 0) {
      console.log('\nErrors:');
      results.errors.forEach(({ overlayId, reason }) => {
        console.log(`  - ${overlayId}: ${reason}`);
      });
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

