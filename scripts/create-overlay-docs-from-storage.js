#!/usr/bin/env node
/*
  Create Firestore documents for overlay files in Storage that don't have documents yet
  
  This script:
  1. Scans Firebase Storage for overlay files in assets/overlays folders
  2. Groups files by base name (e.g., "Distressed Paper Shifts")
  3. Identifies .mp4 files (for download) and _720p.mp4 files (for preview)
  4. Creates or finds the asset document
  5. Creates overlay documents with:
     - storagePath: points to .mp4 file (for download)
     - previewStoragePath: points to _720p.mp4 file (for preview)
  
  Usage:
    node scripts/create-overlay-docs-from-storage.js [--folder=xxx] [--all] [--dry-run]
*/

// Load env from .env.local first, then fallback to .env
try {
  require('dotenv').config({ path: '.env.local' });
} catch {}
require('dotenv').config();

const admin = require('firebase-admin');
const path = require('path');

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
 * Extract base name from file path
 * "assets/overlays/Folder/File.mp4" -> "File"
 * "assets/overlays/Folder/File_720p.mp4" -> "File"
 */
function getBaseName(filePath) {
  const fileName = path.basename(filePath);
  // Remove extension and _720p suffix
  return fileName.replace(/_720p\.(mp4|mov)$/i, '').replace(/\.(mp4|mov|avi|mkv|webm|m4v)$/i, '');
}

/**
 * Get folder name from storage path
 * "assets/overlays/Ultimate Paper FX/File.mp4" -> "Ultimate Paper FX"
 */
function getFolderName(storagePath) {
  const parts = storagePath.split('/');
  if (parts.length >= 3 && parts[0] === 'assets' && parts[1] === 'overlays') {
    return parts[2];
  }
  return null;
}

/**
 * Find or create asset document
 */
async function findOrCreateAsset(folderName) {
  // Search for existing asset
  const assetsSnap = await db
    .collection('assets')
    .where('category', '==', 'Overlays & Transitions')
    .get();

  for (const doc of assetsSnap.docs) {
    const assetData = doc.data();
    const assetTitle = (assetData.title || '').toLowerCase();
    const assetStoragePath = (assetData.storagePath || '').toLowerCase();
    
    // Check if title or storage path matches folder name
    if (assetTitle === folderName.toLowerCase() || 
        assetStoragePath.includes(folderName.toLowerCase()) ||
        folderName.toLowerCase().includes(assetTitle.replace(/\s+/g, ''))) {
      return { id: doc.id, ...assetData };
    }
  }

  // Create new asset if not found
  console.log(`  Creating new asset: "${folderName}"`);
  const newAssetData = {
    title: folderName,
    category: 'Overlays & Transitions',
    storagePath: `assets/overlays/${folderName}/${folderName}.zip`, // Placeholder
    fileType: 'zip',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };
  
  const newAssetRef = await db.collection('assets').add(newAssetData);
  return { id: newAssetRef.id, ...newAssetData };
}

/**
 * Check if overlay document already exists
 */
async function overlayExists(assetId, storagePath) {
  // Check subcollection
  const subcollectionDocs = await db
    .collection('assets')
    .doc(assetId)
    .collection('overlays')
    .where('storagePath', '==', storagePath)
    .get();

  if (!subcollectionDocs.empty) {
    return { exists: true, doc: subcollectionDocs.docs[0], location: 'subcollection' };
  }

  // Check flat overlays collection
  const flatDocs = await db
    .collection('overlays')
    .where('assetId', '==', assetId)
    .where('storagePath', '==', storagePath)
    .get();

  if (!flatDocs.empty) {
    return { exists: true, doc: flatDocs.docs[0], location: 'flat' };
  }

  return { exists: false };
}

/**
 * Create overlay document
 */
