#!/usr/bin/env node
/*
  Unzip SFX asset ZIP files and extract individual sound files to Firebase Storage
  
  This script:
  1. Downloads SFX ZIP files from Firebase Storage
  2. Unzips them to a temporary directory
  3. Uploads individual sound files back to Storage in a structured format
  4. Creates/updates Firestore documents for individual sound effects
  
  Requirements:
  - FIREBASE_ADMIN_PROJECT_ID
  - FIREBASE_ADMIN_CLIENT_EMAIL
  - FIREBASE_ADMIN_PRIVATE_KEY
  - npm packages: yauzl, fs-extra
  
  Usage:
    node scripts/unzip-sfx-assets.js [--assetId=xxx] [--all]
  
  If --assetId is provided, only processes that asset.
  If --all is provided, processes all SFX assets.
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

// Supported audio file extensions
const AUDIO_EXTENSIONS = ['.mp3', '.wav', '.aiff', '.m4a', '.ogg', '.flac'];

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
 * Unzip a file and extract audio files
 */
function unzipFile(zipPath, extractTo) {
  return new Promise((resolve, reject) => {
    yauzl.open(zipPath, { lazyEntries: true }, (err, zipfile) => {
      if (err) return reject(err);
      
      const audioFiles = [];
      
      zipfile.readEntry();
      
      zipfile.on('entry', (entry) => {
        if (/\/$/.test(entry.fileName)) {
          // Directory entry, skip
          zipfile.readEntry();
        } else {
          const ext = path.extname(entry.fileName).toLowerCase();
          if (AUDIO_EXTENSIONS.includes(ext)) {
            const fileName = path.basename(entry.fileName);
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
                audioFiles.push({
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
      
      zipfile.on('end', () => resolve(audioFiles));
      zipfile.on('error', reject);
    });
  });
}

/**
 * Get audio duration (basic implementation - you may want to use a library like node-ffprobe)
 */
async function getAudioDuration(filePath) {
  // For now, return 0. We can enhance this later with ffprobe or similar
  // This is a placeholder
  return 0;
}

/**
 * Process a single SFX asset
 */
async function processSfxAsset(asset) {
  console.log(`\nProcessing: ${asset.title} (${asset.id})`);
  
  if (!asset.storagePath || !asset.storagePath.includes('/sfx/')) {
    console.log('  Skipping: Not an SFX asset');
    return;
  }
  
  // Create temp directory
  const tempDir = path.join(os.tmpdir(), `sfx-extract-${asset.id}-${Date.now()}`);
  const zipPath = path.join(tempDir, 'asset.zip');
  
  try {
    // Download ZIP file
    await downloadFile(asset.storagePath, zipPath);
    
    // Extract audio files
    const extractDir = path.join(tempDir, 'extracted');
    const audioFiles = await unzipFile(zipPath, extractDir);
    
    if (audioFiles.length === 0) {
      console.log('  No audio files found in ZIP');
      return;
    }
    
    console.log(`  Found ${audioFiles.length} audio files`);
    
    // Get asset folder name (without .zip)
    const zipFileName = path.basename(asset.storagePath);
    const assetFolderName = zipFileName.replace('.zip', '');
    const baseStoragePath = asset.storagePath.replace(`/${zipFileName}`, '');
    
    // Process each audio file
    const soundEffects = [];
    
    for (const audioFile of audioFiles) {
      const soundFileName = audioFile.fileName;
      const soundStoragePath = `${baseStoragePath}/${assetFolderName}/sounds/${soundFileName}`;
      
      // Upload to Storage
      const contentType = audioFile.extension === '.mp3' ? 'audio/mpeg' :
                         audioFile.extension === '.wav' ? 'audio/wav' :
                         audioFile.extension === '.m4a' ? 'audio/mp4' :
                         'audio/octet-stream';
      
      await uploadFile(audioFile.localPath, soundStoragePath, contentType);
      
      // Get duration (placeholder for now)
      const duration = await getAudioDuration(audioFile.localPath);
      
      // Create sound effect document
      const soundEffect = {
        assetId: asset.id,
        assetTitle: asset.title,
        fileName: soundFileName,
        storagePath: soundStoragePath,
        fileType: audioFile.extension.replace('.', ''),
        duration: duration, // Will be 0 for now
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      };
      
      soundEffects.push(soundEffect);
    }
    
    // Store sound effects in Firestore subcollection
    const batch = db.batch();
    for (const soundEffect of soundEffects) {
      const docRef = db.collection('assets').doc(asset.id).collection('soundEffects').doc();
      batch.set(docRef, soundEffect);
    }
    await batch.commit();
    
    console.log(`  ✓ Processed ${soundEffects.length} sound effects`);
    
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
    console.error('Usage: node scripts/unzip-sfx-assets.js [--assetId=xxx] [--all]');
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
      await processSfxAsset(asset);
    } else {
      // Process all SFX assets
      const snapshot = await db.collection('assets')
        .where('category', '==', 'SFX & Plugins')
        .get();
      
      console.log(`Found ${snapshot.size} SFX assets`);
      
      for (const doc of snapshot.docs) {
        const asset = { id: doc.id, ...doc.data() };
        if (asset.storagePath && asset.storagePath.includes('/sfx/')) {
          await processSfxAsset(asset);
        }
      }
    }
    
    console.log('\n✓ Done!');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();

