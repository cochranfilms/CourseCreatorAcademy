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
  // 2. Don't already have orderType set to 'subscription_change'
  const ordersSnapshot = await db.collection('orders')
    .where('sellerId', '==', null)
    .get();

  console.log(`Found ${ordersSnapshot.size} orders without sellerId`);
  
  // Build a map of subscription IDs to user IDs for faster lookup
  const subscriptionMap = new Map();
  try {
    const usersSnapshot = await db.collection('users')
      .where('membershipSubscriptionId', '!=', null)
      .get();
    usersSnapshot.forEach(doc => {
      const data = doc.data();
      if (data.membershipSubscriptionId) {
        subscriptionMap.set(data.membershipSubscriptionId, doc.id);
      }
    });
    console.log(`Found ${subscriptionMap.size} users with subscriptions\n`);
  } catch (err) {
    console.warn('Could not build subscription map:', err.message);
  }

  let migrated = 0;
  let skipped = 0;
  let skippedReasons = {
    alreadyMigrated: 0,
    noCheckoutSession: 0,
    notSubscriptionChange: 0,
    sessionNotFound: 0,
    other: 0,
  };
  let errors = 0;

  for (const doc of ordersSnapshot.docs) {
    const order = { id: doc.id, ...doc.data() };
    
    // Skip if already migrated
    if (order.orderType === 'subscription_change') {
      skipped++;
      skippedReasons.alreadyMigrated++;
      if (dryRun) {
        console.log(`  [SKIP] Order ${order.id}: Already migrated (orderType: subscription_change)`);
      }
      continue;
    }

    try {
      let subscriptionId = null;
      let currentPlanType = null;
      let newPlanType = null;
      let buyerId = order.buyerId;
      let isUpgrade = null;
      let orderTitle = null;

      // First, try to get info from checkout session (for upgrades)
      if (order.checkoutSessionId) {
        try {
          const session = await stripe.checkout.sessions.retrieve(order.checkoutSessionId);
          
          // Check if this is a subscription upgrade checkout
          if (session.metadata?.action === 'upgrade_plan' && session.metadata?.subscriptionId) {
            subscriptionId = session.metadata.subscriptionId;
            currentPlanType = session.metadata.currentPlanType;
            newPlanType = session.metadata.newPlanType;
            buyerId = session.metadata.buyerId || order.buyerId;

            const planPrices = {
              cca_monthly_37: 3700,
              cca_no_fees_60: 6000,
              cca_membership_87: 8700,
            };
            const currentPrice = planPrices[currentPlanType] || 0;
            const newPrice = planPrices[newPlanType] || 0;
            isUpgrade = newPrice > currentPrice;

            orderTitle = isUpgrade
              ? `Subscription Upgrade: ${planNames[currentPlanType] || currentPlanType} → ${planNames[newPlanType] || newPlanType}`
              : `Subscription Downgrade: ${planNames[currentPlanType] || currentPlanType} → ${planNames[newPlanType] || newPlanType}`;
          }
        } catch (sessionErr) {
          // Session might not exist, continue to other checks
        }
      }

      // If no checkout session info, try to detect downgrades from invoices or subscription updates
      if (!subscriptionId && order.paymentIntentId) {
        try {
          // Check payment intent for subscription info
          const paymentIntent = await stripe.paymentIntents.retrieve(order.paymentIntentId);
          if (paymentIntent.metadata?.subscriptionId) {
            subscriptionId = paymentIntent.metadata.subscriptionId;
          }
        } catch (piErr) {
          // Payment intent might not exist
        }
      }

      // If we have a subscription ID, check for recent plan changes
      if (!subscriptionId && buyerId) {
        // Try to find subscription from user's membershipSubscriptionId
        const userDoc = await db.collection('users').doc(buyerId).get();
        if (userDoc.exists) {
          const userData = userDoc.data();
          if (userData.membershipSubscriptionId) {
            subscriptionId = userData.membershipSubscriptionId;
            newPlanType = userData.membershipPlan;
          }
        }
      }

      // Check subscription for plan change history
      if (subscriptionId && !currentPlanType) {
        try {
          const subscription = await stripe.subscriptions.retrieve(subscriptionId);
          newPlanType = subscription.metadata?.planType || newPlanType;
          
          // Check recent invoices for proration (downgrades create credit invoices)
          const invoices = await stripe.invoices.list({
            subscription: subscriptionId,
            limit: 10,
          });

          for (const invoice of invoices.data) {
            // Look for credit invoices (negative amounts) with proration
            if (invoice.total < 0 || invoice.amount_due < 0) {
              // This is a credit invoice, likely from a downgrade
              const hasProration = invoice.lines?.data.some(line => line.proration);
              if (hasProration) {
                // Calculate plan types from proration line items
                let oldPlanPrice = 0;
                let newPlanPrice = 0;
                
                if (invoice.lines?.data) {
                  for (const line of invoice.lines.data) {
                    if (line.proration) {
                      if (line.amount < 0) {
                        // Negative = credit for old plan
                        oldPlanPrice = Math.abs(line.amount);
                      } else if (line.amount > 0) {
                        // Positive = charge for new plan
                        newPlanPrice = line.amount;
                      }
                    }
                  }
                }

                // Match to plan prices
                const planPrices = {
                  cca_monthly_37: 3700,
                  cca_no_fees_60: 6000,
                  cca_membership_87: 8700,
                };
                
                // Find closest matching plans
                for (const [planType, price] of Object.entries(planPrices)) {
                  if (Math.abs(oldPlanPrice - price) < 500) {
                    currentPlanType = planType;
                  }
                  if (Math.abs(newPlanPrice - price) < 500) {
                    newPlanType = planType;
                  }
                }

                if (currentPlanType && newPlanType && !orderTitle) {
                  isUpgrade = planPrices[newPlanType] > planPrices[currentPlanType];
                  orderTitle = isUpgrade
                    ? `Subscription Upgrade: ${planNames[currentPlanType]} → ${planNames[newPlanType]}`
                    : `Subscription Downgrade: ${planNames[currentPlanType]} → ${planNames[newPlanType]}`;
                  
                  // Update buyerId if we found it from subscription
                  if (!buyerId && subscription.metadata?.buyerId) {
                    buyerId = subscription.metadata.buyerId;
                  }
                  break;
                }
              }
            }
          }
        } catch (subErr) {
          // Subscription might not exist
        }
      }

      // If we still don't have info, try to infer from order data
      if (!orderTitle && !order.checkoutSessionId) {
        // Check if order matches subscription patterns
        const subscriptionAmounts = [3700, 6000, 8700]; // Monthly, No-Fees, All-Access
        const orderAmount = Math.abs(order.amount || 0);
        const isSubscriptionAmount = subscriptionAmounts.some(amt => 
          Math.abs(orderAmount - amt) < 500 // Within $5 tolerance for proration
        );

        // Also check if listingTitle suggests subscription
        const hasSubscriptionTitle = order.listingTitle && (
          order.listingTitle.includes('Subscription') ||
          order.listingTitle === 'Listing -' ||
          order.listingTitle.startsWith('Listing ')
        );

        if ((isSubscriptionAmount || hasSubscriptionTitle) && !order.listingId) {
          // Likely a subscription change but we can't determine plan types
          orderTitle = order.listingTitle && order.listingTitle.includes('Subscription')
            ? order.listingTitle
            : (order.amount && order.amount < 0 ? 'Subscription Downgrade (Credit)' : 'Subscription Change');
          
          // Try to get buyerId from order
          if (!buyerId && order.customerEmail) {
            const userQuery = await db.collection('users')
              .where('email', '==', order.customerEmail)
              .limit(1)
              .get();
            if (!userQuery.empty) {
              buyerId = userQuery.docs[0].id;
            }
          }
        }
      }

      // If we found subscription change info, migrate it
      if (orderTitle && (subscriptionId || orderTitle.includes('Subscription'))) {
        const updates = {
          orderType: 'subscription_change',
          listingTitle: orderTitle,
          status: 'completed', // Subscription changes are immediately completed
          sellerId: null, // Ensure no seller
          sellerAccountId: null, // Ensure no seller account
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        };

        if (subscriptionId) {
          updates.subscriptionId = subscriptionId;
        }
        if (currentPlanType) {
          updates.currentPlanType = currentPlanType;
        }
        if (newPlanType) {
          updates.newPlanType = newPlanType;
        }
        if (buyerId && !order.buyerId) {
          updates.buyerId = buyerId;
        }

        if (!dryRun) {
          await db.collection('orders').doc(order.id).update(updates);
        }

        const changeType = isUpgrade === true ? 'Upgrade' : isUpgrade === false ? 'Downgrade' : 'Change';
        console.log(`${dryRun ? '[DRY RUN] ' : ''}✓ Migrated order ${order.id}: ${orderTitle}${order.amount && order.amount < 0 ? ' (Credit)' : ''}`);
        migrated++;
      } else {
        // Not a subscription change, skip
        skipped++;
        skippedReasons.notSubscriptionChange++;
        if (dryRun) {
          const reason = !order.checkoutSessionId ? 'No checkoutSessionId and no subscription indicators' 
            : 'Not a subscription change';
          console.log(`  [SKIP] Order ${order.id}: ${reason}`);
        }
      }
    } catch (err) {
      console.error(`✗ Error processing order ${order.id}:`, err.message);
      errors++;
      skippedReasons.other++;
    }
  }

  console.log(`\n${dryRun ? 'DRY RUN: ' : ''}Migration complete:`);
  console.log(`  Migrated: ${migrated}`);
  console.log(`  Skipped: ${skipped}`);
  if (dryRun && skipped > 0) {
    console.log(`    - Already migrated: ${skippedReasons.alreadyMigrated}`);
    console.log(`    - No checkoutSessionId: ${skippedReasons.noCheckoutSession}`);
    console.log(`    - Not subscription change: ${skippedReasons.notSubscriptionChange}`);
    console.log(`    - Session not found: ${skippedReasons.sessionNotFound}`);
    console.log(`    - Other errors: ${skippedReasons.other}`);
  }
  console.log(`  Errors: ${errors}`);
  
  if (dryRun) {
    console.log(`\nRun without --dry-run to apply changes.`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

