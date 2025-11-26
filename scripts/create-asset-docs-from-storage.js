#!/usr/bin/env node
/*
  Auto-create Firestore documents for assets based on ZIP files in Firebase Storage
  
  This script scans Firebase Storage for ZIP files in the assets/ folders and
  automatically creates Firestore documents for any ZIP files that don't have
  corresponding documents yet.
  
  Requirements (env):
  - FIREBASE_ADMIN_PROJECT_ID
  - FIREBASE_ADMIN_CLIENT_EMAIL
  - FIREBASE_ADMIN_PRIVATE_KEY
  
  Usage:
    node scripts/create-asset-docs-from-storage.js
  
  This script will:
  1. Scan Firebase Storage for ZIP files in assets/{category}/ folders
  2. Check if Firestore document exists for each ZIP (by storagePath)
  3. Auto-create Firestore documents for missing ones
  4. Generate titles from filenames (e.g., "sleektone-minimal-luts.zip" -> "Sleektone Minimal Luts")
  5. Create thumbnail folder structure (same name as ZIP, without .zip extension)
  6. Set thumbnailUrl field if preview.png already exists in the folder
*/

// Load env from .env.local first, then fallback to .env
try {
  require('dotenv').config({ path: '.env.local' });
} catch {}
require('dotenv').config();
const admin = require('firebase-admin');
const path = require('path');

function initAdmin() {
  if (admin.apps.length) {
    return {
      db: admin.firestore(),
      storage: admin.storage()
    };
  }
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    admin.initializeApp({ credential: admin.credential.applicationDefault() });
  } else {
    const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
    let privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY || '';
    privateKey = privateKey.replace(/\\n/g, '\n').replace(/\r\n/g, '\n');
    if (!projectId || !clientEmail || !privateKey) {
      throw new Error('Missing Firebase Admin credentials');
    }
    admin.initializeApp({ 
      credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
      projectId: projectId
    });
  }
  const db = admin.firestore();
  db.settings({ ignoreUndefinedProperties: true });
  const storage = admin.storage();
  return { db, storage };
}

/**
 * Maps folder names to asset categories
 */
const categoryMap = {
  'luts': 'LUTs & Presets',
  'overlays': 'Overlays & Transitions',
  'sfx': 'SFX & Plugins',
  'templates': 'Templates'
};

/**
 * Converts filename to a readable title
 * e.g., "sleektone-minimal-luts.zip" -> "Sleektone Minimal Luts"
 */
function filenameToTitle(filename) {
  // Remove .zip extension
  let title = filename.replace(/\.zip$/i, '');
  
  // Replace hyphens and underscores with spaces
  title = title.replace(/[-_]/g, ' ');
  
  // Capitalize first letter of each word
  title = title.split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
  
  return title;
}

/**
 * Extracts category from storage path
 * e.g., "assets/luts/file.zip" -> "LUTs & Presets"
 */
function getCategoryFromPath(storagePath) {
  const parts = storagePath.split('/');
  if (parts.length < 2 || parts[0] !== 'assets') {
    return null;
  }
  const folderName = parts[1].toLowerCase();
  return categoryMap[folderName] || null;
}

/**
 * Scans Firebase Storage for ZIP files in assets folders
 */
async function scanStorageForZipFiles(bucket) {
  const zipFiles = [];
  
  // List all files in assets/ prefix
  const [files] = await bucket.getFiles({ prefix: 'assets/' });
  
  for (const file of files) {
    const fileName = file.name.split('/').pop();
    const pathParts = file.name.split('/');
    
    // Check if it's a ZIP file directly in a category folder
    // Pattern: assets/{category}/{filename}.zip (exactly 3 parts)
    // Skip files in subfolders like assets/{category}/subfolder/{filename}.zip
    if (fileName.endsWith('.zip') && pathParts.length === 3 && pathParts[0] === 'assets') {
      const storagePath = file.name;
      const category = getCategoryFromPath(storagePath);
      
      if (category) {
        zipFiles.push({
          storagePath,
          fileName,
          category
        });
      }
    }
  }
  
  return zipFiles;
}

/**
 * Checks if a Firestore document exists for the given storagePath
 */
async function assetDocumentExists(db, storagePath) {
  const snapshot = await db.collection('assets')
    .where('storagePath', '==', storagePath)
    .limit(1)
    .get();
  
  return !snapshot.empty;
}

/**
 * Gets the thumbnail folder path for an asset
 * e.g., "assets/luts/sleektone-minimal-luts.zip" -> "assets/luts/sleektone-minimal-luts"
 */
function getThumbnailFolderPath(storagePath) {
  const zipFileName = storagePath.split('/').pop().replace('.zip', '');
  const folderPath = storagePath.replace(`/${zipFileName}.zip`, '');
  return `${folderPath}/${zipFileName}`;
}

/**
 * Gets the preview image path
 * e.g., "assets/luts/sleektone-minimal-luts/preview.png"
 */
