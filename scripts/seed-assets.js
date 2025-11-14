#!/usr/bin/env node
/*
  Seed sample assets for testing the /assets page

  Requirements (env):
  - FIREBASE_ADMIN_PROJECT_ID
  - FIREBASE_ADMIN_CLIENT_EMAIL
  - FIREBASE_ADMIN_PRIVATE_KEY

  Usage:
    node scripts/seed-assets.js

  Note: This creates sample assets with placeholder storage paths.
  You'll need to upload actual files to Firebase Storage and update the storagePath values.
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

const sampleAssets = [
  // LUTs & Presets (2 assets)
  {
    title: 'Sleektone Minimal LUTs',
    category: 'LUTs & Presets',
    description: 'Professional color grading LUTs for a clean, minimal aesthetic',
    storagePath: 'assets/luts/sleektone-minimal-luts.zip',
    fileType: 'zip',
    thumbnailUrl: 'https://via.placeholder.com/400x300/1a1a1a/ffffff?text=Sleektone+LUTs',
  },
  {
    title: 'Cinematic Color Pack',
    category: 'LUTs & Presets',
    description: 'A collection of cinematic color grading presets for video editing',
    storagePath: 'assets/luts/cinematic-color-pack.zip',
    fileType: 'zip',
    thumbnailUrl: 'https://via.placeholder.com/400x300/1a1a1a/ffffff?text=Cinematic+Color',
  },
  
  // Overlays & Transitions (2 assets)
  {
    title: 'Cinematic Flares Vol.1',
    category: 'Overlays & Transitions',
    description: 'Professional lens flares and light leaks for cinematic effects',
    storagePath: 'assets/overlays/cinematic-flares-vol1.zip',
    fileType: 'zip',
    thumbnailUrl: 'https://via.placeholder.com/400x300/1a1a1a/ffffff?text=Cinematic+Flares',
  },
  {
    title: 'Smooth Transitions Pack',
    category: 'Overlays & Transitions',
    description: 'Smooth, professional transition effects for video editing',
    storagePath: 'assets/overlays/smooth-transitions.zip',
    fileType: 'zip',
    thumbnailUrl: 'https://via.placeholder.com/400x300/1a1a1a/ffffff?text=Transitions',
  },
  
  // SFX & Plugins (2 assets)
  {
    title: 'Flash & Pop SFX',
    category: 'SFX & Plugins',
    description: 'High-quality sound effects for flash and pop transitions',
    storagePath: 'assets/sfx/flash-pop-sfx.zip',
    fileType: 'zip',
    thumbnailUrl: 'https://via.placeholder.com/400x300/1a1a1a/ffffff?text=Flash+Pop+SFX',
  },
  {
    title: 'Ambient Sound Library',
    category: 'SFX & Plugins',
    description: 'A comprehensive library of ambient sounds and background audio',
    storagePath: 'assets/sfx/ambient-sound-library.zip',
    fileType: 'zip',
    thumbnailUrl: 'https://via.placeholder.com/400x300/1a1a1a/ffffff?text=Ambient+SFX',
  },
  
  // Templates (2 assets)
  {
    title: 'After Effects Title Pack',
    category: 'Templates',
    description: 'Professional title animations and lower thirds for After Effects',
    storagePath: 'assets/templates/ae-title-pack.zip',
    fileType: 'zip',
    thumbnailUrl: 'https://via.placeholder.com/400x300/1a1a1a/ffffff?text=AE+Titles',
  },
  {
    title: 'Premiere Pro Editing Template',
    category: 'Templates',
    description: 'Ready-to-use editing template with transitions and effects',
    storagePath: 'assets/templates/premiere-template.zip',
    fileType: 'zip',
    thumbnailUrl: 'https://via.placeholder.com/400x300/1a1a1a/ffffff?text=Premiere+Template',
  },
];

async function seedAssets() {
  const db = initAdmin();
  console.log('Seeding sample assets...\n');

  for (const asset of sampleAssets) {
    try {
      // Check if asset already exists (by title)
      const existing = await db.collection('assets')
        .where('title', '==', asset.title)
        .limit(1)
        .get();

      if (!existing.empty) {
        console.log(`⏭️  Skipping "${asset.title}" (already exists)`);
        continue;
      }

      const assetData = {
        ...asset,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      const docRef = await db.collection('assets').add(assetData);
      console.log(`✅ Created asset: "${asset.title}" (${docRef.id})`);
    } catch (error) {
      console.error(`❌ Error creating asset "${asset.title}":`, error.message);
    }
  }

  console.log('\n✨ Seeding complete!');
  console.log('\n📝 Note: These assets have placeholder storage paths.');
  console.log('   To make downloads work, upload actual files to Firebase Storage');
  console.log('   and update the storagePath values in Firestore.');
  console.log('\n   Example storage path: assets/luts/sleektone-minimal-luts.zip');
}

seedAssets().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

