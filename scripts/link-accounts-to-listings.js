#!/usr/bin/env node
/*
  Link existing Stripe Connect accounts to marketplace listings
  
  This script:
  1. Gets all Stripe Connect accounts
  2. Gets all marketplace listings
  3. Matches accounts to listings by creatorId/email patterns
  4. Updates listings with connectAccountId

  Requirements (env):
  - FIREBASE_ADMIN_PROJECT_ID
  - FIREBASE_ADMIN_CLIENT_EMAIL
  - FIREBASE_ADMIN_PRIVATE_KEY
  - STRIPE_SECRET_KEY (test mode)

  Usage:
    node scripts/link-accounts-to-listings.js
*/

// Load env from .env.local first, then fallback to .env
try {
  require('dotenv').config({ path: '.env.local' });
} catch {}
require('dotenv').config();
const admin = require('firebase-admin');
const Stripe = require('stripe');

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

function initStripe() {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('Missing STRIPE_SECRET_KEY');
  }
  return new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2023-10-16'
  });
}

async function main() {
  console.log('🔗 Linking Stripe Connect accounts to marketplace listings...\n');
  
  const db = initAdmin();
  const stripe = initStripe();
  
  try {
    // Get all Stripe Connect accounts
    console.log('📋 Fetching Stripe Connect accounts...');
    const accounts = await stripe.accounts.list({ limit: 100 });
    console.log(`Found ${accounts.data.length} Stripe accounts\n`);

    // Create a map of account emails/names to account IDs
    const accountMap = new Map();
    
    for (const account of accounts.data) {
      const email = account.email || '';
      const businessName = account.business_profile?.name || '';
      const accountId = account.id;
      
      // Extract creator name from business name (e.g., "Alex Thompson Test Business" -> "Alex Thompson")
      const creatorName = businessName.replace(/\s+Test Business$/i, '').trim();
      
      if (email) {
        // Extract creatorId from email pattern: test-seller-{creatorId}@example.com
        const emailMatch = email.match(/test-seller-([^@]+)@example\.com/);
        if (emailMatch) {
          const creatorIdFromEmail = emailMatch[1].replace(/-/g, '');
          accountMap.set(creatorIdFromEmail, accountId);
          console.log(`  Mapped: ${creatorIdFromEmail} -> ${accountId} (${creatorName || email})`);
        }
      }
      
      // Also map by creator name if we have it
      if (creatorName) {
        accountMap.set(creatorName.toLowerCase(), accountId);
      }
    }

    // Get all listings
    console.log('\n📋 Fetching marketplace listings...');
    const listingsSnapshot = await db.collection('listings').get();
    console.log(`Found ${listingsSnapshot.size} listings\n`);

    let updated = 0;
    let skipped = 0;
    let failed = 0;

    // Group listings by creatorId
    const listingsByCreator = new Map();
    
    listingsSnapshot.docs.forEach(doc => {
      const data = doc.data();
      const creatorId = data.creatorId;
      const creatorName = data.creatorName || '';
      
      if (!listingsByCreator.has(creatorId)) {
        listingsByCreator.set(creatorId, []);
      }
      listingsByCreator.get(creatorId).push({
        id: doc.id,
        title: data.title || 'Untitled',
        creatorId,
        creatorName,
        currentConnectAccountId: data.connectAccountId || null
      });
    });

    // Update listings
    console.log('🔗 Linking accounts to listings...\n');
    
    for (const [creatorId, listings] of listingsByCreator.entries()) {
      // Try to find matching account
      let connectAccountId = accountMap.get(creatorId);
      
      // If not found by creatorId, try by creator name
      if (!connectAccountId && listings.length > 0) {
        const creatorName = listings[0].creatorName;
        if (creatorName) {
          connectAccountId = accountMap.get(creatorName.toLowerCase());
        }
      }

      if (!connectAccountId) {
        console.log(`⚠ No account found for creatorId: ${creatorId} (${listings[0]?.creatorName || 'Unknown'})`);
        skipped += listings.length;
        continue;
      }

      console.log(`✓ Found account for ${listings[0]?.creatorName || creatorId}: ${connectAccountId}`);

      // Update all listings for this creator
      for (const listing of listings) {
        try {
          if (listing.currentConnectAccountId === connectAccountId) {
            console.log(`  ⏭ Skipping ${listing.title} (already linked)`);
            skipped++;
            continue;
          }

          await db.collection('listings').doc(listing.id).update({
            connectAccountId: connectAccountId
          });
          console.log(`  ✓ Updated: ${listing.title}`);
          updated++;
        } catch (error) {
          console.error(`  ✗ Failed to update ${listing.title}:`, error.message);
          failed++;
        }
      }
    }

    console.log(`\n✅ Linking complete!`);
    console.log(`\nSummary:`);
    console.log(`  Listings Updated: ${updated}`);
    console.log(`  Already Linked: ${skipped}`);
    console.log(`  Failed: ${failed}`);
    
  } catch (err) {
    console.error('\n❌ Error:', err);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

