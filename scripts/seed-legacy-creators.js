#!/usr/bin/env node
/*
  Seed test Legacy Creators for development/testing

  Requirements (env):
  - FIREBASE_ADMIN_PROJECT_ID
  - FIREBASE_ADMIN_CLIENT_EMAIL
  - FIREBASE_ADMIN_PRIVATE_KEY

  Usage:
    node scripts/seed-legacy-creators.js
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

async function main() {
  const db = initAdmin();

  // Test Legacy Creators
  const creators = [
    {
      handle: 'PETER',
      displayName: 'Peter McKinnon',
      avatarUrl: null,
      bannerUrl: null,
      bio: 'Award-winning filmmaker and photographer known for cinematic tutorials and storytelling techniques. Peter brings years of professional experience into easy-to-follow lessons.',
      kitSlug: 'peter-mckinnon',
      connectAccountId: null, // Will need to be set when Stripe Connect is set up
      samplesCount: 0,
      order: 1,
    },
    {
      handle: 'SHORT',
      displayName: 'Garrett King',
      avatarUrl: null,
      bannerUrl: null,
      bio: 'Professional photographer and content creator specializing in travel and lifestyle photography. Known for stunning visual storytelling and creative techniques.',
      kitSlug: 'garrett-king',
      connectAccountId: null, // Will need to be set when Stripe Connect is set up
      samplesCount: 0,
      order: 2,
    },
  ];

  console.log('\n🎬 Creating test Legacy Creators...\n');

  for (const creator of creators) {
    try {
      // Check if creator already exists
      const existing = await db.collection('legacy_creators')
        .where('handle', '==', creator.handle)
        .limit(1)
        .get();

      if (!existing.empty) {
        const existingDoc = existing.docs[0];
        console.log(`⚠ ${creator.displayName} already exists (${existingDoc.id}). Skipping...`);
        continue;
      }

      // Create creator document
      const docRef = await db.collection('legacy_creators').add({
        ...creator,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      console.log(`✓ Created ${creator.displayName} (${docRef.id})`);
      console.log(`  Handle: @${creator.handle}`);
      console.log(`  Kit Slug: /creator-kits/${creator.kitSlug}`);
      console.log(`  Note: Set connectAccountId when Stripe Connect is configured\n`);
    } catch (err) {
      console.error(`✗ Error creating ${creator.displayName}:`, err.message);
    }
  }

  console.log('Done! 🎉');
  console.log('\nNext steps:');
  console.log('1. Configure Stripe Connect accounts for each creator');
  console.log('2. Set connectAccountId in Firestore for each creator');
  console.log('3. Upload at least 3 sample videos for each creator');
  console.log('4. Test subscription flow');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

