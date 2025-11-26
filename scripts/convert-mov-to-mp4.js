#!/usr/bin/env node
/*
  Convert existing .mov overlay files to .mp4 format
  
  This script:
  1. Finds all overlay documents with .mov fileType
  2. Downloads each .mov file from Firebase Storage
  3. Converts it to .mp4 using ffmpeg
  4. Uploads the converted .mp4 file back to Firebase Storage
  5. Updates the Firestore document to reflect the new fileType
  6. Optionally deletes the original .mov file
  
  Requirements:
  - ffmpeg must be installed and available in PATH
  - FIREBASE_ADMIN_PROJECT_ID
  - FIREBASE_ADMIN_CLIENT_EMAIL
  - FIREBASE_ADMIN_PRIVATE_KEY
  - npm packages: fs-extra, dotenv
  
  Usage:
    node scripts/convert-mov-to-mp4.js [--assetId=xxx] [--overlayId=xxx] [--all] [--delete-original]
  
  If --assetId is provided, only processes overlays for that asset.
  If --overlayId is provided, only processes that specific overlay.
  If --all is provided, processes all .mov overlays.
  If --delete-original is provided, deletes the original .mov file after conversion.
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
 * Delete a file from Firebase Storage
 */
async function deleteFile(storagePath) {
  const file = bucket.file(storagePath);
  await file.delete();
  console.log(`  Deleted: ${storagePath}`);
}

/**
 * Convert .mov file to .mp4 using ffmpeg
 */
async function convertMovToMp4(inputPath, outputPath) {
  // Use ffmpeg to convert with H.264 codec for maximum compatibility
  // -c:v libx264: Use H.264 video codec
  // -c:a aac: Use AAC audio codec
  // -preset medium: Balance between speed and compression
  // -crf 23: Good quality (lower = better quality, 18-28 is typical range)
  // -movflags +faststart: Enable fast start for web playback
  const command = `ffmpeg -i "${inputPath}" -c:v libx264 -c:a aac -preset medium -crf 23 -movflags +faststart -y "${outputPath}"`;
  
  try {
    const { stdout, stderr } = await execAsync(command);
    if (stderr && !stderr.includes('frame=')) {
      // ffmpeg outputs progress to stderr, which is normal
      console.log(`  Conversion output: ${stderr.substring(0, 200)}...`);
    }
    return true;
  } catch (error) {
    console.error(`  Conversion failed: ${error.message}`);
    if (error.stderr) {
      console.error(`  FFmpeg error: ${error.stderr.substring(0, 500)}`);
    }
    return false;
  }
}

/**
 * Process a single overlay conversion
 */
