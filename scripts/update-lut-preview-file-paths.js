#!/usr/bin/env node
/*
  Update existing LUT preview documents with lutFilePath by matching to .cube files in Storage
  
  This script:
  1. Finds all lutPreviews documents that don't have lutFilePath set
  2. Scans Storage for .cube files in the pack folder
  3. Matches .cube files to preview documents by LUT name
  4. Updates preview documents with lutFilePath and fileName
  
  Usage:
    node scripts/update-lut-preview-file-paths.js [--assetId=xxx] [--all] [--dry-run]
    
  Options:
    --assetId=xxx    Update only this specific asset's previews
    --all            Update all LUT assets
    --dry-run        Show what would be updated without actually updating
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
 * Normalize LUT name for matching (remove special chars, normalize separators)
 */
function normalizeLUTName(name) {
  if (!name) return '';
  return name
    .toLowerCase()
    .replace(/[_\s]+/g, '-')  // Replace underscores and spaces with dashes
    .replace(/-+/g, '-')      // Replace multiple dashes with single dash
    .replace(/^-|-$/g, '');  // Remove leading/trailing dashes
}

/**
 * Extract folder name from storage path
 */
function getFolderNameFromStoragePath(storagePath) {
  if (!storagePath) return null;
  const fileName = path.basename(storagePath);
  return fileName.replace(/\.zip$/i, '');
}

/**
 * Match .cube file to preview document by LUT name
 */
function findMatchingCubeFile(preview, cubeFiles) {
  const previewName = normalizeLUTName(preview.lutName);
  
  // Skip generic pack names that don't correspond to individual LUTs
  const genericNames = ['thermal vision luts collection', 'thermal vision - luts collection'];
  if (genericNames.includes(previewName)) {
    return null; // These are pack-level previews, not individual LUT files
  }
  
  // Try exact match first
  for (const cubeFile of cubeFiles) {
    if (cubeFile.normalizedName === previewName) {
      return cubeFile;
    }
  }
  
  // Try matching without "OVERLAY" prefix if present
  const previewWithoutPrefix = previewName.replace(/^overlay-?t?-?/i, '').trim();
  if (previewWithoutPrefix !== previewName && previewWithoutPrefix.length > 0) {
    for (const cubeFile of cubeFiles) {
      const cubeWithoutPrefix = cubeFile.normalizedName.replace(/^overlay-?t?-?/i, '').trim();
      if (cubeWithoutPrefix === previewWithoutPrefix) {
        return cubeFile;
      }
    }
  }
  
  // Try partial match (cube file contains preview name or vice versa)
  for (const cubeFile of cubeFiles) {
    if (previewName.includes(cubeFile.normalizedName) || cubeFile.normalizedName.includes(previewName)) {
      return cubeFile;
    }
  }
  
  // Try matching key words (for cases like "Thermal Rectolog Compressed" matching "Thermal-rectolog_compressed")
  const previewWords = previewName.split('-').filter(w => w.length > 2);
  if (previewWords.length > 0) {
    for (const cubeFile of cubeFiles) {
      const cubeWords = cubeFile.normalizedName.split('-').filter(w => w.length > 2);
      // Check if most words match
      const matchingWords = previewWords.filter(pw => 
        cubeWords.some(cw => cw.includes(pw) || pw.includes(cw))
      );
      if (matchingWords.length >= Math.min(2, previewWords.length)) {
        return cubeFile;
      }
    }
  }
  
  return null;
}

/**
 * Update preview documents for a specific asset
 */
