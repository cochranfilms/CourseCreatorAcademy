#!/usr/bin/env node
/*
  Backfill animated GIF thumbnail URLs for existing MUX assets

  This script generates animated GIF URLs for all lessons that have muxPlaybackId
  but don't have muxAnimatedGifUrl yet.

  Requirements (env):
  - FIREBASE_ADMIN_PROJECT_ID
  - FIREBASE_ADMIN_CLIENT_EMAIL
  - FIREBASE_ADMIN_PRIVATE_KEY

  Usage:
    node scripts/backfill-mux-animated-gifs.js
    node scripts/backfill-mux-animated-gifs.js --width 640
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

function getArg(name, def) {
  const idx = process.argv.indexOf(name);
  if (idx > -1 && process.argv[idx + 1]) return process.argv[idx + 1];
  return def;
}

function generateAnimatedGifUrl(playbackId, width = 320) {
  if (!playbackId) return null;
  return `https://image.mux.com/${playbackId}/animated.gif?width=${Math.min(width, 640)}`;
}

async function main() {
  const db = initAdmin();
  const width = Number(getArg('--width', 320));

  console.log(`\n🎬 Backfilling animated GIF URLs for MUX assets...`);
  console.log(`   Width: ${width}px\n`);

  // Find all lessons with muxPlaybackId but no muxAnimatedGifUrl
  const lessonsQuery = db.collectionGroup('lessons');
  const snapshot = await lessonsQuery.get();

  let processed = 0;
  let updated = 0;
  let skipped = 0;

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const playbackId = data.muxPlaybackId;
    const existingGifUrl = data.muxAnimatedGifUrl;

    if (!playbackId) {
      skipped++;
      continue;
    }

    processed++;

    // Skip if already has animated GIF URL
    if (existingGifUrl) {
      skipped++;
      continue;
    }

    try {
      const animatedGifUrl = generateAnimatedGifUrl(playbackId, width);
      if (animatedGifUrl) {
        await doc.ref.set({
          muxAnimatedGifUrl: animatedGifUrl,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
        updated++;
        console.log(`✓ Updated: ${doc.ref.path} (${playbackId.substring(0, 20)}...)`);
      }
    } catch (err) {
      console.error(`✗ Error updating ${doc.ref.path}:`, err.message);
    }
  }

  console.log(`\n=== Summary ===`);
  console.log(`Processed: ${processed}`);
  console.log(`Updated: ${updated}`);
  console.log(`Skipped: ${skipped} (no playbackId or already has GIF URL)`);
  console.log(`\nDone! 🎉`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

