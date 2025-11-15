#!/usr/bin/env node
/*
  Update all asset thumbnail URLs with signed URLs
  
  This script regenerates thumbnail URLs for all assets using signed URLs
  instead of public URLs, which should work more reliably.
*/

// Load env from .env.local first, then fallback to .env
try {
  require('dotenv').config({ path: '.env.local' });
} catch {}
require('dotenv').config();
const admin = require('firebase-admin');

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

async function getSignedUrl(bucket, filePath) {
  const file = bucket.file(filePath);
  
  // Check if file exists
  const [exists] = await file.exists();
  if (!exists) {
    throw new Error(`File does not exist: ${filePath}`);
  }
  
  // Generate signed URL valid for 10 years
  const expiresAt = new Date();
  expiresAt.setFullYear(expiresAt.getFullYear() + 10);
  
  const [signedUrl] = await file.getSignedUrl({
    action: 'read',
    expires: expiresAt,
  });
  
  return signedUrl;
}

async function updateThumbnails() {
  const { db, storage } = initAdmin();
  console.log('Updating asset thumbnail URLs...\n');

  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID || 'course-creator-academy-866d6';
  const bucketName = `${projectId}.firebasestorage.app`;
  const bucket = storage.bucket(bucketName);

  try {
    const snapshot = await db.collection('assets').get();
    let updated = 0;
    let skipped = 0;
    let errors = 0;

    for (const doc of snapshot.docs) {
      const asset = doc.data();
      const assetId = doc.id;
      
      if (!asset.storagePath) {
        console.log(`⏭️  Skipping "${asset.title}" - no storagePath`);
        skipped++;
        continue;
      }

      // Generate thumbnail path
      const zipFileName = asset.storagePath.split('/').pop()?.replace('.zip', '') || '';
      const folderPath = asset.storagePath.replace(`/${zipFileName}.zip`, '');
      const previewPath = `${folderPath}/${zipFileName}/preview.png`;

      try {
        const thumbnailUrl = await getSignedUrl(bucket, previewPath);
        
        await doc.ref.update({
          thumbnailUrl: thumbnailUrl,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        
        console.log(`✅ Updated: "${asset.title}"`);
        updated++;
      } catch (error) {
        console.error(`❌ Error updating "${asset.title}": ${error.message}`);
        errors++;
      }
    }

    console.log(`\n✨ Complete!`);
    console.log(`   Updated: ${updated}`);
    console.log(`   Skipped: ${skipped}`);
    console.log(`   Errors: ${errors}`);
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

updateThumbnails().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

