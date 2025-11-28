#!/usr/bin/env node
/*
  Unzip Overlay asset ZIP files and extract individual overlay files to Firebase Storage
  
  This script:
  1. Downloads Overlay ZIP files from Firebase Storage
  2. Unzips them to a temporary directory
  3. Uploads individual overlay files (images/videos) back to Storage in a structured format
  4. Creates/updates Firestore documents for individual overlays
  
  Requirements:
  - FIREBASE_ADMIN_PROJECT_ID
  - FIREBASE_ADMIN_CLIENT_EMAIL
  - FIREBASE_ADMIN_PRIVATE_KEY
  - npm packages: yauzl, fs-extra
  
  Usage:
    node scripts/unzip-overlay-assets.js [--assetId=xxx] [--all]
  
  If --assetId is provided, only processes that asset.
  If --all is provided, processes all Overlay assets.
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

// Supported overlay file extensions (images and videos)
const OVERLAY_EXTENSIONS = [
  // Images
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.tiff', '.tif',
  // Videos
  '.mov', '.mp4', '.avi', '.mkv', '.webm', '.m4v',
];

function getArg(name, def) {
  const arg = process.argv.find(a => a.startsWith(`--${name}=`));
  return arg ? arg.split('=')[1] : def;
}

function hasFlag(flag) {
  return process.argv.includes(`--${flag}`);
}

/**
 * Download a file from Firebase Storage to a local path
 */
async function downloadFile(storagePath, localPath) {
  const file = bucket.file(storagePath);
  await fs.ensureDir(path.dirname(localPath));
  await file.download({ destination: localPath });
  console.log(`Downloaded: ${storagePath}`);
}

/**
 * Upload a file to Firebase Storage
 */
async function uploadFile(localPath, storagePath, contentType) {
  const file = bucket.file(storagePath);
  await file.save(await fs.readFile(localPath), {
    metadata: {
      contentType: contentType || 'application/octet-stream',
    },
  });
  console.log(`Uploaded: ${storagePath}`);
}

/**
 * Unzip a file and extract overlay files
 */
function unzipFile(zipPath, extractTo) {
  return new Promise((resolve, reject) => {
    yauzl.open(zipPath, { lazyEntries: true }, (err, zipfile) => {
      if (err) return reject(err);
      
      const overlayFiles = [];
      
      zipfile.readEntry();
      
      zipfile.on('entry', (entry) => {
        if (/\/$/.test(entry.fileName)) {
          // Directory entry, skip
          zipfile.readEntry();
        } else {
          // Skip macOS metadata files (._ prefix)
          if (entry.fileName.includes('/._') || path.basename(entry.fileName).startsWith('._')) {
            zipfile.readEntry();
            return;
          }
          
          const ext = path.extname(entry.fileName).toLowerCase();
          if (OVERLAY_EXTENSIONS.includes(ext)) {
            const fileName = path.basename(entry.fileName);
            // Double-check: skip if filename starts with ._
            if (fileName.startsWith('._')) {
              zipfile.readEntry();
              return;
            }
            
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
                overlayFiles.push({
                  fileName,
                  localPath: extractPath,
                  extension: ext,
                });
                zipfile.readEntry();
              });
            });
          } else {
            zipfile.readEntry();
          }
        }
      });
      
      zipfile.on('end', () => resolve(overlayFiles));
      zipfile.on('error', reject);
    });
  });
}

/**
 * Get content type based on file extension
 */
function getContentType(extension) {
  const contentTypeMap = {
    // Images
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.tiff': 'image/tiff',
    '.tif': 'image/tiff',
    // Videos
    '.mov': 'video/quicktime',
    '.mp4': 'video/mp4',
    '.avi': 'video/x-msvideo',
    '.mkv': 'video/x-matroska',
    '.webm': 'video/webm',
    '.m4v': 'video/x-m4v',
  };
  
  return contentTypeMap[extension.toLowerCase()] || 'application/octet-stream';
}

/**
 * Process a single Overlay asset
 */
