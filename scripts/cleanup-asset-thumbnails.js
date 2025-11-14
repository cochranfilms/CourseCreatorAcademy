#!/usr/bin/env node
/*
  Clean up placeholder thumbnail URLs from existing assets

  Requirements (env):
  - FIREBASE_ADMIN_PROJECT_ID
  - FIREBASE_ADMIN_CLIENT_EMAIL
  - FIREBASE_ADMIN_PRIVATE_KEY

  Usage:
    node scripts/cleanup-asset-thumbnails.js
*/

// Load env from .env.local first, then fallback to .env
try {
  require('dotenv').config({ path: '.env.local' });
} catch {}
require('dotenv').config();
const admin = require('firebase-admin');

function initAdmin() {
  if (admin.apps.length) return admin.firestore();
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
    admin.initializeApp({ credential: admin.credential.cert({ projectId, clientEmail, privateKey }) });
  }
  const db = admin.firestore();
  db.settings({ ignoreUndefinedProperties: true });
  return db;
}

async function cleanupThumbnails() {
  const db = initAdmin();
  console.log('Cleaning up placeholder thumbnail URLs...\n');

  try {
    const snapshot = await db.collection('assets').get();
    let updated = 0;
    let skipped = 0;

    for (const doc of snapshot.docs) {
      const data = doc.data();
      const thumbnailUrl = data.thumbnailUrl;

      // Check if it's a placeholder URL
      if (thumbnailUrl && (
        thumbnailUrl.includes('via.placeholder.com') ||
        thumbnailUrl.includes('placeholder')
      )) {
        console.log(`Removing placeholder URL from: "${data.title}"`);
        await doc.ref.update({
          thumbnailUrl: admin.firestore.FieldValue.delete(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        updated++;
      } else {
        skipped++;
      }
    }

    console.log(`\n✨ Cleanup complete!`);
    console.log(`   Updated: ${updated} assets`);
    console.log(`   Skipped: ${skipped} assets`);
  } catch (error) {
    console.error('Error cleaning up thumbnails:', error);
    process.exit(1);
  }
}

cleanupThumbnails().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