function getPreviewImagePath(storagePath) {
  const folderPath = getThumbnailFolderPath(storagePath);
  return `${folderPath}/preview.png`;
}

/**
 * Creates the thumbnail folder structure by creating a placeholder file
 * In Firebase Storage, folders don't exist separately, so we create a .keep file
 */
async function createThumbnailFolder(bucket, storagePath) {
  const folderPath = getThumbnailFolderPath(storagePath);
  const keepFilePath = `${folderPath}/.keep`;
  
  const file = bucket.file(keepFilePath);
  const [exists] = await file.exists();
  
  if (!exists) {
    // Create a small placeholder file to establish the folder structure
    await file.save('', {
      metadata: {
        contentType: 'text/plain',
      },
    });
    return true;
  }
  
  return false;
}

/**
 * Generates a signed URL for the preview image (even if it doesn't exist yet)
 * Returns null if the file doesn't exist
 */
async function getThumbnailUrl(bucket, storagePath) {
  const previewPath = getPreviewImagePath(storagePath);
  const file = bucket.file(previewPath);
  
  // Check if preview.png exists
  const [exists] = await file.exists();
  
  if (exists) {
    // Generate signed URL valid for 10 years
    const expiresAt = new Date();
    expiresAt.setFullYear(expiresAt.getFullYear() + 10);
    
    const [signedUrl] = await file.getSignedUrl({
      action: 'read',
      expires: expiresAt,
    });
    
    return signedUrl;
  }
  
  // If preview.png doesn't exist, return null
  // The user can upload it later and run update-asset-thumbnails.js
  return null;
}

/**
 * Creates a Firestore document for an asset
 */
async function createAssetDocument(db, bucket, zipFile) {
  const title = filenameToTitle(zipFile.fileName);
  
  // Create thumbnail folder structure
  const folderCreated = await createThumbnailFolder(bucket, zipFile.storagePath);
  
  // Try to get thumbnail URL if preview.png already exists
  const thumbnailUrl = await getThumbnailUrl(bucket, zipFile.storagePath);
  
  const assetData = {
    title,
    category: zipFile.category,
    storagePath: zipFile.storagePath,
    fileType: 'zip',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };
  
  // Only add thumbnailUrl if it exists
  if (thumbnailUrl) {
    assetData.thumbnailUrl = thumbnailUrl;
  }
  
  const docRef = await db.collection('assets').add(assetData);
  return { docId: docRef.id, thumbnailUrl, folderCreated };
}

/**
 * Main function to scan storage and create documents
 */
async function createAssetDocsFromStorage() {
  const { db, storage } = initAdmin();
  console.log('Scanning Firebase Storage for ZIP files...\n');

  // Get the storage bucket
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID || 'course-creator-academy-866d6';
  const bucketName = `${projectId}.firebasestorage.app`;
  const bucket = storage.bucket(bucketName);

  try {
    // Scan for ZIP files
    const zipFiles = await scanStorageForZipFiles(bucket);
    
    if (zipFiles.length === 0) {
      console.log('No ZIP files found in assets/ folders.');
      return;
    }
    
    console.log(`Found ${zipFiles.length} ZIP file(s) in storage.\n`);
    
    let created = 0;
    let skipped = 0;
    let errors = 0;
    
    // Process each ZIP file
    for (const zipFile of zipFiles) {
      try {
        const exists = await assetDocumentExists(db, zipFile.storagePath);
        
        if (exists) {
          console.log(`⏭️  Skipped: "${zipFile.fileName}" (document already exists)`);
          skipped++;
        } else {
          const title = filenameToTitle(zipFile.fileName);
          const { docId, thumbnailUrl, folderCreated } = await createAssetDocument(db, bucket, zipFile);
          
          const folderPath = getThumbnailFolderPath(zipFile.storagePath);
          let logMessage = `✅ Created: "${title}" (${docId})`;
          
          if (folderCreated) {
            logMessage += `\n     📁 Created thumbnail folder: ${folderPath}`;
          } else {
            logMessage += `\n     📁 Thumbnail folder already exists: ${folderPath}`;
          }
          
          if (thumbnailUrl) {
            logMessage += `\n     🖼️  Thumbnail URL set (preview.png found)`;
          } else {
            logMessage += `\n     ⚠️  No thumbnail yet - upload preview.png to ${folderPath}/ and run update-asset-thumbnails.js`;
          }
          
          console.log(logMessage);
          created++;
        }
      } catch (error) {
        console.error(`❌ Error processing "${zipFile.fileName}":`, error.message);
        errors++;
      }
    }
    
    console.log(`\n✨ Complete!`);
    console.log(`   Created: ${created}`);
    console.log(`   Skipped: ${skipped}`);
    console.log(`   Errors: ${errors}`);
    
    if (created > 0) {
      console.log(`\n📝 Note: Created ${created} new Firestore document(s).`);
      console.log('   You may want to run update-asset-thumbnails.js to generate thumbnail URLs.');
    }
    
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

createAssetDocsFromStorage().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