async function convertOverlay(overlayDoc, assetId, deleteOriginal = false, storagePathOverride = null) {
  const overlayId = overlayDoc ? overlayDoc.id : null;
  const overlayData = overlayDoc ? overlayDoc.data() : {};
  const storagePath = storagePathOverride || overlayData?.storagePath;
  const fileName = overlayData?.fileName || path.basename(storagePath) || 'overlay';
  const fileType = overlayData?.fileType || 'mov';

  // Skip if not a .mov file
  if (fileType.toLowerCase() !== 'mov' && !storagePath?.toLowerCase().endsWith('.mov')) {
    console.log(`  Skipping ${fileName}: Not a .mov file`);
    return { success: false, reason: 'not_mov' };
  }

  console.log(`\nConverting: ${fileName}${overlayId ? ` (${overlayId})` : ' (from Storage)'}`);
  if (!overlayId) {
    console.log(`  Asset ID: ${assetId}`);
  }

  if (!storagePath) {
    console.error(`  Error: No storage path found`);
    return { success: false, reason: 'no_storage_path' };
  }
  
  // Verify asset exists
  const assetDoc = await db.collection('assets').doc(assetId).get();
  if (!assetDoc.exists) {
    console.error(`  ✗ Error: Asset ${assetId} not found in Firestore`);
    return { success: false, reason: 'asset_not_found' };
  }

  // Create new storage path with .mp4 extension
  const newStoragePath = storagePath.replace(/\.mov$/i, '.mp4');
  const newFileName = fileName.replace(/\.mov$/i, '.mp4');

  // Check if .mp4 file already exists in Firebase Storage
  const mp4File = bucket.file(newStoragePath);
  const [mp4Exists] = await mp4File.exists();
  
  if (mp4Exists) {
    console.log(`  ⏭ Skipping: .mp4 file already exists at ${newStoragePath}`);
    
    // Check if Firestore document exists and update it if needed
    if (overlayId) {
      // Try subcollection first
      const overlayDocSub = await db
        .collection('assets')
        .doc(assetId)
        .collection('overlays')
        .doc(overlayId)
        .get();
      
      if (overlayDocSub.exists) {
        const currentData = overlayDocSub.data();
        // Update if it's still pointing to .mov file
        if (currentData.storagePath?.toLowerCase().endsWith('.mov') || 
            currentData.fileType?.toLowerCase() === 'mov') {
          await db
            .collection('assets')
            .doc(assetId)
            .collection('overlays')
            .doc(overlayId)
            .update({
              storagePath: newStoragePath,
              fileName: newFileName,
              fileType: 'mp4',
              convertedFromMov: true,
            });
          console.log(`  ✓ Updated Firestore document in subcollection to point to existing .mp4 file`);
        }
      } else {
        // Try flat overlays collection
        const overlayDocFlat = await db.collection('overlays').doc(overlayId).get();
        if (overlayDocFlat.exists) {
          const currentData = overlayDocFlat.data();
          if (currentData.storagePath?.toLowerCase().endsWith('.mov') || 
              currentData.fileType?.toLowerCase() === 'mov') {
            await db.collection('overlays').doc(overlayId).update({
              storagePath: newStoragePath,
              fileName: newFileName,
              fileType: 'mp4',
              convertedFromMov: true,
            });
            console.log(`  ✓ Updated Firestore document in overlays collection to point to existing .mp4 file`);
          }
        }
      }
    } else {
      // Check if Firestore document exists for this storage path (check both structures)
      const existingOverlaysSub = await db
        .collection('assets')
        .doc(assetId)
        .collection('overlays')
        .where('storagePath', '==', newStoragePath)
        .get();
      
      const existingOverlaysFlat = await db
        .collection('overlays')
        .where('storagePath', '==', newStoragePath)
        .get();
      
      if (existingOverlaysSub.empty && existingOverlaysFlat.empty) {
        // Create Firestore document for existing .mp4 file in flat overlays collection
        const assetDoc = await db.collection('assets').doc(assetId).get();
        if (assetDoc.exists) {
          const assetData = assetDoc.data();
          const overlayRef = await db
            .collection('overlays')
            .add({
              assetId: assetId,
              assetTitle: assetData.title || 'Untitled',
              fileName: newFileName,
              storagePath: newStoragePath,
              fileType: 'mp4',
              convertedFromMov: true,
              createdAt: admin.firestore.FieldValue.serverTimestamp(),
            });
          console.log(`  ✓ Created Firestore document for existing .mp4 file`);
          console.log(`    Location: overlays/${overlayRef.id}`);
          console.log(`    Asset: ${assetData.title || 'Untitled'} (${assetId})`);
        } else {
          console.error(`  ✗ Error: Asset ${assetId} not found in Firestore`);
        }
      }
    }
    
    return { success: true, reason: 'already_exists' };
  }

  // Create temporary directory for conversion
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mov-to-mp4-'));
  const fileId = overlayId || path.basename(storagePath, '.mov') || Date.now().toString();
  const inputPath = path.join(tempDir, `${fileId}.mov`);
  const outputPath = path.join(tempDir, `${fileId}.mp4`);

  try {
    // Download original file
    await downloadFile(storagePath, inputPath);

    // Convert to MP4
    console.log(`  Converting to MP4...`);
    const converted = await convertMovToMp4(inputPath, outputPath);
    if (!converted) {
      return { success: false, reason: 'conversion_failed' };
    }

    // Check if output file exists
    if (!(await fs.pathExists(outputPath))) {
      console.error(`  Error: Output file not created`);
      return { success: false, reason: 'output_missing' };
    }

    // Get file size for logging
    const stats = await fs.stat(outputPath);
    console.log(`  Converted: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);

    // Upload converted file
    await uploadFile(outputPath, newStoragePath, 'video/mp4');

    // Update Firestore document if it exists
    if (overlayId) {
      // Try subcollection first (for backward compatibility)
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
            storagePath: newStoragePath,
            fileName: newFileName,
            fileType: 'mp4',
            convertedFromMov: true,
            convertedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        console.log(`  ✓ Updated Firestore document in subcollection`);
      } else {
        // Try flat overlays collection
        const flatDoc = await db.collection('overlays').doc(overlayId).get();
        if (flatDoc.exists) {
          await db.collection('overlays').doc(overlayId).update({
            storagePath: newStoragePath,
            fileName: newFileName,
            fileType: 'mp4',
            convertedFromMov: true,
            convertedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
          console.log(`  ✓ Updated Firestore document in overlays collection`);
        } else {
          console.log(`  ⚠ No existing Firestore document found, will create new one`);
        }
      }
    } else {
      // Create new Firestore document if it doesn't exist
      const assetDoc = await db.collection('assets').doc(assetId).get();
      if (assetDoc.exists) {
        const assetData = assetDoc.data();
        // Create document in flat overlays collection
        const overlayRef = await db
          .collection('overlays')
          .add({
            assetId: assetId,
            assetTitle: assetData.title || 'Untitled',
            fileName: newFileName,
            storagePath: newStoragePath,
            fileType: 'mp4',
            convertedFromMov: true,
            convertedAt: admin.firestore.FieldValue.serverTimestamp(),
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        console.log(`  ✓ Created Firestore document`);
        console.log(`    Location: overlays/${overlayRef.id}`);
        console.log(`    Asset: ${assetData.title || 'Untitled'} (${assetId})`);
      } else {
        console.error(`  ✗ Error: Asset ${assetId} not found in Firestore`);
        return { success: false, reason: 'asset_not_found' };
      }
    }

    // Optionally delete original .mov file
    if (deleteOriginal) {
      await deleteFile(storagePath);
      console.log(`  ✓ Deleted original .mov file`);
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
  console.log('=== Convert .mov Overlays to .mp4 ===\n');

  // Check if ffmpeg is available
  const ffmpegAvailable = await checkFfmpeg();
  if (!ffmpegAvailable) {
    process.exit(1);
  }

  const assetId = getArg('assetId', null);
  const overlayId = getArg('overlayId', null);
  const storagePath = getArg('storagePath', null);
  const all = hasFlag('all');
  const deleteOriginal = hasFlag('delete-original');
  const scanStorage = hasFlag('scan-storage');

  if (!assetId && !overlayId && !storagePath && !all) {
    console.error('Error: Must provide --assetId=xxx, --overlayId=xxx, --storagePath=xxx, or --all');
    console.error('\nUsage:');
    console.error('  node scripts/convert-mov-to-mp4.js --all');
    console.error('  node scripts/convert-mov-to-mp4.js --all --scan-storage');
    console.error('  node scripts/convert-mov-to-mp4.js --assetId=xxx');
    console.error('  node scripts/convert-mov-to-mp4.js --assetId=xxx --overlayId=xxx');
    console.error('  node scripts/convert-mov-to-mp4.js --assetId=xxx --storagePath=assets/overlays/folder/file.mov');
    console.error('  node scripts/convert-mov-to-mp4.js --all --delete-original');
    console.error('\nFlags:');
    console.error('  --scan-storage: Also scan Firebase Storage directly for .mov files');
    console.error('                 (useful if files were uploaded but not in Firestore)');
    console.error('  --storagePath: Convert a specific file by its Firebase Storage path');
    process.exit(1);
  }

  const results = {
    total: 0,
    converted: 0,
    skipped: 0,
    failed: 0,
    errors: [],
  };

  // Handle direct storage path conversion
  if (storagePath) {
    if (!assetId) {
      console.error('Error: --assetId is required when using --storagePath');
      process.exit(1);
    }
    
    if (!storagePath.toLowerCase().endsWith('.mov')) {
      console.error('Error: Storage path must point to a .mov file');
      process.exit(1);
    }
    
    try {
      const assetDoc = await db.collection('assets').doc(assetId).get();
      if (!assetDoc.exists) {
        console.error(`Error: Asset ${assetId} not found`);
        process.exit(1);
      }
      
      results.total = 1;
      const result = await convertOverlay(null, assetId, deleteOriginal, storagePath);
      if (result.success) {
        if (result.reason === 'already_exists') {
          results.skipped++;
        } else {
          results.converted++;
        }
      } else {
        results.failed++;
        results.errors.push({ storagePath, reason: result.reason });
      }
      
      // Print summary and exit
      console.log('\n=== Conversion Summary ===');
      console.log(`Total: ${results.total}`);
      console.log(`Converted: ${results.converted}`);
      console.log(`Skipped: ${results.skipped}`);
      console.log(`Failed: ${results.failed}`);
      process.exit(results.failed > 0 ? 1 : 0);
    } catch (error) {
      console.error('\nFatal error:', error);
      process.exit(1);
    }
  }

  try {
    if (overlayId && assetId) {
      // Convert single overlay
      const overlayDoc = await db
        .collection('assets')
        .doc(assetId)
        .collection('overlays')
        .doc(overlayId)
        .get();

      if (!overlayDoc.exists) {
        console.error(`Error: Overlay ${overlayId} not found`);
        process.exit(1);
      }

      results.total = 1;
      const result = await convertOverlay(overlayDoc, assetId, deleteOriginal);
      if (result.success) {
        if (result.reason === 'already_exists') {
          results.skipped++;
        } else {
          results.converted++;
        }
      } else {
        results.failed++;
        results.errors.push({ overlayId, reason: result.reason });
      }
    } else if (assetId) {
      // Convert all overlays for a specific asset
      // Get all overlays and filter for .mov files
      const overlayDocs = await db
        .collection('assets')
        .doc(assetId)
        .collection('overlays')
        .get();

      // Filter for .mov files (check both fileType and storagePath)
      const movOverlays = overlayDocs.docs.filter((doc) => {
        const data = doc.data();
        const fileType = (data.fileType || '').toLowerCase();
        const storagePath = (data.storagePath || '').toLowerCase();
        return fileType === 'mov' || storagePath.endsWith('.mov');
      });

      if (movOverlays.length === 0) {
        console.log(`No .mov overlays found for asset ${assetId}`);
        process.exit(0);
      }

      results.total = movOverlays.length;
      console.log(`Found ${results.total} .mov overlay(s) for asset ${assetId}\n`);

      for (const overlayDoc of movOverlays) {
        const result = await convertOverlay(overlayDoc, assetId, deleteOriginal);
        if (result.success) {
          if (result.reason === 'already_exists') {
            results.skipped++;
          } else {
            results.converted++;
          }
        } else if (result.reason === 'not_mov') {
          results.skipped++;
        } else {
          results.failed++;
          results.errors.push({ overlayId: overlayDoc.id, reason: result.reason });
        }
      }
    } else if (all) {
      // Convert all .mov overlays across all assets
      console.log('Finding all .mov overlays...\n');

      const movOverlays = [];

      if (scanStorage) {
        // Also scan Firebase Storage directly for .mov files
        console.log('Scanning Firebase Storage for .mov files...');
        const [storageFiles] = await bucket.getFiles({ prefix: 'assets/' });
        
        // Get all overlay assets first for matching
        const overlayAssetsSnap = await db
          .collection('assets')
          .where('category', '==', 'Overlays & Transitions')
          .get();
        
        const assetMap = new Map();
        overlayAssetsSnap.docs.forEach((doc) => {
          const assetData = doc.data();
          assetMap.set(doc.id, { id: doc.id, ...assetData });
        });
        
        // Get all existing overlay documents to avoid duplicates
        const existingOverlayPaths = new Set();
        for (const assetDoc of overlayAssetsSnap.docs) {
          const overlaysSnap = await db
            .collection('assets')
            .doc(assetDoc.id)
            .collection('overlays')
            .get();
          overlaysSnap.docs.forEach((overlayDoc) => {
            const storagePath = overlayDoc.data()?.storagePath;
            if (storagePath) {
              existingOverlayPaths.add(storagePath.toLowerCase());
            }
          });
        }
        
        const storageMovFiles = [];
        for (const file of storageFiles) {
          const fileName = file.name.toLowerCase();
          if (fileName.endsWith('.mov') && !existingOverlayPaths.has(fileName)) {
            // Extract path parts: assets/overlays/{assetFolder}/{filename}.mov
            const pathParts = file.name.split('/');
            if (pathParts.length >= 3 && pathParts[0] === 'assets') {
              const assetFolderName = pathParts[pathParts.length - 2];
              const fileNameOnly = pathParts[pathParts.length - 1];
              
              // Try to find matching asset by folder name
              let matchedAsset = null;
              for (const [assetId, assetData] of assetMap.entries()) {
                // Check if asset's storage path contains this folder
                if (assetData.storagePath && assetData.storagePath.includes(assetFolderName)) {
                  matchedAsset = { id: assetId, ...assetData };
                  break;
                }
                // Also check asset title matches folder name
                const assetTitleLower = (assetData.title || '').toLowerCase().replace(/\s+/g, '-');
                if (assetTitleLower === assetFolderName.toLowerCase() || 
                    assetFolderName.toLowerCase().includes(assetTitleLower) ||
                    assetTitleLower.includes(assetFolderName.toLowerCase())) {
                  matchedAsset = { id: assetId, ...assetData };
                  break;
                }
              }
              
              // If no match found, try to find by scanning all assets in overlays folder
              if (!matchedAsset && pathParts[1]?.toLowerCase().includes('overlay')) {
                // Use first overlay asset as fallback, or create a generic match
                const firstAsset = Array.from(assetMap.values())[0];
                if (firstAsset) {
                  matchedAsset = firstAsset;
                  console.log(`  ⚠ Using fallback asset for ${file.name}: ${firstAsset.title}`);
                }
              }
              
              if (matchedAsset) {
                storageMovFiles.push({
                  storagePath: file.name,
                  fileName: fileNameOnly,
                  assetId: matchedAsset.id,
                  assetTitle: matchedAsset.title || 'Untitled',
                });
              } else {
                console.log(`  ⚠ Could not match asset for: ${file.name}`);
              }
            }
          }
        }
        
        console.log(`Found ${storageMovFiles.length} .mov file(s) in Storage without Firestore documents\n`);
        
        for (const fileInfo of storageMovFiles) {
          movOverlays.push({
            overlayDoc: null,
            storagePath: fileInfo.storagePath,
            assetId: fileInfo.assetId,
            assetTitle: fileInfo.assetTitle,
          });
        }
      }

      // Get all overlay assets from Firestore
      const overlayAssetsSnap = await db
        .collection('assets')
        .where('category', '==', 'Overlays & Transitions')
        .get();

      if (overlayAssetsSnap.empty && movOverlays.length === 0) {
        console.log('No overlay assets found');
        process.exit(0);
      }

      // Collect all .mov overlays from Firestore
      for (const assetDoc of overlayAssetsSnap.docs) {
        const overlaysSnap = await db
          .collection('assets')
          .doc(assetDoc.id)
          .collection('overlays')
          .get();

        // Filter for .mov files (check both fileType and storagePath)
        overlaysSnap.docs.forEach((overlayDoc) => {
          const data = overlayDoc.data();
          const fileType = (data.fileType || '').toLowerCase();
          const storagePath = (data.storagePath || '').toLowerCase();
          
          if (fileType === 'mov' || storagePath.endsWith('.mov')) {
            movOverlays.push({
              overlayDoc,
              assetId: assetDoc.id,
              assetTitle: assetDoc.data().title || 'Untitled',
            });
          }
        });
      }

      if (movOverlays.length === 0) {
        console.log('No .mov overlays found');
        process.exit(0);
      }

      results.total = movOverlays.length;
      console.log(`Found ${results.total} .mov overlay(s) across ${overlayAssetsSnap.size} asset(s)\n`);

      for (const { overlayDoc, assetId: aid, assetTitle, storagePath: sp } of movOverlays) {
        console.log(`\n[${assetTitle}] (Asset ID: ${aid})`);
        const result = await convertOverlay(overlayDoc, aid, deleteOriginal, sp);
        if (result.success) {
          if (result.reason === 'already_exists') {
            results.skipped++;
          } else {
            results.converted++;
          }
        } else if (result.reason === 'not_mov') {
          results.skipped++;
        } else {
          results.failed++;
          results.errors.push({ overlayId: overlayDoc?.id || 'unknown', reason: result.reason });
        }
      }
    }

    // Print summary
    console.log('\n=== Conversion Summary ===');
    console.log(`Total: ${results.total}`);
    console.log(`Converted: ${results.converted}`);
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