async function createOverlayDocument(assetId, assetTitle, baseName, mp4Path, preview720pPath, dryRun) {
  const fileName = path.basename(mp4Path);
  const fileType = path.extname(mp4Path).replace('.', '').toLowerCase();

  console.log(`    Creating overlay: ${fileName}`);
  console.log(`      Download: ${mp4Path}`);
  if (preview720pPath) {
    console.log(`      Preview: ${preview720pPath}`);
  }

  if (dryRun) {
    console.log(`      [DRY RUN] Would create Firestore document`);
    return { success: true, reason: 'dry_run' };
  }

  const overlayData = {
    assetId: assetId,
    assetTitle: assetTitle,
    fileName: fileName,
    storagePath: mp4Path, // For download
    fileType: fileType,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  // Add preview path if 720p version exists
  if (preview720pPath) {
    overlayData.previewStoragePath = preview720pPath;
    overlayData.transcoded720p = true;
  }

  // Create in flat overlays collection
  const overlayRef = await db.collection('overlays').add(overlayData);
  
  console.log(`      ✓ Created: overlays/${overlayRef.id}`);
  return { success: true, overlayId: overlayRef.id };
}

/**
 * Process files in a folder
 */
async function processFolder(folderName, dryRun = false) {
  console.log(`\n📁 Processing folder: "${folderName}"`);

  // Get all files in this folder
  const folderPath = `assets/overlays/${folderName}/`;
  const [files] = await bucket.getFiles({ prefix: folderPath });

  if (files.length === 0) {
    console.log(`  No files found in ${folderPath}`);
    return { processed: 0, created: 0, skipped: 0 };
  }

  // Group files by base name
  const fileGroups = new Map();

  for (const file of files) {
    const fileName = path.basename(file.name);
    const baseName = getBaseName(file.name);
    
    if (!fileGroups.has(baseName)) {
      fileGroups.set(baseName, {
        baseName,
        mp4: null,
        preview720p: null,
        mov: null,
      });
    }

    const group = fileGroups.get(baseName);

    if (fileName.endsWith('_720p.mp4')) {
      group.preview720p = file.name;
    } else if (fileName.endsWith('.mp4')) {
      group.mp4 = file.name;
    } else if (fileName.endsWith('.mov')) {
      group.mov = file.name;
    }
  }

  console.log(`  Found ${fileGroups.size} unique overlay(s)`);

  // Find or create asset
  const asset = await findOrCreateAsset(folderName);
  console.log(`  Asset: "${asset.title}" (${asset.id})`);

  let processed = 0;
  let created = 0;
  let skipped = 0;

  // Process each group
  for (const [baseName, group] of fileGroups.entries()) {
    processed++;

    // Determine which file to use for download
    const downloadPath = group.mp4 || group.mov;
    
    if (!downloadPath) {
      console.log(`  ⚠ Skipping ${baseName}: No .mp4 or .mov file found`);
      skipped++;
      continue;
    }

    // Check if document already exists
    const exists = await overlayExists(asset.id, downloadPath);
    
    if (exists.exists) {
      console.log(`  ⏭ Skipping ${baseName}: Document already exists`);
      
      // Update existing document if it doesn't have previewStoragePath but 720p exists
      if (group.preview720p && !exists.doc.data().previewStoragePath && !dryRun) {
        if (exists.location === 'flat') {
          await db.collection('overlays').doc(exists.doc.id).update({
            previewStoragePath: group.preview720p,
            transcoded720p: true,
          });
          console.log(`    ✓ Updated with previewStoragePath`);
        } else {
          // Update subcollection too
          await db
            .collection('assets')
            .doc(asset.id)
            .collection('overlays')
            .doc(exists.doc.id)
            .update({
              previewStoragePath: group.preview720p,
              transcoded720p: true,
            });
          console.log(`    ✓ Updated subcollection with previewStoragePath`);
        }
      }
      skipped++;
      continue;
    }

    // Create new document
    const result = await createOverlayDocument(
      asset.id,
      asset.title,
      baseName,
      downloadPath,
      group.preview720p,
      dryRun
    );

    if (result.success && result.reason !== 'dry_run') {
      created++;
    } else if (result.reason === 'dry_run') {
      created++;
    }
  }

  return { processed, created, skipped };
}

/**
 * Main function
 */
async function main() {
  console.log('=== Create Overlay Documents from Storage ===\n');

  const folderName = getArg('folder', null);
  const all = hasFlag('all');
  const dryRun = hasFlag('dry-run');

  if (dryRun) {
    console.log('⚠ DRY RUN MODE - No changes will be made\n');
  }

  if (!folderName && !all) {
    console.error('Error: Must provide --folder=xxx or --all');
    console.error('\nUsage:');
    console.error('  node scripts/create-overlay-docs-from-storage.js --folder="Ultimate Paper FX"');
    console.error('  node scripts/create-overlay-docs-from-storage.js --all');
    console.error('  node scripts/create-overlay-docs-from-storage.js --all --dry-run');
    process.exit(1);
  }

  const results = {
    folders: 0,
    processed: 0,
    created: 0,
    skipped: 0,
  };

  try {
    if (folderName) {
      // Process specific folder
      const folderResults = await processFolder(folderName, dryRun);
      results.folders = 1;
      results.processed = folderResults.processed;
      results.created = folderResults.created;
      results.skipped = folderResults.skipped;
    } else if (all) {
      // Process all folders
      console.log('Scanning Storage for overlay folders...\n');
      
      const [allFiles] = await bucket.getFiles({ prefix: 'assets/overlays/' });
      
      // Extract unique folder names
      const folders = new Set();
      for (const file of allFiles) {
        const folder = getFolderName(file.name);
        if (folder) {
          folders.add(folder);
        }
      }

      console.log(`Found ${folders.size} folder(s)\n`);

      for (const folder of Array.from(folders).sort()) {
        const folderResults = await processFolder(folder, dryRun);
        results.folders++;
        results.processed += folderResults.processed;
        results.created += folderResults.created;
        results.skipped += folderResults.skipped;
      }
    }

    // Print summary
    console.log('\n=== Summary ===');
    console.log(`Folders processed: ${results.folders}`);
    console.log(`Overlays processed: ${results.processed}`);
    console.log(`Documents created: ${results.created}`);
    console.log(`Skipped: ${results.skipped}`);

    if (dryRun && results.created > 0) {
      console.log('\n⚠ This was a dry run. Run without --dry-run to create documents.');
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

