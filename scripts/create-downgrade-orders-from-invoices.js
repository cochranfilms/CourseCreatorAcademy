#!/usr/bin/env node
/*
  Create subscription_change orders for historical downgrades from Stripe credit invoices
  
  This script:
  1. Finds all Stripe subscriptions
  2. Checks invoices for credit invoices (negative amounts) with proration
  3. Creates orders for downgrades that don't already have orders
  
  Requirements (env):
  - STRIPE_SECRET_KEY
  - FIREBASE_ADMIN_PROJECT_ID
  - FIREBASE_ADMIN_CLIENT_EMAIL
  - FIREBASE_ADMIN_PRIVATE_KEY (with \n newlines or real newlines)

  Usage:
    node scripts/create-downgrade-orders-from-invoices.js [--dry-run] [--force-update]
    
  Options:
    --dry-run        Show what would be created/updated without making changes
    --force-update   Update existing orders that are missing critical fields (buyerId, plan types)
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

const planPrices = {
  cca_monthly_37: 3700,
  cca_no_fees_60: 6000,
  cca_membership_87: 8700,
};

async function main() {
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) throw new Error('Missing STRIPE_SECRET_KEY');
  const stripe = new Stripe(stripeKey, { apiVersion: '2023-10-16' });
  const db = initAdmin();
  const dryRun = getArg('--dry-run');
  const forceUpdate = getArg('--force-update');

  console.log(`\n${dryRun ? 'DRY RUN: ' : ''}Creating orders for historical downgrades from credit invoices...`);
  if (forceUpdate) {
    console.log(`  Mode: Will update existing orders if they're missing critical fields\n`);
  } else {
    console.log(`  Mode: Will skip orders that already exist\n`);
  }

  // Get all users with subscriptions
  const usersSnapshot = await db.collection('users')
    .where('membershipSubscriptionId', '!=', null)
    .get();

  console.log(`Found ${usersSnapshot.size} users with subscriptions\n`);

  let created = 0;
  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for (const userDoc of usersSnapshot.docs) {
    const userId = userDoc.id;
    const userData = userDoc.data();
    const subscriptionId = userData.membershipSubscriptionId;

    if (!subscriptionId) continue;

    try {
      // Get subscription from Stripe
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      
      // Get all invoices for this subscription
      const invoices = await stripe.invoices.list({
        subscription: subscriptionId,
        limit: 100,
      });

      // Look for credit invoices (negative amounts) with proration or downgrade indicators
      for (const invoice of invoices.data) {
        // Credit invoices have negative totals
        if (invoice.total < 0 || invoice.amount_due < 0) {
          // Check for proration flag OR downgrade indicators in line items
          const hasProration = invoice.lines?.data.some(line => line.proration);
          
          // Also check for downgrade patterns in descriptions:
          // - "Remaining time on" (positive charge for new plan)
          // - "Unused time on" (negative credit for old plan)
          const hasDowngradePattern = invoice.lines?.data.some(line => {
            const desc = (line.description || '').toLowerCase();
            return desc.includes('remaining time on') || desc.includes('unused time on');
          });
          
          // Check if invoice has both positive and negative line items (typical downgrade pattern)
          const hasMixedAmounts = invoice.lines?.data.some(line => line.amount > 0) && 
                                  invoice.lines?.data.some(line => line.amount < 0);
          
          if (hasProration || hasDowngradePattern || hasMixedAmounts) {
            // Debug: Log what we found
            if (dryRun && !hasProration) {
              console.log(`  [DEBUG] Invoice ${invoice.id}: Found downgrade via ${hasDowngradePattern ? 'description pattern' : 'mixed amounts'}`);
            }
            
            // Check if order already exists for this SPECIFIC invoice
            const invoiceTime = invoice.created * 1000;
            const invoiceCreditAmount = Math.abs(invoice.total || invoice.amount_due || 0);
            const invoiceDate = new Date(invoiceTime);
            
            // First, try to find order by invoice ID (most accurate match)
            let matchingOrderDoc = null;
            let matchingOrder = null;
            
            // Check if any order has this invoice ID stored
            const ordersByInvoiceId = await db.collection('orders')
              .where('invoiceId', '==', invoice.id)
              .limit(1)
              .get();
            
            if (!ordersByInvoiceId.empty) {
              matchingOrderDoc = ordersByInvoiceId.docs[0];
              matchingOrder = matchingOrderDoc.data();
            } else {
              // Fallback: Check orders by subscriptionId + orderType, then match by exact amount and time
              const existingOrders = await db.collection('orders')
                .where('subscriptionId', '==', subscriptionId)
                .where('orderType', '==', 'subscription_change')
                .get();
            
              for (const orderDoc of existingOrders.docs) {
                const order = orderDoc.data();
                const orderTime = order.createdAt?.toMillis?.() || order.createdAt?.seconds * 1000 || 0;
                const timeDiff = Math.abs(orderTime - invoiceTime);
                const daysDiff = timeDiff / (1000 * 60 * 60 * 24);
                const orderAmount = Math.abs(order.amount || 0);

                // Match by exact amount (within $0.10) and same day (not 7 days)
                // This is stricter to avoid matching multiple invoices to one order
                if (daysDiff < 1 && Math.abs(orderAmount - invoiceCreditAmount) < 10) {
                  matchingOrderDoc = orderDoc;
                  matchingOrder = order;
                  break;
                }
              }
            }

            // Calculate plan types from proration line items (we need this whether creating or updating)
            let oldPlanPrice = 0;
            let newPlanPrice = 0;
            let currentPlanType = null;
            let newPlanType = null;

            if (invoice.lines?.data) {
              for (const line of invoice.lines.data) {
                // Check if this is a proration line OR a downgrade pattern line
                const isProration = line.proration === true;
                const desc = (line.description || '').toLowerCase();
                const isDowngradePattern = desc.includes('remaining time on') || desc.includes('unused time on');
                
                // Skip if neither proration nor downgrade pattern
                if (!isProration && !isDowngradePattern) continue;

                // Prefer explicit planType metadata on the Stripe Price/Plan
                const linePlanType =
                  (line.price && line.price.metadata && line.price.metadata.planType) ||
                  (line.plan && line.plan.metadata && line.plan.metadata.planType) ||
                  null;

                // For downgrade patterns:
                // - "Unused time" = negative amount = credit for old plan
                // - "Remaining time" = positive amount = charge for new plan
                if (line.amount < 0 || desc.includes('unused time')) {
                  // Negative proration = credit for old plan
                  oldPlanPrice = Math.abs(line.amount);
                  if (linePlanType && !currentPlanType) {
                    currentPlanType = linePlanType;
                  }
                } else if (line.amount > 0 || desc.includes('remaining time')) {
                  // Positive proration = charge for new plan
                  newPlanPrice = line.amount;
                  if (linePlanType && !newPlanType) {
                    newPlanType = linePlanType;
                  }
                }
              }
            }

            // If metadata didn't give us both plan types, fall back to matching by price
            for (const [planType, price] of Object.entries(planPrices)) {
              if (!currentPlanType && Math.abs(oldPlanPrice - price) < 1000) {
                currentPlanType = planType;
              }
              if (!newPlanType && Math.abs(newPlanPrice - price) < 1000) {
                newPlanType = planType;
              }
            }

            // As a final fallback, check subscription items/metadata for at least the new plan
            if (!newPlanType || !currentPlanType) {
              try {
                const subscriptionItems = await stripe.subscriptionItems.list({
                  subscription: subscriptionId,
                  limit: 10,
                });

                if (subscriptionItems.data.length > 0) {
                  const currentItem = subscriptionItems.data[0];
                  if (!newPlanType && currentItem.price?.metadata?.planType) {
                    newPlanType = currentItem.price.metadata.planType;
                  }
                }

                if (!newPlanType && subscription.metadata?.planType) {
                  newPlanType = subscription.metadata.planType;
                }
              } catch (e) {
                // Best-effort only; continue with whatever we have
              }
            }

            // Decide the order title
            let orderTitle;
            if (currentPlanType && newPlanType) {
              orderTitle = `Subscription Downgrade: ${planNames[currentPlanType]} → ${planNames[newPlanType]}`;
            } else {
              orderTitle = 'Subscription Downgrade (Credit)';
            }

            // If order exists, check if it needs updating
            if (matchingOrderDoc && matchingOrder) {
              // Check if this order is already for a different invoice
              // If so, we need to create a NEW order for this invoice (don't reuse)
              if (matchingOrder.invoiceId && matchingOrder.invoiceId !== invoice.id) {
                console.log(`  [INFO] Invoice ${invoice.id}: Found order ${matchingOrderDoc.id} for different invoice ${matchingOrder.invoiceId}, will create new order`);
                matchingOrderDoc = null;
                matchingOrder = null;
              } else if (!matchingOrder.invoiceId) {
                // Order exists but doesn't have invoiceId - check if amount/time match exactly
                // If they match exactly, assume it's for this invoice and update it
                // If they don't match exactly, create a new order
                const orderTime = matchingOrder.createdAt?.toMillis?.() || matchingOrder.createdAt?.seconds * 1000 || 0;
                const timeDiff = Math.abs(orderTime - invoiceTime);
                const orderAmount = Math.abs(matchingOrder.amount || 0);
                
                // If time/amount don't match closely, this order is for a different invoice
                if (timeDiff > 3600000 || Math.abs(orderAmount - invoiceCreditAmount) > 10) {
                  console.log(`  [INFO] Invoice ${invoice.id}: Found order ${matchingOrderDoc.id} but time/amount don't match (time diff: ${Math.round(timeDiff/1000/60)}min, amount diff: $${Math.abs(orderAmount - invoiceCreditAmount)/100}), will create new order`);
                  matchingOrderDoc = null;
                  matchingOrder = null;
                }
              }
            }
            
            // If we still have a matching order, check if it needs updating
            if (matchingOrderDoc && matchingOrder) {
              // If this order doesn't have invoiceId, add it to prevent future mismatches
              const needsUpdate = 
                !matchingOrder.invoiceId ||
                matchingOrder.invoiceId !== invoice.id ||
                !matchingOrder.buyerId || 
                matchingOrder.buyerId !== userId ||
                !matchingOrder.currentPlanType ||
                !matchingOrder.newPlanType ||
                matchingOrder.listingTitle === 'Subscription Downgrade (Credit)' ||
                (matchingOrder.listingTitle && matchingOrder.listingTitle.includes('Upgrade') && orderTitle.includes('Downgrade')) ||
                matchingOrder.listingTitle !== orderTitle;
              
              if (needsUpdate && forceUpdate) {
                // Update the existing order with missing fields
                const updates = {};
                if (!matchingOrder.invoiceId || matchingOrder.invoiceId !== invoice.id) {
                  updates.invoiceId = invoice.id;
                }
                if (!matchingOrder.buyerId || matchingOrder.buyerId !== userId) {
                  updates.buyerId = userId;
                }
                if (currentPlanType && !matchingOrder.currentPlanType) {
                  updates.currentPlanType = currentPlanType;
                }
                if (newPlanType && !matchingOrder.newPlanType) {
                  updates.newPlanType = newPlanType;
                }
                if (orderTitle && matchingOrder.listingTitle !== orderTitle) {
                  updates.listingTitle = orderTitle;
                }
                if (Object.keys(updates).length > 0) {
                  updates.updatedAt = admin.firestore.FieldValue.serverTimestamp();
                  
                  if (!dryRun) {
                    await matchingOrderDoc.ref.update(updates);
                  }
                  
                  console.log(
                    `${dryRun ? '[DRY RUN] ' : ''}✓ Updated order ${matchingOrderDoc.id} for invoice ${invoice.id}: ${orderTitle}`
                  );
                  if (dryRun || Object.keys(updates).length > 1) {
                    console.log(`    Updates: ${Object.keys(updates).filter(k => k !== 'updatedAt').join(', ')}`);
                  }
                  updated++;
                  continue;
                }
              } else if (needsUpdate) {
                // Order exists but is incomplete - show what's missing
                const missingFields = [];
                if (!matchingOrder.invoiceId || matchingOrder.invoiceId !== invoice.id) {
                  missingFields.push(`invoiceId (has: ${matchingOrder.invoiceId || 'none'}, needs: ${invoice.id})`);
                }
                if (!matchingOrder.buyerId || matchingOrder.buyerId !== userId) {
                  missingFields.push(`buyerId (has: ${matchingOrder.buyerId || 'none'}, needs: ${userId})`);
                }
                if (!matchingOrder.currentPlanType) {
                  missingFields.push(`currentPlanType (needs: ${currentPlanType || 'unknown'})`);
                }
                if (!matchingOrder.newPlanType) {
                  missingFields.push(`newPlanType (needs: ${newPlanType || 'unknown'})`);
                }
                if (matchingOrder.listingTitle !== orderTitle) {
                  missingFields.push(`listingTitle (has: "${matchingOrder.listingTitle}", needs: "${orderTitle}")`);
                }
                
                console.log(`  [SKIP] Invoice ${invoice.id}: Order ${matchingOrderDoc.id} exists but is incomplete:`);
                console.log(`    Missing fields: ${missingFields.join(', ')}`);
                console.log(`    Run with --force-update to fix this order`);
                skipped++;
                continue;
              } else {
                // Order exists and is complete
                skipped++;
                if (dryRun) {
                  console.log(`  [SKIP] Invoice ${invoice.id}: Order ${matchingOrderDoc.id} already exists and is complete`);
                }
                continue;
              }
            }

            // No matching order found - create a new one
            const order = {
              orderType: 'subscription_change',
              paymentIntentId: null,
              invoiceId: invoice.id, // Store invoice ID for exact matching
              amount: invoiceCreditAmount, // Credit amount (stored as positive)
              currency: invoice.currency || 'usd',
              buyerId: userId,
              sellerId: null,
              sellerAccountId: null,
              subscriptionId: subscriptionId,
              // Only set plan types if we were able to determine them
              ...(currentPlanType ? { currentPlanType } : {}),
              ...(newPlanType ? { newPlanType } : {}),
              listingTitle: orderTitle,
              status: 'completed',
              customerId: invoice.customer || null,
              customerEmail: userData.email || null,
              createdAt: admin.firestore.Timestamp.fromMillis(invoiceTime),
              updatedAt: admin.firestore.Timestamp.fromMillis(invoiceTime),
            };

            if (!dryRun) {
              await db.collection('orders').add(order);
            }

            console.log(
              `${dryRun ? '[DRY RUN] ' : ''}✓ Created order for invoice ${invoice.id}: ${orderTitle} (Credit: $${(
                invoiceCreditAmount / 100
              ).toFixed(2)})`
            );
            created++;
          }
        }
      }
    } catch (err) {
      console.error(`✗ Error processing user ${userId}:`, err.message);
      errors++;
    }
  }

  console.log(`\n${dryRun ? 'DRY RUN: ' : ''}Complete:`);
  console.log(`  Created: ${created}`);
  if (forceUpdate) {
    console.log(`  Updated: ${updated}`);
  }
  console.log(`  Skipped: ${skipped}`);
  console.log(`  Errors: ${errors}`);
  
  if (dryRun) {
    console.log(`\nRun without --dry-run to create/update orders.`);
    if (skipped > 0) {
      console.log(`Run with --force-update to update existing orders that are missing fields.`);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