async function processOverlayAsset(asset) {
  console.log(`\nProcessing: ${asset.title} (${asset.id})`);
  
  if (!asset.storagePath || (!asset.storagePath.toLowerCase().includes('/overlays/') && !asset.storagePath.toLowerCase().includes('/transitions/'))) {
    console.log('  Skipping: Not an Overlay or Transition asset');
    return;
  }
  
  // Check if overlays already exist for this asset
  const existingOverlays = await db
    .collection('assets')
    .doc(asset.id)
    .collection('overlays')
    .limit(1)
    .get();
  
  if (!existingOverlays.empty) {
    // Get full count for logging
    const allOverlays = await db
      .collection('assets')
      .doc(asset.id)
      .collection('overlays')
      .get();
    console.log(`  ⏭ Skipping: Already processed (${allOverlays.size} overlay(s) found)`);
    return;
  }
  
  // Create temp directory
  const tempDir = path.join(os.tmpdir(), `overlay-extract-${asset.id}-${Date.now()}`);
  const zipPath = path.join(tempDir, 'asset.zip');
  
  try {
    // Check if ZIP file exists in Storage before processing
    const zipFile = bucket.file(asset.storagePath);
    const [exists] = await zipFile.exists();
    
    if (!exists) {
      console.log(`  ⚠ Skipping: ZIP file not found in Storage (${asset.storagePath})`);
      return;
    }
    
    // Download ZIP file
    await downloadFile(asset.storagePath, zipPath);
    
    // Extract overlay files
    const extractDir = path.join(tempDir, 'extracted');
    const overlayFiles = await unzipFile(zipPath, extractDir);
    
    if (overlayFiles.length === 0) {
      console.log('  No overlay files found in ZIP');
      return;
    }
    
    console.log(`  Found ${overlayFiles.length} overlay files`);
    
    // Get asset folder name (without .zip)
    const zipFileName = path.basename(asset.storagePath);
    const assetFolderName = zipFileName.replace('.zip', '');
    const baseStoragePath = asset.storagePath.replace(`/${zipFileName}`, '');
    
    // Process each overlay file
    const overlays = [];
    
    for (const overlayFile of overlayFiles) {
      const overlayFileName = overlayFile.fileName;
      const overlayStoragePath = `${baseStoragePath}/${assetFolderName}/${overlayFileName}`;
      
      // Upload to Storage
      const contentType = getContentType(overlayFile.extension);
      
      await uploadFile(overlayFile.localPath, overlayStoragePath, contentType);
      
      // Create overlay document
      const overlay = {
        assetId: asset.id,
        assetTitle: asset.title,
        fileName: overlayFileName,
        storagePath: overlayStoragePath,
        fileType: overlayFile.extension.replace('.', ''),
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      };
      
      overlays.push(overlay);
    }
    
    // Store overlays in Firestore subcollection
    const batch = db.batch();
    for (const overlay of overlays) {
      const docRef = db.collection('assets').doc(asset.id).collection('overlays').doc();
      batch.set(docRef, overlay);
    }
    await batch.commit();
    
    console.log(`  ✓ Processed ${overlays.length} overlays`);
    
    // Cleanup temp directory
    await fs.remove(tempDir);
    
  } catch (error) {
    console.error(`  ✗ Error processing ${asset.title}:`, error);
    // Cleanup on error
    try {
      await fs.remove(tempDir);
    } catch {}
  }
}

/**
 * Main function
 */
