#!/usr/bin/env node
/*
  Create Firestore documents for specific LUT previews from .cube files
  
  This script creates lutPreviews documents for LUT files that don't have
  video previews yet, linking them to their .cube files in Storage.
  
  Usage:
    node scripts/create-lut-preview-docs.js --assetId=xxx --lutFiles=file1.cube,file2.cube [--dry-run]
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
 * Normalize LUT name (remove .cube extension, clean up)
 */
function normalizeLUTName(fileName) {
  return fileName
    .replace(/\.cube$/i, '')
    .trim();
}

/**
 * Create LUT preview document
 */
async function createLUTPreviewDoc(assetId, assetTitle, lutName, lutFilePath, fileName, dryRun) {
  console.log(`  Creating preview for: ${lutName}`);
  console.log(`    File: ${fileName}`);
  console.log(`    Path: ${lutFilePath}`);

  if (dryRun) {
    console.log(`    [DRY RUN] Would create Firestore document`);
    return { success: true, reason: 'dry_run' };
  }

  // Check if document already exists
  const existing = await db
    .collection('assets')
    .doc(assetId)
    .collection('lutPreviews')
    .where('lutName', '==', lutName)
    .limit(1)
    .get();

  if (!existing.empty) {
    const existingDoc = existing.docs[0];
    const existingData = existingDoc.data();
    
    // Update if lutFilePath is missing or different
    if (!existingData.lutFilePath || existingData.lutFilePath !== lutFilePath) {
      await db
        .collection('assets')
        .doc(assetId)
        .collection('lutPreviews')
        .doc(existingDoc.id)
        .update({
          lutFilePath: lutFilePath,
          fileName: fileName,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      console.log(`    ✓ Updated existing document: ${existingDoc.id}`);
      return { success: true, previewId: existingDoc.id, updated: true };
    } else {
      console.log(`    ⏭ Already exists with correct file path: ${existingDoc.id}`);
      return { success: true, previewId: existingDoc.id, updated: false };
    }
  }

  const previewData = {
    assetId: assetId,
    assetTitle: assetTitle,
    lutName: lutName,
    lutFilePath: lutFilePath,
    fileName: fileName,
    // No video previews yet - these can be added later
    beforeVideoPath: null,
    afterVideoPath: null,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  const previewRef = await db
    .collection('assets')
    .doc(assetId)
    .collection('lutPreviews')
    .add(previewData);
  
  console.log(`    ✓ Created: assets/${assetId}/lutPreviews/${previewRef.id}`);
  return { success: true, previewId: previewRef.id };
}

/**
 * Main function
 */
async function main() {
  const assetId = getArg('assetId', null);
  const lutFilesArg = getArg('lutFiles', null);
  const dryRun = hasFlag('dry-run');

  if (dryRun) {
    console.log('🔍 DRY RUN MODE - No documents will be created\n');
  }

  if (!assetId) {
    console.error('Error: --assetId is required');
    console.log('\nUsage:');
    console.log('  node scripts/create-lut-preview-docs.js --assetId=xxx --lutFiles=file1.cube,file2.cube [--dry-run]');
    process.exit(1);
  }

  if (!lutFilesArg) {
    console.error('Error: --lutFiles is required');
    console.log('\nUsage:');
    console.log('  node scripts/create-lut-preview-docs.js --assetId=xxx --lutFiles=file1.cube,file2.cube [--dry-run]');
    process.exit(1);
  }

  try {
    // Get asset document
    const assetDoc = await db.collection('assets').doc(assetId).get();
    
    if (!assetDoc.exists) {
      console.error(`Error: Asset not found: ${assetId}`);
      process.exit(1);
    }

    const asset = { id: assetDoc.id, ...assetDoc.data() };
    console.log(`\nProcessing asset: "${asset.title}" (${assetId})\n`);

    // Parse LUT file names
    const lutFiles = lutFilesArg.split(',').map(f => f.trim()).filter(f => f);
    
    if (lutFiles.length === 0) {
      console.error('Error: No LUT files specified');
      process.exit(1);
    }

    console.log(`Found ${lutFiles.length} LUT file(s) to process\n`);

    // Get pack name from asset storagePath
    const packName = asset.storagePath 
      ? path.basename(asset.storagePath, path.extname(asset.storagePath))
      : asset.title;

    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (const fileName of lutFiles) {
      const lutName = normalizeLUTName(fileName);
      const storagePath = `assets/luts/${packName}/${fileName}`;

      // Verify file exists in Storage
      const file = bucket.file(storagePath);
      const [exists] = await file.exists();

      if (!exists) {
        console.log(`  ⚠ Skipping "${lutName}": File not found at ${storagePath}`);
        skipped++;
        continue;
      }

      const result = await createLUTPreviewDoc(
        assetId,
        asset.title,
        lutName,
        storagePath,
        fileName,
        dryRun
      );

      if (result.success) {
        if (result.updated) {
          updated++;
        } else if (result.reason !== 'dry_run') {
          created++;
        } else {
          created++; // Count dry-run as created for summary
        }
      } else {
        skipped++;
      }
    }

    console.log(`\n=== Summary ===`);
    console.log(`Created: ${created}`);
    console.log(`Updated: ${updated}`);
    console.log(`Skipped: ${skipped}`);

    if (dryRun) {
      console.log(`\n[DRY RUN] No documents were actually created. Run without --dry-run to create documents.`);
    }

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();

