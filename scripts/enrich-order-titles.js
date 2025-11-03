#!/usr/bin/env node
/*
  Enrich existing orders with listing titles from Firestore `listings/{listingId}`.

  Uses Firebase Admin. Auth options:
  - Preferred: export GOOGLE_APPLICATION_CREDENTIALS=/abs/path/to/service-account.json
  - Fallback env: FIREBASE_ADMIN_PROJECT_ID, FIREBASE_ADMIN_CLIENT_EMAIL, FIREBASE_ADMIN_PRIVATE_KEY

  Usage:
    node scripts/enrich-order-titles.js [--limit 1000] [--dry]
*/

// Load env from .env.local then .env (harmless if missing)
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
  const idx = process.argv.indexOf(name);
  if (idx > -1 && process.argv[idx + 1]) return process.argv[idx + 1];
  return def;
}

async function main() {
  const db = initAdmin();
  const hardLimit = Number(getArg('--limit', '1000'));
  const dry = process.argv.includes('--dry');

  console.log(`Scanning up to ${hardLimit} orders for missing titles...`);

  // Strategy:
  // 1) Try orders where listingTitle == null
  // 2) Also scan recent orders and fix those with undefined/empty listingTitle (cannot be queried)
  const targets = new Map();

  const nullSnap = await db.collection('orders').where('listingTitle', '==', null).limit(hardLimit).get().catch(() => null);
  if (nullSnap && !nullSnap.empty) {
    nullSnap.docs.forEach(d => targets.set(d.id, d));
  }

  // Fallback: scan recent orders by createdAt
  const recentSnap = await db.collection('orders').orderBy('createdAt', 'desc').limit(hardLimit).get().catch(() => null);
  if (recentSnap && !recentSnap.empty) {
    recentSnap.docs.forEach(d => {
      const data = d.data() || {};
      const needs = !data.listingTitle || String(data.listingTitle).trim() === '';
      if (needs) targets.set(d.id, d);
    });
  }

  if (targets.size === 0) {
    console.log('No candidate orders found to enrich.');
    return;
  }

  let updated = 0;
  for (const docSnap of targets.values()) {
    const order = docSnap.data() || {};
    const listingId = order.listingId;
    if (!listingId) continue;

    try {
      const listingSnap = await db.collection('listings').doc(listingId).get();
      const listing = listingSnap.exists ? listingSnap.data() : null;
      const title = listing && listing.title ? String(listing.title) : null;
      if (!title) continue;

      if (!dry) {
        await docSnap.ref.update({ listingTitle: title });
      }
      updated++;
      console.log(`${dry ? '[DRY] ' : ''}Updated order ${docSnap.id} -> listingTitle="${title}"`);
    } catch (e) {
      console.warn(`Failed to update order ${docSnap.id}:`, e.message || e);
    }
  }

  console.log(`Done. ${dry ? 'Would update' : 'Updated'} ${updated} orders.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});


