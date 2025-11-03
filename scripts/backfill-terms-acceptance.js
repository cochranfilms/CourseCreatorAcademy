#!/usr/bin/env node
/*
  Backfill Terms acceptance for existing users.

  Usage:
    node scripts/backfill-terms-acceptance.js --version 2025-11-03 [--dry] [--update-config]

  Auth options:
    - Preferred: export GOOGLE_APPLICATION_CREDENTIALS=/abs/path/service-account.json
    - Fallback env: FIREBASE_ADMIN_PROJECT_ID, FIREBASE_ADMIN_CLIENT_EMAIL, FIREBASE_ADMIN_PRIVATE_KEY
*/

// Load env from .env.local then .env
try { require('dotenv').config({ path: '.env.local' }); } catch {}
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
      throw new Error('Missing Firebase Admin credentials. Set GOOGLE_APPLICATION_CREDENTIALS or FIREBASE_ADMIN_* env vars.');
    }
    admin.initializeApp({ credential: admin.credential.cert({ projectId, clientEmail, privateKey }) });
  }
  const db = admin.firestore();
  db.settings({ ignoreUndefinedProperties: true });
  return db;
}

function getArg(name, def) {
  const i = process.argv.indexOf(name);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : def;
}

async function main() {
  const db = initAdmin();
  const version = getArg('--version');
  const dry = process.argv.includes('--dry');
  const updateConfig = process.argv.includes('--update-config');
  if (!version) throw new Error('Missing --version YYYY-MM-DD');

  if (updateConfig) {
    await db.collection('config').doc('terms').set({ requiredVersion: version }, { merge: true });
    console.log(`Set config/terms.requiredVersion = ${version}`);
  }

  console.log(`Backfilling terms.accepted for users to version ${version}${dry ? ' (DRY RUN)' : ''}...`);

  const usersRef = db.collection('users');
  const snapshot = await usersRef.get();
  if (snapshot.empty) {
    console.log('No users found.');
    return;
  }

  let updated = 0;
  let batch = db.batch();
  let batchCount = 0;

  for (const docSnap of snapshot.docs) {
    const data = docSnap.data() || {};
    const needsUpdate = !data.terms || data.terms.version !== version || data.terms.accepted !== true;
    if (!needsUpdate) continue;

    const patch = {
      terms: {
        accepted: true,
        version,
        acceptedAt: admin.firestore.FieldValue.serverTimestamp(),
        acceptedBy: 'admin_backfill',
        acceptedMethod: 'backfill'
      }
    };

    if (dry) {
      updated++;
      continue;
    }

    batch.update(docSnap.ref, patch, { merge: true });
    batchCount++;
    updated++;

    if (batchCount >= 400) {
      await batch.commit();
      batch = db.batch();
      batchCount = 0;
    }
  }

  if (!dry && batchCount > 0) {
    await batch.commit();
  }

  console.log(`${dry ? 'Would update' : 'Updated'} ${updated} user(s).`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});


