#!/usr/bin/env node
/*
  Unzip LUT asset ZIP files and extract individual .cube files to Firebase Storage
  
  This script:
  1. Gets all LUT assets from Firestore
  2. Downloads ZIP files from Firebase Storage
  3. Extracts ALL .cube files from anywhere in the ZIP
  4. Uploads .cube files to assets/luts/{packName}/ folder
  5. Creates lutPreview documents for each .cube file found
  
  Requirements:
  - FIREBASE_ADMIN_PROJECT_ID
  - FIREBASE_ADMIN_CLIENT_EMAIL
  - FIREBASE_ADMIN_PRIVATE_KEY
  - npm packages: yauzl, fs-extra
  
  Usage:
    node scripts/unzip-lut-assets.js [--assetId=xxx] [--all] [--dry-run]
  
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
const yauzl = require('yauzl');
const fs = require('fs-extra');
const path = require('path');
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
 * Extract folder name from storage path
 * "assets/luts/Pack Name.zip" -> "Pack Name"
 */
function getFolderNameFromStoragePath(storagePath) {
  const fileName = path.basename(storagePath);
  // Remove .zip extension
  return fileName.replace(/\.zip$/i, '');
}

/**
 * Normalize LUT name for matching
 */
function normalizeLUTName(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

/**
 * Extract ALL .cube files from ZIP (from anywhere in the ZIP)
 */
function unzipAllCubeFiles(zipPath, extractTo) {
  return new Promise((resolve, reject) => {
    yauzl.open(zipPath, { lazyEntries: true }, (err, zipfile) => {
      if (err) return reject(err);
      
      const cubeFiles = [];
      let pendingReads = 0;
      
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
        
        // Only extract .cube files
        const ext = path.extname(entryPath).toLowerCase();
        if (ext !== '.cube') {
          zipfile.readEntry();
          return;
        }
        
        const fileName = path.basename(entryPath);
        const extractPath = path.join(extractTo, fileName);
        
        pendingReads++;
        zipfile.openReadStream(entry, (err, readStream) => {
          if (err) {
            console.error(`Error reading ${entryPath}:`, err);
            pendingReads--;
            if (pendingReads === 0) {
              resolve(cubeFiles);
            }
            zipfile.readEntry();
            return;
          }
          
          fs.ensureDirSync(path.dirname(extractPath));
          const writeStream = fs.createWriteStream(extractPath);
          readStream.pipe(writeStream);
          
          writeStream.on('close', () => {
            const lutName = fileName.replace(/\.cube$/i, '');
            cubeFiles.push({
              fileName,
              localPath: extractPath,
              lutName: lutName,
              normalizedName: normalizeLUTName(lutName),
              originalPath: entryPath, // Keep original path for reference
            });
            pendingReads--;
            if (pendingReads === 0) {
              resolve(cubeFiles);
            }
            zipfile.readEntry();
          });
          
          writeStream.on('error', (err) => {
            console.error(`Error writing ${extractPath}:`, err);
            pendingReads--;
            if (pendingReads === 0) {
              resolve(cubeFiles);
            }
            zipfile.readEntry();
          });
        });
      });
      
      zipfile.on('end', () => {
        // Wait for all pending reads to complete
        if (pendingReads === 0) {
          resolve(cubeFiles);
        }
      });
      
      zipfile.on('error', reject);
    });
  });
}

/**
 * Process a single LUT asset
 */