async function updateAssetPreviews(assetId, dryRun = false) {
  console.log(`\n📦 Processing asset: ${assetId}`);
  
  // Get asset document
  const assetDoc = await db.collection('assets').doc(assetId).get();
  if (!assetDoc.exists) {
    console.log(`  ⚠ Asset not found: ${assetId}`);
    return { processed: 0, updated: 0, skipped: 0 };
  }
  
  const asset = { id: assetDoc.id, ...assetDoc.data() };
  console.log(`  Asset: "${asset.title}"`);
  
  // Get pack name from storagePath
  const packName = asset.storagePath 
    ? getFolderNameFromStoragePath(asset.storagePath)
    : asset.title;
  
  if (!packName) {
    console.log(`  ⚠ Could not determine pack name`);
    return { processed: 0, updated: 0, skipped: 0 };
  }
  
  console.log(`  Pack folder: ${packName}`);
  
  // Get all preview documents for this asset
  const previewsSnap = await db
    .collection('assets')
    .doc(assetId)
    .collection('lutPreviews')
    .get();
  
  const previews = previewsSnap.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  }));
  
  if (previews.length === 0) {
    console.log(`  ℹ No preview documents found`);
    return { processed: 0, updated: 0, skipped: 0 };
  }
  
  console.log(`  Found ${previews.length} preview document(s)`);
  
  // Filter previews that need lutFilePath
  const previewsNeedingUpdate = previews.filter(p => !p.lutFilePath || !p.fileName);
  console.log(`  ${previewsNeedingUpdate.length} preview(s) need file path update`);
  
  if (previewsNeedingUpdate.length === 0) {
    console.log(`  ✓ All previews already have file paths`);
    return { processed: previews.length, updated: 0, skipped: previews.length };
  }
  
  // Get all .cube files in the pack folder
  const packPath = `assets/luts/${packName}/`;
  const [files] = await bucket.getFiles({ prefix: packPath });
  
  const cubeFiles = files
    .filter(file => path.extname(file.name).toLowerCase() === '.cube')
    .map(file => {
      const fileName = path.basename(file.name);
      return {
        fileName,
        storagePath: file.name,
        normalizedName: normalizeLUTName(fileName.replace('.cube', '')),
      };
    });
  
  if (cubeFiles.length === 0) {
    console.log(`  ⚠ No .cube files found in ${packPath}`);
    return { processed: previewsNeedingUpdate.length, updated: 0, skipped: previewsNeedingUpdate.length };
  }
  
  console.log(`  Found ${cubeFiles.length} .cube file(s) in Storage`);
  
  // Match and update
  let updated = 0;
  let skipped = 0;
  
  for (const preview of previewsNeedingUpdate) {
    const matchingCubeFile = findMatchingCubeFile(preview, cubeFiles);
    
    if (matchingCubeFile) {
      if (dryRun) {
        console.log(`    [DRY RUN] Would update "${preview.lutName}" → ${matchingCubeFile.fileName}`);
      } else {
        await db
          .collection('assets')
          .doc(assetId)
          .collection('lutPreviews')
          .doc(preview.id)
          .update({
            lutFilePath: matchingCubeFile.storagePath,
            fileName: matchingCubeFile.fileName,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        console.log(`    ✓ Updated "${preview.lutName}" → ${matchingCubeFile.fileName}`);
      }
      updated++;
    } else {
      console.log(`    ⚠ No matching .cube file found for: "${preview.lutName}"`);
      skipped++;
    }
  }
  
  return { processed: previewsNeedingUpdate.length, updated, skipped };
}

/**
 * Update all LUT assets
 */
async function updateAllAssets(dryRun = false) {
  console.log('=== Update LUT Preview File Paths ===\n');
  
  if (dryRun) {
    console.log('🔍 DRY RUN MODE - No documents will be updated\n');
  }
  
  // Get all LUT assets
  const assetsSnap = await db
    .collection('assets')
    .where('category', '==', 'LUTs & Presets')
    .get();
  
  if (assetsSnap.empty) {
    console.log('No LUT assets found');
    return;
  }
  
  console.log(`Found ${assetsSnap.size} LUT asset(s)\n`);
  
  let totalProcessed = 0;
  let totalUpdated = 0;
  let totalSkipped = 0;
  
  for (const doc of assetsSnap.docs) {
    const result = await updateAssetPreviews(doc.id, dryRun);
    totalProcessed += result.processed;
    totalUpdated += result.updated;
    totalSkipped += result.skipped;
  }
  
  console.log(`\n=== Summary ===`);
  console.log(`Processed: ${totalProcessed}`);
  console.log(`Updated: ${totalUpdated}`);
  console.log(`Skipped: ${totalSkipped}`);
  
  if (dryRun) {
    console.log(`\n[DRY RUN] No documents were actually updated. Run without --dry-run to update documents.`);
  }
}

/**
 * Main function
 */
async function main() {
  const assetId = getArg('assetId', null);
  const all = hasFlag('all');
  const dryRun = hasFlag('dry-run');
  
  if (!assetId && !all) {
    console.log('Usage:');
    console.log('  node scripts/update-lut-preview-file-paths.js --assetId=xxx [--dry-run]');
    console.log('  node scripts/update-lut-preview-file-paths.js --all [--dry-run]');
    console.log('\nOptions:');
    console.log('  --assetId=xxx    Update only this specific asset');
    console.log('  --all            Update all LUT assets');
    console.log('  --dry-run        Show what would be updated without updating');
    process.exit(1);
  }
  
  try {
    if (assetId) {
      await updateAssetPreviews(assetId, dryRun);
    } else if (all) {
      await updateAllAssets(dryRun);
    }
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();