async function main() {
  const assetId = getArg('assetId', null);
  const processAll = hasFlag('all');
  
  if (!assetId && !processAll) {
    console.error('Usage: node scripts/unzip-overlay-assets.js [--assetId=xxx] [--all]');
    process.exit(1);
  }
  
  try {
    if (assetId) {
      // Process single asset
      const assetDoc = await db.collection('assets').doc(assetId).get();
      if (!assetDoc.exists) {
        console.error(`Asset ${assetId} not found`);
        process.exit(1);
      }
      
      const asset = { id: assetDoc.id, ...assetDoc.data() };
      await processOverlayAsset(asset);
    } else {
      // Process all Overlay assets
      // First, check Firebase Storage directly for Overlay zip files
      // This catches files that might not have Firestore documents yet
      console.log('Scanning Firebase Storage for Overlay zip files...');
      const [storageFiles] = await bucket.getFiles({ prefix: 'assets/' });
      
      const storageOverlayZips = [];
      for (const file of storageFiles) {
        const fileName = file.name.split('/').pop();
        const pathParts = file.name.split('/');
        
        // Check if it's a ZIP file in an Overlay or Transition folder
        // Pattern: assets/overlays/{filename}.zip or assets/transitions/{filename}.zip
        if (fileName.endsWith('.zip') && pathParts.length === 3 && pathParts[0] === 'assets') {
          const categoryFolder = pathParts[1].toLowerCase();
          if (categoryFolder === 'overlays' || categoryFolder.includes('overlay') || 
              categoryFolder === 'transitions' || categoryFolder.includes('transition')) {
            storageOverlayZips.push({
              storagePath: file.name,
              fileName: fileName,
            });
          }
        }
      }
      
      console.log(`Found ${storageOverlayZips.length} Overlay zip files in Storage`);
      
      // Now fetch all assets from Firestore
      console.log('Fetching all assets from Firestore...');
      const snapshot = await db.collection('assets').get();
      
      console.log(`Found ${snapshot.size} total assets in Firestore`);
      
      // Create a map of storagePath -> asset document
      const assetMap = new Map();
      for (const doc of snapshot.docs) {
        const asset = { id: doc.id, ...doc.data() };
        if (asset.storagePath) {
          assetMap.set(asset.storagePath, asset);
        }
      }
      
      // Process Overlay and Transition assets from both sources
      const overlayAssets = [];
      
      // First, add assets from Firestore that match Overlay or Transition
      for (const [storagePath, asset] of assetMap.entries()) {
        if (storagePath.toLowerCase().includes('/overlays/') || storagePath.toLowerCase().includes('/transitions/')) {
          overlayAssets.push(asset);
        }
      }
      
      // Then, create Firestore documents for Storage files that don't have documents yet
      for (const zipFile of storageOverlayZips) {
        if (!assetMap.has(zipFile.storagePath)) {
          console.log(`\n⚠ Found zip file in Storage without Firestore document: ${zipFile.fileName}`);
          console.log(`  Storage path: ${zipFile.storagePath}`);
          console.log(`  Creating Firestore document...`);
          
          // Create a basic Firestore document
          const title = zipFile.fileName.replace('.zip', '').replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
          const assetData = {
            title: title,
            category: 'Overlays & Transitions',
            storagePath: zipFile.storagePath,
            fileType: 'zip',
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          };
          
          const docRef = await db.collection('assets').add(assetData);
          // Refresh the document to get the actual server timestamp
          const createdDoc = await docRef.get();
          const newAsset = { id: createdDoc.id, ...createdDoc.data() };
          overlayAssets.push(newAsset);
          console.log(`  ✓ Created document: ${docRef.id}`);
        }
      }
      
      console.log(`\nFound ${overlayAssets.length} total Overlay assets to process`);
      
      // Debug: List all Overlay assets found
      console.log('\nOverlay Assets found:');
      overlayAssets.forEach((asset, index) => {
        console.log(`  ${index + 1}. ${asset.title || 'Untitled'} (${asset.id})`);
        console.log(`     Storage: ${asset.storagePath}`);
        if (asset.createdAt) {
          try {
            let date;
            if (asset.createdAt.toDate) {
              date = asset.createdAt.toDate();
            } else if (asset.createdAt.toMillis) {
              date = new Date(asset.createdAt.toMillis());
            } else if (typeof asset.createdAt === 'object' && asset.createdAt._methodName === 'serverTimestamp') {
              // Server timestamp placeholder - skip
              console.log(`     Created: (just created)`);
              return;
            } else {
              date = new Date(asset.createdAt);
            }
            if (date && !isNaN(date.getTime())) {
              console.log(`     Created: ${date.toISOString()}`);
            }
          } catch (e) {
            // Skip invalid dates
          }
        }
      });
      
      // Sort by createdAt if available (newest first) to process recent uploads first
      overlayAssets.sort((a, b) => {
        let aTime = 0;
        let bTime = 0;
        
        try {
          if (a.createdAt) {
            if (a.createdAt.toMillis) {
              aTime = a.createdAt.toMillis();
            } else if (a.createdAt.toDate) {
              aTime = a.createdAt.toDate().getTime();
            } else if (typeof a.createdAt === 'object' && a.createdAt._methodName === 'serverTimestamp') {
              // Server timestamp placeholder - treat as newest
              aTime = Date.now();
            } else {
              const date = new Date(a.createdAt);
              aTime = isNaN(date.getTime()) ? 0 : date.getTime();
            }
          }
        } catch (e) {
          aTime = 0;
        }
        
        try {
          if (b.createdAt) {
            if (b.createdAt.toMillis) {
              bTime = b.createdAt.toMillis();
            } else if (b.createdAt.toDate) {
              bTime = b.createdAt.toDate().getTime();
            } else if (typeof b.createdAt === 'object' && b.createdAt._methodName === 'serverTimestamp') {
              // Server timestamp placeholder - treat as newest
              bTime = Date.now();
            } else {
              const date = new Date(b.createdAt);
              bTime = isNaN(date.getTime()) ? 0 : date.getTime();
            }
          }
        } catch (e) {
          bTime = 0;
        }
        
        return bTime - aTime; // Newest first
      });
      
      for (const asset of overlayAssets) {
        await processOverlayAsset(asset);
      }
    }
    
    console.log('\n✓ Done!');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();

