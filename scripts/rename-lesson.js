#!/usr/bin/env node

/**
 * Rename a lesson (and optionally update index and freePreview)
 *
 * Usage (interactive prompts):
 *   node scripts/rename-lesson.js
 *
 * Usage (flags):
 *   node scripts/rename-lesson.js --course technical-101 --module module-1 --lesson lesson-2 \
 *     --title "New Lesson Title" --index 2 --freePreview false
 *
 * Requires Firebase Admin credentials in env (same as other scripts):
 *   FIREBASE_ADMIN_PROJECT_ID, FIREBASE_ADMIN_CLIENT_EMAIL, FIREBASE_ADMIN_PRIVATE_KEY
 * or set GOOGLE_APPLICATION_CREDENTIALS to a service-account.json
 */

// Load environment variables from .env.local if available
try {
  require('dotenv').config({ path: '.env.local' });
} catch (e) {}

const admin = require('firebase-admin');
const readline = require('readline');

function getArg(name) {
  const idx = process.argv.findIndex((a) => a === `--${name}`);
  if (idx >= 0 && idx + 1 < process.argv.length) return process.argv[idx + 1];
  return undefined;
}

// Initialize Firebase Admin from GOOGLE_APPLICATION_CREDENTIALS or env vars
if (!admin.apps.length) {
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
    });
  } else {
    const serviceAccount = {
      projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    };
    if (!serviceAccount.projectId || !serviceAccount.clientEmail || !serviceAccount.privateKey) {
      console.error('❌ Missing Firebase Admin credentials.');
      console.error('Set GOOGLE_APPLICATION_CREDENTIALS or FIREBASE_ADMIN_* env vars.');
      process.exit(1);
    }
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  }
}

const db = admin.firestore();

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const question = (q) => new Promise((res) => rl.question(q, res));

async function run() {
  console.log('\n✏️  Lesson Renamer');

  // Read flags or prompt
  let courseId = getArg('course') || (await question('Course ID: '));
  let moduleId = getArg('module') || (await question('Module ID: '));
  let lessonId = getArg('lesson') || (await question('Lesson ID: '));
  let title = getArg('title') || (await question('New lesson title: '));
  let indexArg = getArg('index');
  let freePreviewArg = getArg('freePreview');

  if (!courseId || !moduleId || !lessonId || !title) {
    console.error('\n❌ course, module, lesson, and title are required');
    process.exit(1);
  }

  const index = typeof indexArg !== 'undefined' ? Number(indexArg) : undefined;
  const freePreview = typeof freePreviewArg !== 'undefined'
    ? /^(y|yes|true|1)$/i.test(String(freePreviewArg))
    : undefined;

  const ref = db
    .collection('courses').doc(courseId)
    .collection('modules').doc(moduleId)
    .collection('lessons').doc(lessonId);

  const snap = await ref.get();
  if (!snap.exists) {
    console.error(`\n❌ Lesson not found at courses/${courseId}/modules/${moduleId}/lessons/${lessonId}`);
    process.exit(1);
  }

  const update = { title, updatedAt: admin.firestore.FieldValue.serverTimestamp() };
  if (Number.isFinite(index)) update.index = index;
  if (typeof freePreview === 'boolean') update.freePreview = freePreview;

  await ref.set(update, { merge: true });

  console.log('\n✅ Updated:');
  console.log(`   Path: courses/${courseId}/modules/${moduleId}/lessons/${lessonId}`);
  console.log(`   Title: ${title}`);
  if (Number.isFinite(index)) console.log(`   Index: ${index}`);
  if (typeof freePreview === 'boolean') console.log(`   Free preview: ${freePreview}`);

  rl.close();
}

run().catch((e) => {
  console.error('\n❌ Error:', e?.message || e);
  rl.close();
  process.exit(1);
});


