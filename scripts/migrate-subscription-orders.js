#!/usr/bin/env node
/*
  Migrate existing orders that are subscription upgrades/downgrades but were incorrectly labeled as marketplace orders
  
  This script identifies orders that:
  1. Have no sellerId (subscription changes don't have sellers)
  2. Have a checkoutSessionId that matches a subscription upgrade checkout session
  3. Or have listingTitle like "Listing -" (generic placeholder)
  
  Requirements (env):
  - STRIPE_SECRET_KEY
  - FIREBASE_ADMIN_PROJECT_ID
  - FIREBASE_ADMIN_CLIENT_EMAIL
  - FIREBASE_ADMIN_PRIVATE_KEY (with \n newlines or real newlines)

  Usage:
    node scripts/migrate-subscription-orders.js [--dry-run]
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

function getArg(name) {
  return process.argv.includes(name);
}

const planNames = {
  cca_monthly_37: 'Monthly Membership',
  cca_no_fees_60: 'No-Fees Membership',
  cca_membership_87: 'All-Access Membership',
};

async function main() {
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) throw new Error('Missing STRIPE_SECRET_KEY');
  const stripe = new Stripe(stripeKey, { apiVersion: '2023-10-16' });
  const db = initAdmin();
  const dryRun = getArg('--dry-run');

  console.log(`\n${dryRun ? 'DRY RUN: ' : ''}Migrating subscription orders...\n`);

  // Find orders that might be subscription changes:
  // 1. No sellerId (subscription changes don't have sellers)
  // 2. Have checkoutSessionId
  // 3. Don't already have orderType set to 'subscription_change'
  const ordersSnapshot = await db.collection('orders')
    .where('sellerId', '==', null)
    .get();

  console.log(`Found ${ordersSnapshot.size} orders without sellerId`);

  let migrated = 0;
  let skipped = 0;
  let errors = 0;

  for (const doc of ordersSnapshot.docs) {
    const order = { id: doc.id, ...doc.data() };
    
    // Skip if already migrated
    if (order.orderType === 'subscription_change') {
      skipped++;
      continue;
    }

    // Skip if no checkoutSessionId (can't verify)
    if (!order.checkoutSessionId) {
      skipped++;
      continue;
    }

    try {
      // Check Stripe checkout session to see if it's a subscription upgrade
      const session = await stripe.checkout.sessions.retrieve(order.checkoutSessionId);
      
      // Check if this is a subscription upgrade/downgrade checkout
      if (session.metadata?.action === 'upgrade_plan' && session.metadata?.subscriptionId) {
        const subscriptionId = session.metadata.subscriptionId;
        const currentPlanType = session.metadata.currentPlanType;
        const newPlanType = session.metadata.newPlanType;
        const buyerId = session.metadata.buyerId || order.buyerId;

        // Determine if it's an upgrade or downgrade
        const planPrices = {
          cca_monthly_37: 3700,
          cca_no_fees_60: 6000,
          cca_membership_87: 8700,
        };
        const currentPrice = planPrices[currentPlanType] || 0;
        const newPrice = planPrices[newPlanType] || 0;
        const isUpgrade = newPrice > currentPrice;

        const orderTitle = isUpgrade
          ? `Subscription Upgrade: ${planNames[currentPlanType] || currentPlanType} → ${planNames[newPlanType] || newPlanType}`
          : `Subscription Downgrade: ${planNames[currentPlanType] || currentPlanType} → ${planNames[newPlanType] || newPlanType}`;

        const updates = {
          orderType: 'subscription_change',
          subscriptionId: subscriptionId,
          currentPlanType: currentPlanType,
          newPlanType: newPlanType,
          listingTitle: orderTitle,
          status: 'completed', // Subscription changes are immediately completed
          sellerId: null, // Ensure no seller
          sellerAccountId: null, // Ensure no seller account
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        };

        if (buyerId && !order.buyerId) {
          updates.buyerId = buyerId;
        }

        if (!dryRun) {
          await db.collection('orders').doc(order.id).update(updates);
        }

        console.log(`${dryRun ? '[DRY RUN] ' : ''}✓ Migrated order ${order.id}: ${orderTitle}`);
        migrated++;
      } else {
        // Not a subscription change, skip
        skipped++;
      }
    } catch (err) {
      if (err.type === 'StripeInvalidRequestError' && err.code === 'resource_missing') {
        // Checkout session doesn't exist in Stripe (might be deleted or from different account)
        // Check if listingTitle suggests it's a subscription change
        if (order.listingTitle && (
          order.listingTitle.includes('Subscription') ||
          order.listingTitle === 'Listing -' ||
          order.listingTitle.startsWith('Listing ')
        )) {
          // Try to infer from order data - if it has no listingId and matches subscription amounts
          const subscriptionAmounts = [3700, 6000, 8700]; // Monthly, No-Fees, All-Access
          const isSubscriptionAmount = subscriptionAmounts.some(amt => 
            Math.abs((order.amount || 0) - amt) < 100 // Within $1 tolerance for proration
          );

          if (isSubscriptionAmount || !order.listingId) {
            // Likely a subscription change, but we can't determine plan types
            const updates = {
              orderType: 'subscription_change',
              listingTitle: order.listingTitle.includes('Subscription') 
                ? order.listingTitle 
                : 'Subscription Change',
              status: 'completed',
              sellerId: null,
              sellerAccountId: null,
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            };

            if (!dryRun) {
              await db.collection('orders').doc(order.id).update(updates);
            }

            console.log(`${dryRun ? '[DRY RUN] ' : ''}✓ Migrated order ${order.id} (inferred): ${updates.listingTitle}`);
            migrated++;
          } else {
            skipped++;
          }
        } else {
          skipped++;
        }
      } else {
        console.error(`✗ Error processing order ${order.id}:`, err.message);
        errors++;
      }
    }
  }

  console.log(`\n${dryRun ? 'DRY RUN: ' : ''}Migration complete:`);
  console.log(`  Migrated: ${migrated}`);
  console.log(`  Skipped: ${skipped}`);
  console.log(`  Errors: ${errors}`);
  
  if (dryRun) {
    console.log(`\nRun without --dry-run to apply changes.`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

