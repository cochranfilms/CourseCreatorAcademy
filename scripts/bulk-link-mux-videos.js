#!/usr/bin/env node

/**
 * Bulk link many Mux assets to Firestore lessons.
 *
 * Usage:
 *   node scripts/bulk-link-mux-videos.js path/to/mapping.csv
 *   node scripts/bulk-link-mux-videos.js path/to/mapping.json
 *
 * CSV columns (header required):
 *   courseId,moduleId,lessonId,assetId,playbackId,title,index,freePreview,durationSec
 * - playbackId optional (will be fetched from Mux if missing)
 * - title/index/freePreview/durationSec optional
 *
 * JSON format: Array of objects with the same keys as above
 */

// Load env from .env.local if present
try { require('dotenv').config({ path: '.env.local' }); } catch {}

const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');
const { Mux } = require('@mux/mux-node');

function exitWith(msg) {
  console.error(`\n❌ ${msg}\n`);
  process.exit(1);
}

async function readMapping(filePath) {
  const abs = path.resolve(filePath);
  if (!fs.existsSync(abs)) {
    exitWith(`Mapping file not found: ${abs}`);
  }
  const raw = fs.readFileSync(abs, 'utf8');
  if (abs.endsWith('.json')) {
    try {
      const data = JSON.parse(raw);
      if (!Array.isArray(data)) exitWith('JSON must be an array of rows');
      return data;
    } catch (e) {
      exitWith(`Invalid JSON: ${e.message}`);
    }
  }
  // Simple CSV parser (no quotes/escapes). Expect header in first line.
  const lines = raw.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) exitWith('CSV appears empty');
  const headers = lines[0].split(',').map(h => h.trim());
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map(c => c.trim());
    const row = {};
    headers.forEach((h, idx) => { row[h] = cols[idx]; });
    rows.push(row);
  }
  return rows;
}

function initAdmin() {
  if (admin.apps.length) return admin.firestore();
  const serviceAccount = {
    projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
    clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  };
  if (!serviceAccount.projectId || !serviceAccount.clientEmail || !serviceAccount.privateKey) {
    exitWith('Missing Firebase Admin env: FIREBASE_ADMIN_PROJECT_ID, FIREBASE_ADMIN_CLIENT_EMAIL, FIREBASE_ADMIN_PRIVATE_KEY');
  }
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  return admin.firestore();
}

function initMux() {
  const tokenId = process.env.MUX_TOKEN_ID;
  const tokenSecret = process.env.MUX_TOKEN_SECRET;
  if (!tokenId || !tokenSecret) exitWith('Missing MUX_TOKEN_ID/MUX_TOKEN_SECRET');
  return new Mux({ tokenId, tokenSecret });
}

async function ensureCourseModule(db, courseId, moduleId, options) {
  const courseRef = db.collection('courses').doc(courseId);
  const courseDoc = await courseRef.get();
  if (!courseDoc.exists) {
    await courseRef.set({
      title: options?.courseTitle || courseId,
      slug: options?.courseSlug || courseId,
      summary: '',
      price: 0,
      isSubscription: false,
      featured: false,
      categories: [],
      modulesCount: 0,
      lessonsCount: 0,
      createdBy: 'admin',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      published: false,
    });
  }
  const moduleRef = courseRef.collection('modules').doc(moduleId);
  const moduleDoc = await moduleRef.get();
  if (!moduleDoc.exists) {
    await moduleRef.set({
      title: options?.moduleTitle || moduleId,
      index: Number(options?.moduleIndex || 1),
    });
    const data = (await courseRef.get()).data();
    await courseRef.update({
      modulesCount: (data?.modulesCount || 0) + 1,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }
  return { courseRef, moduleRef };
}

async function run() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.log('\nUsage: node scripts/bulk-link-mux-videos.js <mapping.csv|mapping.json>\n');
    process.exit(1);
  }

  const rows = await readMapping(filePath);
  const db = initAdmin();
  const mux = initMux();

  let ok = 0, fail = 0;
  console.log(`\n🎬 Linking ${rows.length} rows...\n`);

  for (const row of rows) {
    try {
      const courseId = String(row.courseId || row.course || row.slug || '').trim();
      const moduleId = String(row.moduleId || row.module || '').trim();
      const lessonId = String(row.lessonId || row.lesson || '').trim();
      let assetId = String(row.assetId || row.muxAssetId || '').trim();
      let playbackId = String(row.playbackId || row.muxPlaybackId || '').trim();
      const title = row.title ? String(row.title).trim() : '';
      const index = row.index ? Number(row.index) : 1;
      const freePreview = typeof row.freePreview === 'string' ? row.freePreview.toLowerCase() === 'y' || row.freePreview.toLowerCase() === 'true' : Boolean(row.freePreview);
      const durationSec = row.durationSec ? Number(row.durationSec) : undefined;

      if (!courseId || !moduleId || !lessonId || !assetId) {
        throw new Error('Missing required fields (courseId,moduleId,lessonId,assetId)');
      }

      if (!playbackId) {
        const asset = await mux.video.assets.retrieve(assetId);
        playbackId = asset?.playback_ids?.[0]?.id || '';
        if (!playbackId) throw new Error(`Playback ID not found for asset ${assetId}`);
      }

      const { courseRef, moduleRef } = await ensureCourseModule(db, courseId, moduleId, {});
      const lessonRef = moduleRef.collection('lessons').doc(lessonId);
      const lessonDoc = await lessonRef.get();
      const base = {
        muxAssetId: assetId,
        muxPlaybackId: playbackId,
        index,
        freePreview,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };
      if (title) base.title = title;
      if (typeof durationSec === 'number' && !Number.isNaN(durationSec)) base.durationSec = durationSec;

      if (lessonDoc.exists) {
        await lessonRef.set(base, { merge: true });
      } else {
        await lessonRef.set({
          title: title || `Lesson ${index}`,
          ...base,
          resources: [],
          transcriptPath: null,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        const cdoc = await courseRef.get();
        await courseRef.update({
          lessonsCount: (cdoc.data()?.lessonsCount || 0) + 1,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }

      console.log(`✅ ${courseId}/${moduleId}/${lessonId} ← asset ${assetId}`);
      ok++;
    } catch (e) {
      console.error(`❌ Row failed: ${e.message}`);
      fail++;
    }
  }

  console.log(`\nDone. Success: ${ok}, Failed: ${fail}\n`);
  process.exit(fail ? 1 : 0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});


