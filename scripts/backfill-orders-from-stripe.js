#!/usr/bin/env node
/*
  Backfill Firestore orders from Stripe Connect events (checkout.session.completed)

  Requirements (env):
  - STRIPE_SECRET_KEY
  - FIREBASE_ADMIN_PROJECT_ID
  - FIREBASE_ADMIN_CLIENT_EMAIL
  - FIREBASE_ADMIN_PRIVATE_KEY (with \n newlines or real newlines)

  Usage:
    node scripts/backfill-orders-from-stripe.js --days 180
*/

// Load env from .env.local first, then fallback to .env
try {
  require('dotenv').config({ path: '.env.local' });
} catch {}
require('dotenv').config();
const Stripe = require('stripe');
const admin = require('firebase-admin');

function initAdmin() {
  if (admin.apps.length) return admin.firestore();
  // Prefer "application default credentials" if GOOGLE_APPLICATION_CREDENTIALS is set
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
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) throw new Error('Missing STRIPE_SECRET_KEY');
  const stripe = new Stripe(stripeKey, { apiVersion: '2023-10-16' });
  const db = initAdmin();

  const days = Number(getArg('--days', '90'));
  const since = Math.floor(Date.now() / 1000) - days * 24 * 60 * 60;

  console.log(`Backfilling orders from the last ${days} days (>= ${since})...`);

  // Iterate all connected accounts
  let processed = 0;
  // Iterate all connected accounts (auto pagination via async iterator)
  for await (const account of stripe.accounts.list({ limit: 100 })) {
    const accountId = account.id;
    console.log(`\nAccount ${accountId}: fetching checkout.session.completed events...`);

    const events = stripe.events.list({
      limit: 100,
      type: 'checkout.session.completed',
      created: { gte: since }
    }, { stripeAccount: accountId });

    // Iterate all events for this connected account
    for await (const evt of events) {
      const session = evt.data && evt.data.object ? evt.data.object : null;
      if (!session) continue;
      if (session.payment_status !== 'paid') continue;

      const checkoutSessionId = session.id;
      const existing = await db.collection('orders').where('checkoutSessionId', '==', checkoutSessionId).limit(1).get();
      if (!existing.empty) {
        continue; // already backfilled by webhook or prior run
      }

      const now = Date.now();
      const deadlineMs = 72 * 60 * 60 * 1000;

      const orderDoc = {
        checkoutSessionId,
        paymentIntentId: session.payment_intent || null,
        amount: session.amount_total || 0,
        currency: session.currency || 'usd',
        application_fee_amount: Number((session.metadata && session.metadata.applicationFeeAmount) || 0),
        listingId: session.metadata && session.metadata.listingId ? String(session.metadata.listingId) : null,
        listingTitle: session.metadata && session.metadata.listingTitle ? String(session.metadata.listingTitle) : null,
        buyerId: session.metadata && session.metadata.buyerId ? String(session.metadata.buyerId) : null,
        sellerId: session.metadata && session.metadata.sellerId ? String(session.metadata.sellerId) : null,
        sellerAccountId: accountId,
        shippingDetails: session.shipping_details || null,
        status: 'awaiting_tracking',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        trackingDeadlineAtMs: now + deadlineMs,
      };

      await db.collection('orders').add(orderDoc);
      processed++;
      console.log(`+ Created order for session ${checkoutSessionId}`);
    }
  }

  console.log(`\nDone. Created ${processed} orders.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});


