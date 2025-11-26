#!/usr/bin/env node
/*
  Create Firestore documents for LUT preview videos in Storage and extract .cube files from ZIPs
  
  This script:
  1. Scans Firebase Storage for LUT preview videos in assets/luts folders
  2. Groups videos by LUT name (folder structure: assets/luts/{pack}/{lut}/before.mp4 and after.mp4)
  3. Finds matching asset documents in Firestore
  4. Creates lutPreviews documents with beforeVideoPath and afterVideoPath
  5. Extracts .cube files from ZIP files (only from CUBE folders)
  6. Matches .cube files to preview documents by LUT name
  7. Updates preview documents with lutFilePath and fileName for individual downloads
  
  Requirements:
  - FIREBASE_ADMIN_PROJECT_ID
  - FIREBASE_ADMIN_CLIENT_EMAIL
  - FIREBASE_ADMIN_PRIVATE_KEY
  - npm packages: yauzl, fs-extra
  
  Usage:
    node scripts/create-lut-previews-from-storage.js [--assetId=xxx] [--all] [--dry-run]
    
  Options:
    --assetId=xxx    Process only this specific asset
    --all            Process all LUT assets
    --dry-run        Show what would be created without actually creating documents
*/

// Load env from .env.local first, then fallback to .env
try {
  require('dotenv').config({ path: '.env.local' });
} catch {}
require('dotenv').config();

const admin = require('firebase-admin');
const path = require('path');
const yauzl = require('yauzl');
const fs = require('fs-extra');
const os = require('os');

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
 * Extract LUT name from storage path
 * "assets/luts/pack-name/lut-name/before.mp4" -> "lut-name"
 */
function getLUTName(storagePath) {
  const parts = storagePath.split('/');
  // Only return LUT name if there's a subdirectory: assets/luts/{pack}/{lut}/file.mp4
  // For files directly in pack: assets/luts/{pack}/file.mp4, return null
  if (parts.length >= 5 && parts[0] === 'assets' && parts[1] === 'luts') {
    return parts[3]; // LUT folder name (4th part, 0-indexed)
  }
  return null;
}

/**
 * Extract pack name from storage path
 * "assets/luts/pack-name/lut-name/before.mp4" -> "pack-name"
 */
function getPackName(storagePath) {
  const parts = storagePath.split('/');
  if (parts.length >= 4 && parts[0] === 'assets' && parts[1] === 'luts') {
    return parts[2]; // Pack folder name
  }
  return null;
}

/**
 * Extract folder name from storage path
 * "assets/luts/Thermal Vision - LUTs Collection.zip" -> "Thermal Vision - LUTs Collection"
 */
function getFolderNameFromStoragePath(storagePath) {
  if (!storagePath) return null;
  const path = require('path');
  const fileName = path.basename(storagePath);
  // Remove .zip extension
  return fileName.replace(/\.zip$/i, '');
}

/**
 * Find matching asset document by pack name or storage path
 */
async function findAssetByPackName(packName) {
  // Search for LUT assets
  const assetsSnap = await db
    .collection('assets')
    .where('category', '==', 'LUTs & Presets')
    .get();

  const packNameLower = packName.toLowerCase().trim();
  
  for (const doc of assetsSnap.docs) {
    const assetData = doc.data();
    const assetTitle = (assetData.title || '').toLowerCase().trim();
    const assetStoragePath = assetData.storagePath || '';
    
    // Extract folder name from storagePath (most reliable match)
    const storageFolderName = getFolderNameFromStoragePath(assetStoragePath);
    const storageFolderLower = storageFolderName ? storageFolderName.toLowerCase().trim() : '';
    
    // Normalize pack name for comparison (remove extra spaces, normalize dashes)
    const normalizedPackName = packNameLower.replace(/\s+/g, ' ').replace(/[-_]/g, '-');
    const normalizedTitle = assetTitle.replace(/\s+/g, ' ').replace(/[-_]/g, '-');
    const normalizedStorageFolder = storageFolderLower.replace(/\s+/g, ' ').replace(/[-_]/g, '-');
    
    // Priority 1: Match by storagePath folder name (most reliable)
    if (storageFolderLower && normalizedPackName === normalizedStorageFolder) {
      return { id: doc.id, ...assetData };
    }
    
    // Priority 2: Match if storagePath contains pack name
    if (storageFolderLower && storageFolderLower.includes(packNameLower)) {
      return { id: doc.id, ...assetData };
    }
    
    // Priority 3: Match if pack name contains storage folder name
    if (storageFolderLower && packNameLower.includes(storageFolderLower)) {
      return { id: doc.id, ...assetData };
    }
    
    // Priority 4: Match by title
    if (normalizedPackName === normalizedTitle || 
        assetTitle.includes(packNameLower) ||
        packNameLower.includes(assetTitle.replace(/\s+/g, ''))) {
      return { id: doc.id, ...assetData };
    }
  }
  
  return null;
}

