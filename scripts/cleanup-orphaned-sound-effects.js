#!/usr/bin/env node
/*
  Cleanup orphaned sound effect documents in Firestore
  
  This script finds sound effect documents in Firestore that don't have
  corresponding files in Firebase Storage and removes them.
  
  Requirements:
  - FIREBASE_ADMIN_PROJECT_ID
  - FIREBASE_ADMIN_CLIENT_EMAIL
  - FIREBASE_ADMIN_PRIVATE_KEY
  
  Usage:
    node scripts/cleanup-orphaned-sound-effects.js [--dry-run]
  
  If --dry-run is provided, it will only report what would be deleted without actually deleting.
*/

// Load env from .env.local first, then fallback to .env
try {
  require('dotenv').config({ path: '.env.local' });
} catch {}
require('dotenv').config();

const admin = require('firebase-admin');

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

function hasFlag(flag) {
  return process.argv.includes(`--${flag}`);
}

/**
 * Check if a file exists in Firebase Storage
 */
async function fileExists(storagePath) {
  try {
    const file = bucket.file(storagePath);
    const [exists] = await file.exists();
    return exists;
  } catch (error) {
    console.error(`Error checking file ${storagePath}:`, error);
    return false;
  }
}

/**
 * Delete sound effect documents in batches
 */
async function deleteSoundEffectsBatch(soundEffectRefs) {
  const batch = db.batch();
  soundEffectRefs.forEach(ref => {
    batch.delete(ref);
  });
  await batch.commit();
}

/**
 * Main cleanup function
 */
async function cleanupOrphanedSoundEffects() {
  const dryRun = hasFlag('dry-run');
  
  if (dryRun) {
    console.log('🔍 DRY RUN MODE - No files will be deleted\n');
  } else {
    console.log('🗑️  DELETION MODE - Files will be permanently deleted\n');
  }
  
  try {
    // Get all assets
    console.log('Fetching all assets...');
    const assetsSnapshot = await db.collection('assets').get();
    console.log(`Found ${assetsSnapshot.size} assets\n`);
    
    let totalOrphaned = 0;
    let totalDeleted = 0;
    
    // Process each asset
    for (const assetDoc of assetsSnapshot.docs) {
      const assetId = assetDoc.id;
      const assetData = assetDoc.data();
      
      // Get all sound effects for this asset
      const soundEffectsSnapshot = await db
        .collection('assets')
        .doc(assetId)
        .collection('soundEffects')
        .get();
      
      if (soundEffectsSnapshot.empty) {
        continue;
      }
      
      console.log(`\nChecking asset: ${assetData.title || assetId}`);
      console.log(`  Found ${soundEffectsSnapshot.size} sound effect(s)`);
      
      const orphanedRefs = [];
      
      // Check each sound effect
      for (const soundEffectDoc of soundEffectsSnapshot.docs) {
        const soundEffectData = soundEffectDoc.data();
        const storagePath = soundEffectData?.storagePath;
        const fileName = soundEffectData?.fileName || 'unknown';
        
        if (!storagePath) {
          console.log(`  ⚠ Orphaned (no storagePath): ${fileName}`);
          orphanedRefs.push(soundEffectDoc.ref);
          continue;
        }
        
        // Check if file exists in Storage
        const exists = await fileExists(storagePath);
        if (!exists) {
          console.log(`  ❌ Orphaned (file not found): ${fileName}`);
          console.log(`     Path: ${storagePath}`);
          orphanedRefs.push(soundEffectDoc.ref);
        }
      }
      
      if (orphanedRefs.length > 0) {
        totalOrphaned += orphanedRefs.length;
        console.log(`  Found ${orphanedRefs.length} orphaned sound effect(s)`);
        
        if (!dryRun) {
          // Delete in batches of 500 (Firestore limit)
          const batchSize = 500;
          for (let i = 0; i < orphanedRefs.length; i += batchSize) {
            const batch = orphanedRefs.slice(i, i + batchSize);
            await deleteSoundEffectsBatch(batch);
            totalDeleted += batch.length;
          }
          console.log(`  ✓ Deleted ${orphanedRefs.length} orphaned sound effect(s)`);
        }
      }
    }
    
    console.log('\n' + '='.repeat(50));
    if (dryRun) {
      console.log(`\n📊 Summary (DRY RUN):`);
      console.log(`   Found ${totalOrphaned} orphaned sound effect document(s)`);
      console.log(`   Run without --dry-run to delete them`);
    } else {
      console.log(`\n✅ Summary:`);
      console.log(`   Deleted ${totalDeleted} orphaned sound effect document(s)`);
    }
    console.log('');
    
  } catch (error) {
    console.error('Error during cleanup:', error);
    process.exit(1);
  }
}

cleanupOrphanedSoundEffects();

