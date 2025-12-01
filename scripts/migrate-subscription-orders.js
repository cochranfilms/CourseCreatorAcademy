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
  
  // Also check for orders with negative amounts (credits) that might be downgrades
  // Note: Firestore doesn't support range queries on null, so we'll filter in memory
  let ordersWithCredits = 0;
  ordersSnapshot.docs.forEach(doc => {
    const order = doc.data();
    if (order.amount && order.amount < 0 && order.orderType !== 'subscription_change') {
      ordersWithCredits++;
    }
  });
  if (ordersWithCredits > 0) {
    console.log(`Found ${ordersWithCredits} orders with negative amounts (potential credits)`);
  }
  
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

      // Check for negative amounts (credits) - these are likely downgrades
      if (!orderTitle && order.amount && order.amount < 0) {
        // Negative amount = credit = likely a downgrade
        if (!buyerId && order.customerEmail) {
          const userQuery = await db.collection('users')
            .where('email', '==', order.customerEmail)
            .limit(1)
            .get();
          if (!userQuery.empty) {
            buyerId = userQuery.docs[0].id;
            const userData = userQuery.docs[0].data();
            if (userData.membershipSubscriptionId) {
              subscriptionId = userData.membershipSubscriptionId;
            }
          }
        }

        // Try to find matching credit invoice
        if (subscriptionId && !orderTitle) {
          try {
            const subscription = await stripe.subscriptions.retrieve(subscriptionId);
            const invoices = await stripe.invoices.list({
              subscription: subscriptionId,
              limit: 20,
            });

            const orderTime = order.createdAt?.toMillis?.() || order.createdAt?.seconds * 1000 || Date.now();
            const orderAmount = Math.abs(order.amount);

            for (const invoice of invoices.data) {
              if ((invoice.total < 0 || invoice.amount_due < 0)) {
                const invoiceTime = invoice.created * 1000;
                const timeDiff = Math.abs(invoiceTime - orderTime);
                const daysDiff = timeDiff / (1000 * 60 * 60 * 24);
                const invoiceCreditAmount = Math.abs(invoice.total || invoice.amount_due || 0);

                if (daysDiff < 7 && Math.abs(invoiceCreditAmount - orderAmount) < 1000) {
                  const hasProration = invoice.lines?.data.some(line => line.proration);
                  if (hasProration) {
                    let oldPlanPrice = 0;
                    let newPlanPrice = 0;
                    
                    if (invoice.lines?.data) {
                      for (const line of invoice.lines.data) {
                        if (line.proration) {
                          if (line.amount < 0) {
                            oldPlanPrice = Math.abs(line.amount);
                          } else if (line.amount > 0) {
                            newPlanPrice = line.amount;
                          }
                        }
                      }
                    }

                    const planPrices = {
                      cca_monthly_37: 3700,
                      cca_no_fees_60: 6000,
                      cca_membership_87: 8700,
                    };
                    
                    for (const [planType, price] of Object.entries(planPrices)) {
                      if (Math.abs(oldPlanPrice - price) < 1000) {
                        currentPlanType = planType;
                      }
                      if (Math.abs(newPlanPrice - price) < 1000) {
                        newPlanType = planType;
                      }
                    }

                    if (currentPlanType && newPlanType) {
                      isUpgrade = false; // Negative amount = downgrade
                      orderTitle = `Subscription Downgrade: ${planNames[currentPlanType]} → ${planNames[newPlanType]}`;
                      break;
                    }
                  }
                }
              }
            }
          } catch (err) {
            // Continue
          }
        }

        // If we still don't have plan types but have negative amount, mark as downgrade
        if (!orderTitle && order.amount < 0) {
          orderTitle = 'Subscription Downgrade (Credit)';
        }
      }

      // If we still don't have info, try to infer from order data or check all users' subscriptions
      if (!orderTitle && !order.checkoutSessionId) {
        // First, try to get buyerId from order
        if (!buyerId && order.customerEmail) {
          const userQuery = await db.collection('users')
            .where('email', '==', order.customerEmail)
            .limit(1)
            .get();
          if (!userQuery.empty) {
            buyerId = userQuery.docs[0].id;
            const userData = userQuery.docs[0].data();
            if (userData.membershipSubscriptionId) {
              subscriptionId = userData.membershipSubscriptionId;
            }
          }
        }

        // If we have buyerId but no subscriptionId, try to find it
        if (buyerId && !subscriptionId) {
          const userDoc = await db.collection('users').doc(buyerId).get();
          if (userDoc.exists) {
            const userData = userDoc.data();
            if (userData.membershipSubscriptionId) {
              subscriptionId = userData.membershipSubscriptionId;
            }
          }
        }

        // If we have subscriptionId, check invoices for credit invoices matching this order
        if (subscriptionId && !orderTitle) {
          try {
            const subscription = await stripe.subscriptions.retrieve(subscriptionId);
            const invoices = await stripe.invoices.list({
              subscription: subscriptionId,
              limit: 20,
            });

            // Get order creation time (approximate)
            const orderTime = order.createdAt?.toMillis?.() || order.createdAt?.seconds * 1000 || Date.now();
            const orderDate = new Date(orderTime);
            const orderAmount = Math.abs(order.amount || 0);

            for (const invoice of invoices.data) {
              // Check if invoice is a credit invoice (negative) and matches order timing/amount
              const invoiceTime = invoice.created * 1000;
              const timeDiff = Math.abs(invoiceTime - orderTime);
              const daysDiff = timeDiff / (1000 * 60 * 60 * 24);

              // Match if within 7 days and amount is close
              if ((invoice.total < 0 || invoice.amount_due < 0) && daysDiff < 7) {
                const invoiceCreditAmount = Math.abs(invoice.total || invoice.amount_due || 0);
                
                // Check if amounts match (within $10 tolerance for proration differences)
                if (Math.abs(invoiceCreditAmount - orderAmount) < 1000) {
                  // This invoice likely matches this order
                  const hasProration = invoice.lines?.data.some(line => line.proration);
                  if (hasProration) {
                    // Calculate plan types from proration line items
                    let oldPlanPrice = 0;
                    let newPlanPrice = 0;
                    
                    if (invoice.lines?.data) {
                      for (const line of invoice.lines.data) {
                        if (line.proration) {
                          if (line.amount < 0) {
                            oldPlanPrice = Math.abs(line.amount);
                          } else if (line.amount > 0) {
                            newPlanPrice = line.amount;
                          }
                        }
                      }
                    }

                    const planPrices = {
                      cca_monthly_37: 3700,
                      cca_no_fees_60: 6000,
                      cca_membership_87: 8700,
                    };
                    
                    // Find closest matching plans
                    for (const [planType, price] of Object.entries(planPrices)) {
                      if (Math.abs(oldPlanPrice - price) < 1000) {
                        currentPlanType = planType;
                      }
                      if (Math.abs(newPlanPrice - price) < 1000) {
                        newPlanType = planType;
                      }
                    }

                    // Also check subscription metadata
                    if (!currentPlanType || !newPlanType) {
                      // Try to get from subscription history
                      const subscriptionHistory = await stripe.subscriptionItems.list({
                        subscription: subscriptionId,
                        limit: 10,
                      });
                      
                      // Check if we can infer from subscription items
                      if (subscriptionHistory.data.length > 0) {
                        const currentItem = subscriptionHistory.data[0];
                        if (currentItem.price?.metadata?.planType) {
                          newPlanType = currentItem.price.metadata.planType;
                        }
                      }
                    }

                    if (currentPlanType && newPlanType) {
                      isUpgrade = planPrices[newPlanType] > planPrices[currentPlanType];
                      orderTitle = isUpgrade
                        ? `Subscription Upgrade: ${planNames[currentPlanType]} → ${planNames[newPlanType]}`
                        : `Subscription Downgrade: ${planNames[currentPlanType]} → ${planNames[newPlanType]}`;
                      break;
                    } else if (newPlanType) {
                      // We have new plan but not old plan - still mark as subscription change
                      orderTitle = `Subscription Change to ${planNames[newPlanType]}`;
                      break;
                    }
                  }
                }
              }
            }
          } catch (subErr) {
            // Subscription might not exist
          }
        }

        // If still no title, check if order matches subscription patterns
        if (!orderTitle) {
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
          let reason = 'Not a subscription change';
          if (!order.checkoutSessionId) {
            reason = `No checkoutSessionId`;
            if (order.listingTitle) {
              reason += `, listingTitle: "${order.listingTitle}"`;
            }
            if (order.amount !== undefined) {
              reason += `, amount: ${order.amount}`;
            }
            if (order.listingId) {
              reason += `, has listingId: ${order.listingId}`;
            }
          } else {
            reason += ` (checkoutSessionId exists but no subscription metadata)`;
          }
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

