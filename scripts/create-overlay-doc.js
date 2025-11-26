#!/usr/bin/env node
/*
  Create Firestore document for an overlay file
  
  Usage:
    node scripts/create-overlay-doc.js --storagePath="assets/overlays/Ultimate Paper FX/Ripped Paper Swipes.mp4"
    node scripts/create-overlay-doc.js --storagePath="assets/overlays/Ultimate Paper FX/Ripped Paper Swipes.mp4" --assetId=xxx
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

async function createOverlayDocument(storagePath, assetId = null) {
  console.log(`\nCreating Firestore document for: ${storagePath}\n`);

  // Verify file exists in Storage
  const file = bucket.file(storagePath);
  const [exists] = await file.exists();
  
  if (!exists) {
    console.error(`✗ Error: File not found in Storage: ${storagePath}`);
    process.exit(1);
  }
  
  console.log(`✓ File exists in Storage`);

  // Extract file name and determine file type
  const fileName = path.basename(storagePath);
  const fileExtension = path.extname(storagePath).toLowerCase().replace('.', '');
  const fileType = fileExtension || 'mp4';

  // Find matching asset if assetId not provided
  if (!assetId) {
    // Extract folder name from path: assets/overlays/{folderName}/file.mp4
    const pathParts = storagePath.split('/');
    if (pathParts.length >= 3 && pathParts[0] === 'assets' && pathParts[1] === 'overlays') {
      const folderName = pathParts[2];
      
      console.log(`Looking for asset matching folder: "${folderName}"`);
      
      // Search for assets with matching title or storage path
      const assetsSnap = await db
        .collection('assets')
        .where('category', '==', 'Overlays & Transitions')
        .get();
      
      let matchedAsset = null;
      for (const doc of assetsSnap.docs) {
        const assetData = doc.data();
        const assetTitle = (assetData.title || '').toLowerCase();
        const assetStoragePath = (assetData.storagePath || '').toLowerCase();
        
        // Check if title or storage path contains folder name
        if (assetTitle.includes(folderName.toLowerCase()) || 
            assetStoragePath.includes(folderName.toLowerCase()) ||
            folderName.toLowerCase().includes(assetTitle.replace(/\s+/g, ''))) {
          matchedAsset = { id: doc.id, ...assetData };
          console.log(`✓ Found matching asset: "${assetData.title}" (${doc.id})`);
          break;
        }
      }
      
      if (!matchedAsset) {
        console.log(`\n⚠ No matching asset found for folder "${folderName}"`);
        console.log(`\nAvailable assets:`);
        assetsSnap.docs.forEach((doc) => {
          console.log(`  - ${doc.data().title} (${doc.id})`);
        });
        
        // Try to create asset from folder name
        console.log(`\nCreating new asset for "${folderName}"...`);
        const newAssetData = {
          title: folderName,
          category: 'Overlays & Transitions',
          storagePath: `assets/overlays/${folderName}/${folderName}.zip`, // Placeholder, actual zip might not exist
          fileType: 'zip',
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        };
        
        const newAssetRef = await db.collection('assets').add(newAssetData);
        matchedAsset = { id: newAssetRef.id, ...newAssetData };
        console.log(`✓ Created new asset: "${folderName}" (${newAssetRef.id})`);
      }
      
      assetId = matchedAsset.id;
    } else {
      console.error(`✗ Error: Invalid storage path format. Expected: assets/overlays/{folderName}/file.mp4`);
      process.exit(1);
    }
  }

  // Get asset document
  const assetDoc = await db.collection('assets').doc(assetId).get();
  if (!assetDoc.exists) {
    console.error(`✗ Error: Asset ${assetId} not found`);
    process.exit(1);
  }

  const assetData = assetDoc.data();
  console.log(`✓ Asset found: "${assetData.title}" (${assetId})`);

  // Check if document already exists
  const existingDocs = await db
    .collection('overlays')
    .where('storagePath', '==', storagePath)
    .get();

  if (!existingDocs.empty) {
    console.log(`\n⚠ Warning: Document already exists for this storage path:`);
    existingDocs.docs.forEach((doc) => {
      console.log(`  - overlays/${doc.id}`);
    });
    console.log(`\nSkipping creation. Use --force to update existing document.`);
    process.exit(0);
  }

  // Create overlay document
  const overlayData = {
    assetId: assetId,
    assetTitle: assetData.title || 'Untitled',
    fileName: fileName,
    storagePath: storagePath,
    fileType: fileType,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  const overlayRef = await db.collection('overlays').add(overlayData);
  
  console.log(`\n✓ Created Firestore document:`);
  console.log(`  Collection: overlays`);
  console.log(`  Document ID: ${overlayRef.id}`);
  console.log(`  Storage Path: ${storagePath}`);
  console.log(`  File Name: ${fileName}`);
  console.log(`  File Type: ${fileType}`);
  console.log(`  Asset: ${assetData.title} (${assetId})`);
  console.log(`\nFull path: overlays/${overlayRef.id}`);
}

// Main
const storagePath = getArg('storagePath', null);
const assetId = getArg('assetId', null);

if (!storagePath) {
  console.error('Error: --storagePath is required');
  console.error('\nUsage:');
  console.error('  node scripts/create-overlay-doc.js --storagePath="assets/overlays/Ultimate Paper FX/Ripped Paper Swipes.mp4"');
  console.error('  node scripts/create-overlay-doc.js --storagePath="assets/overlays/Ultimate Paper FX/Ripped Paper Swipes.mp4" --assetId=xxx');
  process.exit(1);
}

createOverlayDocument(storagePath, assetId)
  .then(() => {
    console.log('\n✓ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n✗ Error:', error);
    process.exit(1);
  });