async function processLUTAsset(asset, dryRun = false) {
  const assetId = asset.id;
  const assetTitle = asset.title || 'Untitled';
  const storagePath = asset.storagePath || '';
  
  if (!storagePath || !storagePath.endsWith('.zip')) {
    console.log(`\n⚠ Skipping "${assetTitle}" - No ZIP file found in storagePath`);
    return { extracted: 0, uploaded: 0, created: 0, skipped: 0 };
  }
  
  const packName = getFolderNameFromStoragePath(storagePath);
  console.log(`\n📦 Processing: "${assetTitle}"`);
  console.log(`   Pack Name: ${packName}`);
  console.log(`   ZIP Path: ${storagePath}`);
  
  const zipFile = bucket.file(storagePath);
  const [zipExists] = await zipFile.exists();
  
  if (!zipExists) {
    console.log(`   ⚠ ZIP file not found in Storage, skipping`);
    return { extracted: 0, uploaded: 0, created: 0, skipped: 0 };
  }
  
  const tempDir = path.join(os.tmpdir(), `lut-unzip-${Date.now()}-${assetId}`);
  const zipLocalPath = path.join(tempDir, 'asset.zip');
  const extractDir = path.join(tempDir, 'extracted');
  
  try {
    // Download ZIP
    console.log(`   📥 Downloading ZIP file...`);
    await fs.ensureDir(path.dirname(zipLocalPath));
    await zipFile.download({ destination: zipLocalPath });
    
    // Extract ALL .cube files
    console.log(`   📂 Extracting .cube files...`);
    const cubeFiles = await unzipAllCubeFiles(zipLocalPath, extractDir);
    
    if (cubeFiles.length === 0) {
      console.log(`   ⚠ No .cube files found in ZIP`);
      return { extracted: 0, uploaded: 0, created: 0, skipped: 0 };
    }
    
    console.log(`   ✓ Found ${cubeFiles.length} .cube file(s)`);
    
    // Get existing preview documents to avoid duplicates
    const previewsSnap = await db
      .collection('assets')
      .doc(assetId)
      .collection('lutPreviews')
      .get();
    
    const existingPreviews = new Set();
    previewsSnap.docs.forEach(doc => {
      const data = doc.data();
      if (data.lutName) {
        existingPreviews.add(normalizeLUTName(data.lutName));
      }
      if (data.fileName) {
        existingPreviews.add(normalizeLUTName(data.fileName.replace(/\.cube$/i, '')));
      }
    });
    
    let uploaded = 0;
    let created = 0;
    let skipped = 0;
    
    // Process each .cube file
    for (const cubeFile of cubeFiles) {
      const normalizedName = cubeFile.normalizedName;
      
      // Check if preview already exists
      if (existingPreviews.has(normalizedName)) {
        console.log(`   ⏭ Skipping "${cubeFile.lutName}" - Preview already exists`);
        skipped++;
        continue;
      }
      
      // Upload .cube file to Storage
      // Use structure: assets/luts/{packName}/{fileName}
      const cubeStoragePath = `assets/luts/${packName}/${cubeFile.fileName}`;
      
      // Check if file already exists
      const existingFile = bucket.file(cubeStoragePath);
      const [fileExists] = await existingFile.exists();
      
      if (!fileExists) {
        if (dryRun) {
          console.log(`   [DRY RUN] Would upload: ${cubeStoragePath}`);
        } else {
          await existingFile.save(await fs.readFile(cubeFile.localPath), {
            metadata: {
              contentType: 'application/octet-stream',
            },
          });
          console.log(`   ✓ Uploaded: ${cubeFile.fileName}`);
        }
        uploaded++;
      } else {
        console.log(`   ⏭ File already exists: ${cubeFile.fileName}`);
      }
      
      // Create lutPreview document
      if (dryRun) {
        console.log(`   [DRY RUN] Would create preview: "${cubeFile.lutName}"`);
      } else {
        // Check if preview document already exists (by lutName)
        const existingPreviewSnap = await db
          .collection('assets')
          .doc(assetId)
          .collection('lutPreviews')
          .where('lutName', '==', cubeFile.lutName)
          .get();
        
        if (!existingPreviewSnap.empty) {
          console.log(`   ⏭ Preview already exists for "${cubeFile.lutName}"`);
          skipped++;
          continue;
        }
        
        // Create new preview document
        await db
          .collection('assets')
          .doc(assetId)
          .collection('lutPreviews')
          .add({
            assetId,
            assetTitle,
            lutName: cubeFile.lutName,
            lutFilePath: cubeStoragePath,
            fileName: cubeFile.fileName,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        console.log(`   ✓ Created preview: "${cubeFile.lutName}"`);
      }
      created++;
    }
    
    return { extracted: cubeFiles.length, uploaded, created, skipped };
    
  } catch (error) {
    console.error(`   ✗ Error processing asset:`, error);
    return { extracted: 0, uploaded: 0, created: 0, skipped: 0 };
  } finally {
    // Cleanup temp directory
    await fs.remove(tempDir).catch(() => {});
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
    console.error('Error: Must provide --assetId=xxx or --all flag');
    console.error('Usage: node scripts/unzip-lut-assets.js [--assetId=xxx] [--all] [--dry-run]');
    process.exit(1);
  }
  
  if (dryRun) {
    console.log('🔍 DRY RUN MODE - No changes will be made\n');
  }
  
  console.log('=== Unzip LUT Assets ===\n');
  
  try {
    let assets = [];
    
    if (assetId) {
      // Get specific asset
      const assetDoc = await db.collection('assets').doc(assetId).get();
      if (!assetDoc.exists) {
        console.error(`Asset ${assetId} not found`);
        process.exit(1);
      }
      const assetData = assetDoc.data();
      assets = [{ id: assetDoc.id, ...assetData }];
    } else {
      // Get all LUT assets
      const assetsSnap = await db
        .collection('assets')
        .where('category', '==', 'LUTs & Presets')
        .get();
      
      if (assetsSnap.empty) {
        console.log('No LUT assets found');
        return;
      }
      
      assets = assetsSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));
    }
    
    console.log(`Found ${assets.length} LUT asset(s) to process\n`);
    
    let totalExtracted = 0;
    let totalUploaded = 0;
    let totalCreated = 0;
    let totalSkipped = 0;
    
    for (const asset of assets) {
      const result = await processLUTAsset(asset, dryRun);
      totalExtracted += result.extracted;
      totalUploaded += result.uploaded;
      totalCreated += result.created;
      totalSkipped += result.skipped;
    }
    
    console.log('\n=== Summary ===');
    console.log(`Total .cube files extracted: ${totalExtracted}`);
    console.log(`Total files uploaded: ${totalUploaded}`);
    console.log(`Total previews created: ${totalCreated}`);
    console.log(`Total skipped: ${totalSkipped}`);
    
    if (dryRun) {
      console.log('\n🔍 This was a DRY RUN - No changes were made');
    }
    
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();

