#!/usr/bin/env node
/*
  Verify payment splits for marketplace orders to ensure sellers receive 97% correctly

  Requirements (env):
  - STRIPE_SECRET_KEY
  - FIREBASE_ADMIN_PROJECT_ID
  - FIREBASE_ADMIN_CLIENT_EMAIL
  - FIREBASE_ADMIN_PRIVATE_KEY

  Usage:
    node scripts/verify-payment-splits.js --orderId <orderId>
    node scripts/verify-payment-splits.js --checkoutSessionId <sessionId>
    node scripts/verify-payment-splits.js --paymentIntentId <piId>
    node scripts/verify-payment-splits.js --all (verify all recent orders)
    node scripts/verify-payment-splits.js --days 7 (verify orders from last 7 days)
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

function hasArg(name) {
  return process.argv.includes(name);
}

function computeApplicationFeeAmount(amountInCents) {
  const FEE_BPS = 300; // 3%
  return Math.round((amountInCents * FEE_BPS) / 10000);
}

async function verifyPaymentSplit(stripe, db, orderId, checkoutSessionId, paymentIntentId, sellerAccountId) {
  try {
    let session = null;
    let paymentIntent = null;
    let charge = null;

    // Fetch checkout session
    if (checkoutSessionId) {
      try {
        session = await stripe.checkout.sessions.retrieve(checkoutSessionId);
        if (sellerAccountId && !session.payment_intent) {
          // Try from connected account
          session = await stripe.checkout.sessions.retrieve(checkoutSessionId, { stripeAccount: sellerAccountId });
        }
      } catch (e) {
        if (sellerAccountId) {
          try {
            session = await stripe.checkout.sessions.retrieve(checkoutSessionId, { stripeAccount: sellerAccountId });
          } catch (e2) {
            console.error(`  ⚠ Could not retrieve session: ${e2.message}`);
          }
        }
      }
    }

    // Fetch payment intent
    const piId = paymentIntentId || session?.payment_intent;
    if (piId) {
      try {
        paymentIntent = await stripe.paymentIntents.retrieve(piId);
      } catch (e) {
        if (sellerAccountId) {
          try {
            paymentIntent = await stripe.paymentIntents.retrieve(piId, { stripeAccount: sellerAccountId });
          } catch (e2) {
            console.error(`  ⚠ Could not retrieve payment intent: ${e2.message}`);
          }
        }
      }
    }

    // Fetch charge
    if (paymentIntent?.latest_charge) {
      const chargeId = typeof paymentIntent.latest_charge === 'string' 
        ? paymentIntent.latest_charge 
        : paymentIntent.latest_charge.id;
      try {
        charge = await stripe.charges.retrieve(chargeId);
      } catch (e) {
        if (sellerAccountId) {
          try {
            charge = await stripe.charges.retrieve(chargeId, { stripeAccount: sellerAccountId });
          } catch (e2) {
            console.error(`  ⚠ Could not retrieve charge: ${e2.message}`);
          }
        }
      }
    }

    if (!paymentIntent && !session) {
      return { error: 'Could not fetch payment data from Stripe' };
    }

    const totalAmount = session?.amount_total || paymentIntent?.amount || 0;
    const expectedApplicationFee = computeApplicationFeeAmount(totalAmount);
    const expectedSellerAmount = totalAmount - expectedApplicationFee;
    const actualApplicationFee = paymentIntent?.application_fee_amount || 0;
    const actualTransferAmount = charge?.transfer?.amount || charge?.amount || 0;
    const stripeFee = totalAmount - actualApplicationFee - actualTransferAmount;

    const applicationFeeCorrect = Math.abs(actualApplicationFee - expectedApplicationFee) <= 1;
    const sellerAmountCorrect = Math.abs(actualTransferAmount - expectedSellerAmount) <= 100;

    return {
      orderId,
      checkoutSessionId: checkoutSessionId || session?.id,
      paymentIntentId: paymentIntent?.id,
      totalAmount,
      expectedApplicationFee,
      actualApplicationFee,
      expectedSellerAmount,
      actualTransferAmount,
      stripeFee,
      applicationFeeCorrect,
      sellerAmountCorrect,
      platformReceivedCorrect: actualApplicationFee >= expectedApplicationFee - 1,
      sellerReceivedCorrect: actualTransferAmount >= expectedSellerAmount - 100,
      status: paymentIntent?.status || session?.payment_status,
    };
  } catch (err) {
    return { error: err.message };
  }
}

async function main() {
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) throw new Error('Missing STRIPE_SECRET_KEY');
  const stripe = new Stripe(stripeKey, { apiVersion: '2023-10-16' });
  const db = initAdmin();

  const orderId = getArg('--orderId', null);
  const checkoutSessionId = getArg('--checkoutSessionId', null);
  const paymentIntentId = getArg('--paymentIntentId', null);
  const verifyAll = hasArg('--all');
  const days = Number(getArg('--days', verifyAll ? 30 : null));

  if (orderId || checkoutSessionId || paymentIntentId) {
    // Verify single order
    let order = null;
    if (orderId) {
      const orderDoc = await db.collection('orders').doc(orderId).get();
      if (!orderDoc.exists) {
        console.error(`Order ${orderId} not found`);
        process.exit(1);
      }
      order = { id: orderDoc.id, ...orderDoc.data() };
    }

    const result = await verifyPaymentSplit(
      stripe,
      db,
      order?.id,
      checkoutSessionId || order?.checkoutSessionId,
      paymentIntentId || order?.paymentIntentId,
      order?.sellerAccountId
    );

    if (result.error) {
      console.error(`Error: ${result.error}`);
      process.exit(1);
    }

    console.log('\n=== Payment Split Verification ===');
    console.log(`Order ID: ${result.orderId || 'N/A'}`);
    console.log(`Checkout Session: ${result.checkoutSessionId || 'N/A'}`);
    console.log(`Payment Intent: ${result.paymentIntentId || 'N/A'}`);
    console.log(`Status: ${result.status || 'N/A'}`);
    console.log('\nAmounts:');
    console.log(`  Total Charged: $${(result.totalAmount / 100).toFixed(2)}`);
    console.log(`  Expected Platform Fee (3%): $${(result.expectedApplicationFee / 100).toFixed(2)}`);
    console.log(`  Actual Platform Fee: $${(result.actualApplicationFee / 100).toFixed(2)}`);
    console.log(`  Expected Seller Amount (97%): $${(result.expectedSellerAmount / 100).toFixed(2)}`);
    console.log(`  Actual Transfer to Seller: $${(result.actualTransferAmount / 100).toFixed(2)}`);
    console.log(`  Stripe Processing Fee: $${(result.stripeFee / 100).toFixed(2)}`);
    console.log('\nVerification:');
    console.log(`  Platform Fee Correct: ${result.applicationFeeCorrect ? '✓' : '✗'}`);
    console.log(`  Seller Amount Correct: ${result.sellerAmountCorrect ? '✓' : '✗'}`);
    console.log(`  Platform Received Correct: ${result.platformReceivedCorrect ? '✓' : '✗'}`);
    console.log(`  Seller Received Correct: ${result.sellerReceivedCorrect ? '✓' : '✗'}`);
    console.log('\nNote: Seller receives 97% minus Stripe processing fees (~2.9% + $0.30 for US cards)');

    if (!result.applicationFeeCorrect || !result.sellerReceivedCorrect) {
      console.error('\n⚠ WARNING: Payment split verification failed!');
      process.exit(1);
    }
  } else if (verifyAll || days) {
    // Verify multiple orders
    const since = days ? Date.now() - (days * 24 * 60 * 60 * 1000) : 0;
    console.log(`Verifying orders${days ? ` from last ${days} days` : ' (all)'}...\n`);

    let query = db.collection('orders').orderBy('createdAt', 'desc');
    if (since) {
      query = query.where('createdAt', '>=', admin.firestore.Timestamp.fromMillis(since));
    }
    const snapshot = await query.limit(100).get();

    if (snapshot.empty) {
      console.log('No orders found');
      return;
    }

    let verified = 0;
    let failed = 0;

    for (const doc of snapshot.docs) {
      const order = { id: doc.id, ...doc.data() };
      const result = await verifyPaymentSplit(
        stripe,
        db,
        order.id,
        order.checkoutSessionId,
        order.paymentIntentId,
        order.sellerAccountId
      );

      if (result.error) {
        console.log(`✗ ${order.id}: ${result.error}`);
        failed++;
        continue;
      }

      const platformOk = result.applicationFeeCorrect && result.platformReceivedCorrect;
      const sellerOk = result.sellerReceivedCorrect;

      if (platformOk && sellerOk) {
        console.log(`✓ ${order.id}: $${(result.totalAmount / 100).toFixed(2)} - Platform: $${(result.actualApplicationFee / 100).toFixed(2)}, Seller: $${(result.actualTransferAmount / 100).toFixed(2)}`);
        verified++;
      } else {
        console.log(`✗ ${order.id}: FAILED - Platform: ${platformOk ? '✓' : '✗'}, Seller: ${sellerOk ? '✓' : '✗'}`);
        failed++;
      }
    }

    console.log(`\n=== Summary ===`);
    console.log(`Verified: ${verified}`);
    console.log(`Failed: ${failed}`);
    console.log(`Total: ${verified + failed}`);

    if (failed > 0) {
      process.exit(1);
    }
  } else {
    console.error('Usage:');
    console.error('  node scripts/verify-payment-splits.js --orderId <orderId>');
    console.error('  node scripts/verify-payment-splits.js --checkoutSessionId <sessionId>');
    console.error('  node scripts/verify-payment-splits.js --paymentIntentId <piId>');
    console.error('  node scripts/verify-payment-splits.js --all');
    console.error('  node scripts/verify-payment-splits.js --days 7');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

