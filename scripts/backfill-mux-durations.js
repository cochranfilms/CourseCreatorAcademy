#!/usr/bin/env node

/**
 * Backfill lesson durationSec (and playbackId when missing) from Mux
 *
 * Requires:
 *  - GOOGLE_APPLICATION_CREDENTIALS (or FIREBASE_ADMIN_* envs)
 *  - MUX_TOKEN_ID, MUX_TOKEN_SECRET
 *
 * Usage:
 *   node scripts/backfill-mux-durations.js [courseId]
 */

try { require('dotenv').config({ path: '.env.local' }); } catch (e) {}

const admin = require('firebase-admin');
const { Mux } = require('@mux/mux-node');

if (!admin.apps.length) {
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    admin.initializeApp({ credential: admin.credential.applicationDefault() });
  } else {
    const serviceAccount = {
      projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    };
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  }
}

const db = admin.firestore();
const mux = new Mux({ tokenId: process.env.MUX_TOKEN_ID, tokenSecret: process.env.MUX_TOKEN_SECRET });

async function run() {
  const targetCourse = process.argv[2];
  let updated = 0, skipped = 0, failed = 0;

  const coursesSnap = targetCourse ? [await db.collection('courses').doc(targetCourse).get()] : (await db.collection('courses').get()).docs;

  for (const courseDoc of coursesSnap) {
    if (!courseDoc.exists) continue;
    const courseId = courseDoc.id;
    const modulesSnap = await db.collection('courses').doc(courseId).collection('modules').get();
    for (const moduleDoc of modulesSnap.docs) {
      const lessonsSnap = await moduleDoc.ref.collection('lessons').get();
      for (const lessonDoc of lessonsSnap.docs) {
        const data = lessonDoc.data();
        const assetId = data.muxAssetId;
        if (!assetId) { skipped++; continue; }
        try {
          const asset = await mux.video.assets.retrieve(assetId);
          const duration = asset?.duration ? Math.round(Number(asset.duration)) : 0;
          const playbackId = asset?.playback_ids?.[0]?.id || data.muxPlaybackId || null;
          if ((data.durationSec || 0) === duration && (data.muxPlaybackId || null) === playbackId) { skipped++; continue; }
          await lessonDoc.ref.set({ durationSec: duration, muxPlaybackId: playbackId, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
          updated++;
          console.log(`Updated ${courseId}/${moduleDoc.id}/${lessonDoc.id} -> duration ${duration}s`);
        } catch (e) {
          failed++;
          console.error(`Failed ${courseId}/${moduleDoc.id}/${lessonDoc.id}:`, e?.message || e);
        }
      }
    }
  }

  console.log(`\nDone. Updated: ${updated}, Skipped: ${skipped}, Failed: ${failed}`);
}

run().catch((e) => { console.error(e); process.exit(1); });


