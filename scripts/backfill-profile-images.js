#!/usr/bin/env node
/*
  Backfill missing profile images from Firebase Auth to Firestore.

  This script syncs photoURL from Firebase Auth to Firestore for users who:
  - Don't have a photoURL in Firestore, OR
  - Have a Google/OAuth photoURL (not a custom uploaded Firebase Storage photo)

  Usage:
    node scripts/backfill-profile-images.js [--dry]

  Auth options:
    - Preferred: export GOOGLE_APPLICATION_CREDENTIALS=/abs/path/service-account.json
    - Fallback env: FIREBASE_ADMIN_PROJECT_ID, FIREBASE_ADMIN_CLIENT_EMAIL, FIREBASE_ADMIN_PRIVATE_KEY
*/

// Load env from .env.local then .env
try { require('dotenv').config({ path: '.env.local' }); } catch {}
require('dotenv').config();

const admin = require('firebase-admin');

function initAdmin() {
  if (admin.apps.length > 0) return admin.firestore();

  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    admin.initializeApp({
      credential: admin.credential.applicationDefault()
    });
  } else if (process.env.FIREBASE_ADMIN_PROJECT_ID) {
    const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n');
    if (!privateKey) throw new Error('Missing FIREBASE_ADMIN_PRIVATE_KEY');
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
        clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
        privateKey: privateKey
      })
    });
  } else {
    throw new Error('Missing Firebase Admin credentials. Set GOOGLE_APPLICATION_CREDENTIALS or Firebase Admin env vars.');
  }

  return admin.firestore();
}

async function main() {
  const db = initAdmin();
  const dry = process.argv.includes('--dry');

  console.log(`Syncing profile images from Firebase Auth to Firestore${dry ? ' (DRY RUN)' : ''}...`);

  const usersRef = db.collection('users');
  const snapshot = await usersRef.get();
  
  if (snapshot.empty) {
    console.log('No users found.');
    return;
  }

  let updated = 0;
  let skipped = 0;
  let batch = db.batch();
  let batchCount = 0;

  for (const docSnap of snapshot.docs) {
    const userId = docSnap.id;
    const firestoreData = docSnap.data() || {};
    const existingPhotoURL = firestoreData.photoURL;
    
    // Check if user has a custom uploaded photo (Firebase Storage)
    const hasPhotoURL = existingPhotoURL && typeof existingPhotoURL === 'string' && existingPhotoURL.trim() !== '';
    const isCustomUploadedPhoto = hasPhotoURL && (
      existingPhotoURL.includes('firebasestorage.googleapis.com') ||
      existingPhotoURL.includes('firebase/storage')
    );

    // Skip if user already has a custom uploaded photo
    if (isCustomUploadedPhoto) {
      skipped++;
      continue;
    }

    try {
      // Get user from Firebase Auth
      const authUser = await admin.auth().getUser(userId);
      const authPhotoURL = authUser.photoURL;

      // Only update if Firebase Auth has a photoURL and Firestore doesn't have a custom one
      if (authPhotoURL && (!hasPhotoURL || !isCustomUploadedPhoto)) {
        if (dry) {
          console.log(`Would update ${userId}: ${existingPhotoURL || 'none'} -> ${authPhotoURL}`);
          updated++;
          continue;
        }

        batch.update(docSnap.ref, {
          photoURL: authPhotoURL,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        
        batchCount++;
        updated++;

        if (batchCount >= 400) {
          await batch.commit();
          batch = db.batch();
          batchCount = 0;
        }
      } else {
        skipped++;
      }
    } catch (error) {
      if (error.code === 'auth/user-not-found') {
        skipped++;
        console.log(`Skipping ${userId}: user not found in Firebase Auth`);
      } else {
        console.error(`Error processing ${userId}:`, error.message || error);
        skipped++;
      }
    }
  }

  if (!dry && batchCount > 0) {
    await batch.commit();
  }

  console.log(`\nDone. ${dry ? 'Would update' : 'Updated'}: ${updated}, Skipped: ${skipped}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