/**
 * Check if LUT preview document already exists in subcollection
 */
async function lutPreviewExists(assetId, lutName) {
  // Check subcollection first (preferred location)
  const subcollectionDocs = await db
    .collection('assets')
    .doc(assetId)
    .collection('lutPreviews')
    .where('lutName', '==', lutName)
    .limit(1)
    .get();

  if (!subcollectionDocs.empty) {
    return { exists: true, doc: subcollectionDocs.docs[0], location: 'subcollection' };
  }

  // Also check flat collection for legacy documents
  const flatDocs = await db
    .collection('lutPreviews')
    .where('assetId', '==', assetId)
    .where('lutName', '==', lutName)
    .limit(1)
    .get();

  if (!flatDocs.empty) {
    return { exists: true, doc: flatDocs.docs[0], location: 'flat' };
  }

  return { exists: false };
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
 * Extract .cube files from ZIP, only from CUBE folders
 */
function unzipCubeFiles(zipPath, extractTo) {
  return new Promise((resolve, reject) => {
    yauzl.open(zipPath, { lazyEntries: true }, (err, zipfile) => {
      if (err) return reject(err);
      
      const cubeFiles = [];
      
      zipfile.readEntry();
      
      zipfile.on('entry', (entry) => {
        const entryPath = entry.fileName;
        
        // Skip directories
        if (/\/$/.test(entryPath)) {
          zipfile.readEntry();
          return;
        }
        
        // Skip macOS metadata files
        if (entryPath.includes('/._') || path.basename(entryPath).startsWith('._')) {
          zipfile.readEntry();
          return;
        }
        
        // Only process files in folders containing "CUBE" (case-insensitive)
        const pathParts = entryPath.split('/');
        const isInCubeFolder = pathParts.some(part => 
          part.toLowerCase().includes('cube') && part.toLowerCase() !== '.cube'
        );
        
        if (!isInCubeFolder) {
          zipfile.readEntry();
          return;
        }
        
        // Only extract .cube files
        const ext = path.extname(entryPath).toLowerCase();
        if (ext !== '.cube') {
          zipfile.readEntry();
          return;
        }
        
        const fileName = path.basename(entryPath);
        const extractPath = path.join(extractTo, fileName);
        
        zipfile.openReadStream(entry, (err, readStream) => {
          if (err) {
            zipfile.readEntry();
            return;
          }
          
          fs.ensureDirSync(path.dirname(extractPath));
          const writeStream = fs.createWriteStream(extractPath);
          readStream.pipe(writeStream);
          
          writeStream.on('close', () => {
            cubeFiles.push({
              fileName,
              localPath: extractPath,
              normalizedName: normalizeLUTName(fileName.replace('.cube', '')),
            });
            zipfile.readEntry();
          });
        });
      });
      
      zipfile.on('end', () => resolve(cubeFiles));
      zipfile.on('error', reject);
    });
  });
}

/**
 * Match .cube file to preview document by LUT name
 */
function findMatchingPreview(cubeFile, previews) {
  const cubeName = cubeFile.normalizedName;
  
  // Try exact match first
  for (const preview of previews) {
    const previewName = normalizeLUTName(preview.lutName);
    if (previewName === cubeName) {
      return preview;
    }
  }
  
  // Try partial match (cube file contains preview name or vice versa)
  for (const preview of previews) {
    const previewName = normalizeLUTName(preview.lutName);
    if (cubeName.includes(previewName) || previewName.includes(cubeName)) {
      return preview;
    }
  }
  
  return null;
}

/**
 * Process ZIP file and extract .cube files, then update preview documents
 */
async function processLUTZipFile(asset, packName, dryRun = false) {
  const zipPath = `assets/luts/${packName}.zip`;
  const zipFile = bucket.file(zipPath);
  const [zipExists] = await zipFile.exists();
  
  if (!zipExists) {
    console.log(`  ℹ No ZIP file found at ${zipPath}, skipping extraction`);
    return { extracted: 0, matched: 0, updated: 0 };
  }
  
  console.log(`  📦 Found ZIP file, extracting .cube files from CUBE folder...`);
  
  const tempDir = path.join(os.tmpdir(), `lut-extract-${Date.now()}`);
  const zipLocalPath = path.join(tempDir, 'asset.zip');
  const extractDir = path.join(tempDir, 'extracted');
  
  try {
    // Download ZIP
    await fs.ensureDir(path.dirname(zipLocalPath));
    await zipFile.download({ destination: zipLocalPath });
    
    // Extract .cube files (only from CUBE folders)
    const cubeFiles = await unzipCubeFiles(zipLocalPath, extractDir);
    
    if (cubeFiles.length === 0) {
      console.log(`  ⚠ No .cube files found in CUBE folder`);
      return { extracted: 0, matched: 0, updated: 0 };
    }
    
    console.log(`  Found ${cubeFiles.length} .cube file(s) in CUBE folder`);
    
    // Get existing preview documents
    const previewsSnap = await db
      .collection('assets')
      .doc(asset.id)
      .collection('lutPreviews')
      .get();
    
    const previews = previewsSnap.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));
    
    if (previews.length === 0) {
      console.log(`  ⚠ No preview documents found, create previews first`);
      return { extracted: cubeFiles.length, matched: 0, updated: 0 };
    }
    
    // Upload .cube files and match to previews
    let matched = 0;
    let updated = 0;
    
    for (const cubeFile of cubeFiles) {
      const storagePath = `assets/luts/${packName}/${cubeFile.fileName}`;
      
      // Check if file already exists in Storage
      const existingFile = bucket.file(storagePath);
      const [exists] = await existingFile.exists();
      
      if (!exists) {
        if (dryRun) {
          console.log(`    [DRY RUN] Would upload: ${storagePath}`);
        } else {
          // Upload .cube file to Storage
          await existingFile.save(await fs.readFile(cubeFile.localPath), {
            metadata: {
              contentType: 'application/octet-stream',
            },
          });
          console.log(`    ✓ Uploaded: ${cubeFile.fileName}`);
        }
      } else {
        console.log(`    ⏭ Already exists: ${cubeFile.fileName}`);
      }
      
      // Find matching preview document
      const matchingPreview = findMatchingPreview(cubeFile, previews);
      
      if (matchingPreview) {
        // Check if preview already has lutFilePath
        if (matchingPreview.lutFilePath && matchingPreview.lutFilePath === storagePath) {
          console.log(`    ⏭ Preview "${matchingPreview.lutName}" already has correct file path`);
          matched++;
          continue;
        }
        
        if (dryRun) {
          console.log(`    [DRY RUN] Would update preview "${matchingPreview.lutName}" with file: ${cubeFile.fileName}`);
        } else {
          // Update preview document
          await db
            .collection('assets')
            .doc(asset.id)
            .collection('lutPreviews')
            .doc(matchingPreview.id)
            .update({
              lutFilePath: storagePath,
              fileName: cubeFile.fileName,
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
          console.log(`    ✓ Matched "${matchingPreview.lutName}" → ${cubeFile.fileName}`);
        }
        matched++;
        updated++;
      } else {
        console.log(`    ⚠ No matching preview found for: ${cubeFile.fileName}`);
      }
    }
    
    return { extracted: cubeFiles.length, matched, updated };
    
  } catch (error) {
    console.error(`  ✗ Error processing ZIP:`, error);
    return { extracted: 0, matched: 0, updated: 0 };
  } finally {
    // Cleanup temp directory
    await fs.remove(tempDir).catch(() => {});
  }
}

/**
 * Create LUT preview document in subcollection
 */
async function createLUTPreview(assetId, assetTitle, lutName, beforePath, afterPath, dryRun) {
  console.log(`    Creating LUT preview: ${lutName}`);
  console.log(`      Before: ${beforePath}`);
  console.log(`      After: ${afterPath}`);

  if (dryRun) {
    console.log(`      [DRY RUN] Would create Firestore document in assets/${assetId}/lutPreviews/`);
    return { success: true, reason: 'dry_run' };
  }

  const previewData = {
    assetId: assetId,
    assetTitle: assetTitle,
    lutName: lutName,
    beforeVideoPath: beforePath,
    afterVideoPath: afterPath,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  // Create in subcollection: assets/{assetId}/lutPreviews/{previewId}
  const previewRef = await db
    .collection('assets')
    .doc(assetId)
    .collection('lutPreviews')
    .add(previewData);
  
  console.log(`      ✓ Created: assets/${assetId}/lutPreviews/${previewRef.id}`);
  return { success: true, previewId: previewRef.id };
}

/**
 * Process a pack folder to find LUT previews
 */
async function processPackFolder(packName, dryRun = false) {
  console.log(`\n📁 Processing pack: "${packName}"`);

  // Get all files in this pack folder
  const packPath = `assets/luts/${packName}/`;
  const [files] = await bucket.getFiles({ prefix: packPath });

  if (files.length === 0) {
    console.log(`  No files found in ${packPath}`);
    return { processed: 0, created: 0, skipped: 0 };
  }

  // Find or create asset first
  const asset = await findAssetByPackName(packName);
  
  if (!asset) {
    console.log(`  ⚠ Warning: No matching asset found for pack "${packName}"`);
    console.log(`  Skipping preview creation. Create asset document first or check pack name matching.`);
    return { processed: 0, created: 0, skipped: 0 };
  }

  console.log(`  Asset: "${asset.title}" (${asset.id})`);

  // Group files by subdirectory (LUT name) or by base filename
  // Structure: assets/luts/{pack}/{lut}/before.mp4 OR assets/luts/{pack}/name-before.mp4
  const lutGroups = new Map();
  const videoExtensions = ['.mp4', '.mov', '.avi', '.mkv', '.webm', '.m4v'];

  for (const file of files) {
    const fileName = path.basename(file.name);
    const fileExt = path.extname(fileName).toLowerCase();
    
    // Skip non-video files
    if (!videoExtensions.includes(fileExt)) {
      continue;
    }

    // Get LUT name from path structure
    // assets/luts/{pack}/{lut}/before.mp4 -> {lut}
    const lutName = getLUTName(file.name);
    
    if (lutName) {
      // Normal structure: files in subdirectory
      if (!lutGroups.has(lutName)) {
        lutGroups.set(lutName, {
          lutName,
          before: null,
          after: null,
        });
      }

      const group = lutGroups.get(lutName);

      if (fileName.toLowerCase() === 'before.mp4' || 
          fileName.toLowerCase().includes('before') ||
          fileName.toLowerCase().match(/^before/i)) {
        group.before = file.name;
      } else if (fileName.toLowerCase() === 'after.mp4' || 
                 fileName.toLowerCase().includes('after') ||
                 fileName.toLowerCase().match(/^after/i)) {
        group.after = file.name;
      }
    } else {
      // Files directly in pack folder - need to group by base name
      // assets/luts/{pack}/name-before.mp4 and name-after.mp4 -> group as "name"
      const relativePath = file.name.replace(packPath, '');
      const isDirectInPack = !relativePath.includes('/');
      
      if (isDirectInPack) {
        const fileNameLower = fileName.toLowerCase();
        const fileNameNoExt = fileName.replace(/\.(mp4|mov|avi|mkv|webm|m4v)$/i, '');
        const fileNameNoExtLower = fileNameNoExt.toLowerCase();
        
        // Extract base name by removing before/after suffix
        // Handle patterns like: "name-before.mp4", "name_before.mp4", "before.mp4", "Thermal-rectolog_compressed-before.mp4"
        let baseName = fileNameNoExt;
        const originalBaseName = baseName;
        
        // Check if filename ends with before/after (case insensitive) and remove it
        const lowerBaseName = baseName.toLowerCase();
        
        // Try to remove suffix - check most specific patterns first
        if (lowerBaseName.endsWith('-before')) {
          baseName = baseName.slice(0, -7).trim(); // Remove "-before" (7 chars: -before)
        } else if (lowerBaseName.endsWith('_before')) {
          baseName = baseName.slice(0, -7).trim(); // Remove "_before" (7 chars: _before)
        } else if (lowerBaseName.endsWith('-after')) {
          baseName = baseName.slice(0, -6).trim(); // Remove "-after" (6 chars: -after)
        } else if (lowerBaseName.endsWith('_after')) {
          baseName = baseName.slice(0, -6).trim(); // Remove "_after" (6 chars: _after)
        } else if (lowerBaseName === 'before' || lowerBaseName === 'after') {
          baseName = ''; // Standalone before/after file
        } else if (lowerBaseName.endsWith('before')) {
          baseName = baseName.slice(0, -6).trim(); // Remove "before" (6 chars)
        } else if (lowerBaseName.endsWith('after')) {
          baseName = baseName.slice(0, -5).trim(); // Remove "after" (5 chars)
        }
        
        // If base name extraction didn't work, log for debugging
        if (baseName === originalBaseName && baseName.toLowerCase() !== 'before' && baseName.toLowerCase() !== 'after') {
          console.log(`    ⚠ Warning: Could not extract base name from "${fileName}" - using full filename`);
        }
        
        // If base name is empty or just "before"/"after", it was a standalone file - use pack name
        if (!baseName || baseName.length === 0 || baseName.toLowerCase() === 'before' || baseName.toLowerCase() === 'after') {
          baseName = packName;
        } else {
          // Clean up the base name - make it more readable
          // Replace underscores and multiple dashes with single dash
          baseName = baseName.replace(/[_\s]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
        }

        // Now check if this is a "before" or "after" video
        const isBefore = fileNameLower === 'before.mp4' ||
                        fileNameLower === 'before' ||
                        fileNameNoExtLower.endsWith('-before') ||
                        fileNameNoExtLower.endsWith('_before') ||
                        fileNameNoExtLower === 'before';
        
        const isAfter = fileNameLower === 'after.mp4' ||
                       fileNameLower === 'after' ||
                       fileNameNoExtLower.endsWith('-after') ||
                       fileNameNoExtLower.endsWith('_after') ||
                       fileNameNoExtLower === 'after';

        if (!lutGroups.has(baseName)) {
          lutGroups.set(baseName, {
            lutName: baseName,
            before: null,
            after: null,
          });
        }

        const group = lutGroups.get(baseName);
        
        if (isBefore) {
          group.before = file.name;
        } else if (isAfter) {
          group.after = file.name;
        }
      }
    }
  }

  console.log(`  Found ${lutGroups.size} potential LUT preview(s)`);

  // Debug: Show what we found
  if (lutGroups.size > 0) {
    console.log(`  Preview groups:`);
    for (const [lutName, group] of lutGroups) {
      const beforeStatus = group.before ? `✓ ${path.basename(group.before)}` : '✗ NOT FOUND';
      const afterStatus = group.after ? `✓ ${path.basename(group.after)}` : '✗ NOT FOUND';
      console.log(`    - "${lutName}": before=${beforeStatus}, after=${afterStatus}`);
    }
  }

  let processed = 0;
  let created = 0;
  let skipped = 0;

  // Process each LUT group
  for (const [lutName, group] of lutGroups) {
    processed++;

    if (!group.before || !group.after) {
      console.log(`  ⚠ Skipping "${lutName}": Missing before or after video`);
      console.log(`      Before: ${group.before || 'NOT FOUND'}`);
      console.log(`      After: ${group.after || 'NOT FOUND'}`);
      skipped++;
      continue;
    }

    // Check if document already exists
    const exists = await lutPreviewExists(asset.id, lutName);
    
    if (exists.exists) {
      console.log(`  ⏭ Skipping "${lutName}": Document already exists`);
      skipped++;
      continue;
    }

    // Create new document
    const result = await createLUTPreview(
      asset.id,
      asset.title,
      lutName,
      group.before,
      group.after,
      dryRun
    );

    if (result.success && result.reason !== 'dry_run') {
      created++;
    } else if (result.reason === 'dry_run') {
      created++;
    }
  }

  // After creating/updating preview documents, process ZIP file
  const zipResult = await processLUTZipFile(asset, packName, dryRun);
  
  return { 
    processed, 
    created, 
    skipped,
    extracted: zipResult.extracted,
    matched: zipResult.matched,
    updated: zipResult.updated,
  };
}

/**
 * Process all LUT assets from Firestore
 */
async function processAllAssets(dryRun = false) {
  console.log('=== Create LUT Previews from Storage ===\n');

  // Get all LUT assets
  const assetsSnap = await db
    .collection('assets')
    .where('category', '==', 'LUTs & Presets')
    .get();

  if (assetsSnap.empty) {
    console.log('No LUT assets found in Firestore');
    return;
  }

  console.log(`Found ${assetsSnap.size} LUT asset(s)\n`);

  let totalProcessed = 0;
  let totalCreated = 0;
  let totalSkipped = 0;

  // First, process legacy assets (with videos directly on asset document)
  const legacyAssets = [];
  const regularAssets = [];

  assetsSnap.docs.forEach(doc => {
    const asset = { id: doc.id, ...doc.data() };
    if (asset.beforeVideoPath && asset.afterVideoPath) {
      legacyAssets.push(asset);
    } else {
      regularAssets.push(asset);
    }
  });

  if (legacyAssets.length > 0) {
    console.log(`Processing ${legacyAssets.length} legacy asset(s) with videos on document...\n`);
    for (const asset of legacyAssets) {
      const result = await processLegacyAsset(asset, dryRun);
      totalProcessed += result.processed;
      totalCreated += result.created;
      totalSkipped += result.skipped;
    }
  }

  // Then process assets by scanning Storage folders
  if (regularAssets.length > 0) {
    console.log(`\nProcessing ${regularAssets.length} asset(s) by scanning Storage...\n`);
    
    // Get all folders in assets/luts/
    const [files] = await bucket.getFiles({ prefix: 'assets/luts/' });
    
    // Extract unique pack names
    const packNames = new Set();
    
    for (const file of files) {
      const packName = getPackName(file.name);
      if (packName) {
        packNames.add(packName);
      }
    }

    if (packNames.size > 0) {
      console.log(`Found ${packNames.size} pack folder(s) in Storage\n`);
      
      let totalExtracted = 0;
      let totalMatched = 0;
      let totalUpdated = 0;
      
      for (const packName of packNames) {
        const result = await processPackFolder(packName, dryRun);
        totalProcessed += result.processed;
        totalCreated += result.created;
        totalSkipped += result.skipped;
        totalExtracted += result.extracted || 0;
        totalMatched += result.matched || 0;
        totalUpdated += result.updated || 0;
      }
      
      if (totalExtracted > 0 || totalMatched > 0) {
        console.log(`\n=== ZIP Processing Summary ===`);
        console.log(`Extracted .cube files: ${totalExtracted}`);
        console.log(`Matched to previews: ${totalMatched}`);
        console.log(`Updated preview documents: ${totalUpdated}`);
      }
    }
  }

  console.log(`\n=== Summary ===`);
  console.log(`Processed: ${totalProcessed}`);
  console.log(`Created: ${totalCreated}`);
  console.log(`Skipped: ${totalSkipped}`);
  
  if (dryRun) {
    console.log(`\n[DRY RUN] No documents were actually created. Run without --dry-run to create documents.`);
  }
}

/**
 * Process legacy asset with beforeVideoPath/afterVideoPath directly on asset document
 */
async function processLegacyAsset(asset, dryRun = false) {
  console.log(`\n📦 Processing legacy asset: "${asset.title}" (${asset.id})`);

  if (!asset.beforeVideoPath || !asset.afterVideoPath) {
    console.log(`  ⚠ Skipping: No beforeVideoPath or afterVideoPath found`);
    return { processed: 0, created: 0, skipped: 0 };
  }

  // Extract LUT name from video path or use asset title
  const lutName = getLUTName(asset.beforeVideoPath) || 
                  path.basename(asset.beforeVideoPath, path.extname(asset.beforeVideoPath)).replace('before', '').trim() ||
                  asset.title;

  // Check if document already exists
  const exists = await lutPreviewExists(asset.id, lutName);
  
  if (exists.exists) {
    console.log(`  ⏭ Skipping: Document already exists for "${lutName}"`);
    return { processed: 1, created: 0, skipped: 1 };
  }

  // Create preview document
  const result = await createLUTPreview(
    asset.id,
    asset.title,
    lutName,
    asset.beforeVideoPath,
    asset.afterVideoPath,
    dryRun
  );

  if (result.success && result.reason !== 'dry_run') {
    return { processed: 1, created: 1, skipped: 0 };
  } else if (result.reason === 'dry_run') {
    return { processed: 1, created: 1, skipped: 0 };
  }

  return { processed: 1, created: 0, skipped: 0 };
}

/**
 * Process a specific asset
 */
async function processAsset(assetId, dryRun = false) {
  console.log('=== Create LUT Previews from Storage ===\n');

  const assetDoc = await db.collection('assets').doc(assetId).get();
  
  if (!assetDoc.exists) {
    console.error(`Asset not found: ${assetId}`);
    process.exit(1);
  }

  const asset = { id: assetDoc.id, ...assetDoc.data() };

  if (asset.category !== 'LUTs & Presets') {
    console.error(`Asset is not a LUT asset: ${asset.category}`);
    process.exit(1);
  }

  console.log(`Processing asset: "${asset.title}" (${assetId})\n`);

  // First check if this is a legacy asset with videos directly on the document
  if (asset.beforeVideoPath && asset.afterVideoPath) {
    console.log('  Found legacy video paths on asset document');
    const result = await processLegacyAsset(asset, dryRun);
    console.log(`\n=== Summary ===`);
    console.log(`Processed: ${result.processed}`);
    console.log(`Created: ${result.created}`);
    console.log(`Skipped: ${result.skipped}`);
    if (dryRun) {
      console.log(`\n[DRY RUN] No documents were actually created. Run without --dry-run to create documents.`);
    }
    return;
  }

  // Otherwise, try to find videos in Storage by pack name
  const packName = asset.storagePath 
    ? path.basename(asset.storagePath, path.extname(asset.storagePath))
    : asset.title.toLowerCase().replace(/\s+/g, '-');

  const result = await processPackFolder(packName, dryRun);

  console.log(`\n=== Summary ===`);
  console.log(`Processed: ${result.processed}`);
  console.log(`Created: ${result.created}`);
  console.log(`Skipped: ${result.skipped}`);
  
  if (dryRun) {
    console.log(`\n[DRY RUN] No documents were actually created. Run without --dry-run to create documents.`);
  }
}

/**
 * Main function
 */
async function main() {
  const assetId = getArg('assetId', null);
  const all = hasFlag('all');
  const dryRun = hasFlag('dry-run');

  if (dryRun) {
    console.log('🔍 DRY RUN MODE - No documents will be created\n');
  }

  try {
    if (assetId) {
      await processAsset(assetId, dryRun);
    } else if (all) {
      await processAllAssets(dryRun);
    } else {
      console.log('Usage:');
      console.log('  node scripts/create-lut-previews-from-storage.js --assetId=xxx [--dry-run]');
      console.log('  node scripts/create-lut-previews-from-storage.js --all [--dry-run]');
      console.log('\nOptions:');
      console.log('  --assetId=xxx    Process only this specific asset');
      console.log('  --all            Process all LUT assets (from Firestore and Storage)');
      console.log('  --dry-run        Show what would be created without creating documents');
      console.log('\nThis script will:');
      console.log('  1. Process legacy assets with beforeVideoPath/afterVideoPath on asset document');
      console.log('  2. Scan Storage for videos in assets/luts/{pack}/{lut}/ folders');
      console.log('  3. Create lutPreviews documents for each found LUT');
      process.exit(1);
    }
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();

