#!/usr/bin/env node
/*
  Delete old test marketplace listings created by the original seeding script.

  What it does:
  - Removes documents in Firestore collection `listings` whose `creatorId`
    matches the known test IDs used by the seed script: test_user_1..5
  - Operates in batches for safety and to avoid exceeding Firestore limits
  - Prints a summary at the end

  Requirements (env):
  - FIREBASE_ADMIN_PROJECT_ID
  - FIREBASE_ADMIN_CLIENT_EMAIL
  - FIREBASE_ADMIN_PRIVATE_KEY

  Usage:
    node scripts/delete-old-test-listings.js
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

async function deleteQueryBatch(db, query, chunkLabel) {
  const snapshot = await query.get();
  if (snapshot.empty) {
    return 0;
  }
  const batch = db.batch();
  let count = 0;
  snapshot.docs.forEach(doc => {
    batch.delete(doc.ref);
    count++;
  });
  await batch.commit();
  console.log(`   ✓ Deleted ${count} docs${chunkLabel ? ` (${chunkLabel})` : ''}`);
  // Recurse until no more documents match
  return count;
}

async function main() {
  console.log('🧹 Deleting old test marketplace listings...\n');
  const db = initAdmin();

  // These are the test creatorIds used by scripts/seed-test-data.js
  const testCreatorIds = ['test_user_1', 'test_user_2', 'test_user_3', 'test_user_4', 'test_user_5'];

  try {
    let totalDeleted = 0;

    // Firestore supports "in" up to 10 elements; we only have 5 here.
    const baseQuery = db.collection('listings').where('creatorId', 'in', testCreatorIds);

    // Delete in batches until none remain
    // We page in loops to avoid large memory usage.
    while (true) {
      const pageQuery = baseQuery.limit(500);
      const deleted = await deleteQueryBatch(db, pageQuery, 'batch');
      totalDeleted += deleted;
      if (deleted === 0) break;
      // Small delay to avoid hammering Firestore
      await new Promise(r => setTimeout(r, 200));
    }

    console.log('\n✅ Deletion complete!');
    console.log(`   Total listings deleted: ${totalDeleted}`);
  } catch (err) {
    console.error('\n❌ Error during deletion:', err);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});


