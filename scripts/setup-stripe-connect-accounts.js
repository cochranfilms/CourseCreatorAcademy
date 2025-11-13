#!/usr/bin/env node
/*
  Setup Stripe Connect accounts for test marketplace sellers

  This script:
  1. Gets all marketplace listings from Firestore
  2. Creates Stripe Connect Express accounts for each unique seller
  3. Updates accounts with test data to enable payments
  4. Updates listings with connectAccountId

  Requirements (env):
  - FIREBASE_ADMIN_PROJECT_ID
  - FIREBASE_ADMIN_CLIENT_EMAIL
  - FIREBASE_ADMIN_PRIVATE_KEY
  - STRIPE_SECRET_KEY (test mode)

  Usage:
    node scripts/setup-stripe-connect-accounts.js
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

// Create and onboard a Stripe Connect Express account with test data
async function createConnectAccount(stripe, creatorName, email) {
  try {
    const testEmail = email || `test-${Date.now()}@example.com`;
    const firstName = creatorName.split(' ')[0] || 'Test';
    const lastName = creatorName.split(' ').slice(1).join(' ') || 'Seller';
    
    // Create Express account with minimal required fields
    const account = await stripe.accounts.create({
      type: 'express',
      country: 'US',
      email: testEmail,
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true }
      },
    });

    // Update account with test data
    // Add all required fields for test mode
    const updateData = {
      business_type: 'individual',
      business_profile: {
        name: `${creatorName} Test Business`,
        product_description: 'Test seller account for Creator Collective marketplace',
        support_email: testEmail,
        url: 'https://www.example.com',
        mcc: '5734', // Music stores - general test MCC
      },
      individual: {
        first_name: firstName,
        last_name: lastName,
        email: testEmail,
        phone: '+15551234567',
        ssn_last_4: '0000', // Test SSN last 4
        dob: {
          day: 1,
          month: 1,
          year: 1990,
        },
        address: {
          line1: '123 Test Street',
          city: 'San Francisco',
          state: 'CA',
          postal_code: '94102',
          country: 'US',
        },
      },
      settings: {
        payments: {
          statement_descriptor: 'CREATOR COLLECTIVE',
        },
      },
    };

    await stripe.accounts.update(account.id, updateData);
    
    // Add test bank account (required for payouts in test mode)
    try {
      await stripe.accounts.createExternalAccount(account.id, {
        external_account: {
          object: 'bank_account',
          country: 'US',
          currency: 'usd',
          account_number: '000123456789', // Test account number
          routing_number: '110000000', // Test routing number (ACH)
        },
      });
    } catch (e) {
      // Bank account might already exist or error, that's okay
      console.log(`  Note: Bank account creation skipped: ${e.message}`);
    }
    
    // Note: ToS acceptance cannot be done programmatically for Express accounts
    // In test mode, accounts may still work for payments even when restricted

    return account.id;
  } catch (error) {
    console.error(`  Error details:`, error);
    throw error;
  }
}

async function main() {
  console.log('🚀 Setting up Stripe Connect accounts for test sellers...\n');
  
  const db = initAdmin();
  const stripe = initStripe();
  
  try {
    // Get all listings
    const listingsSnapshot = await db.collection('listings').get();
    
    if (listingsSnapshot.empty) {
      console.log('⚠ No listings found. Run seed-test-data.js first.');
      return;
    }

    // Group listings by creatorId
    const sellersMap = new Map();
    
    listingsSnapshot.docs.forEach(doc => {
      const data = doc.data();
      const creatorId = data.creatorId;
      const creatorName = data.creatorName || 'Test Seller';
      
      if (!sellersMap.has(creatorId)) {
        sellersMap.set(creatorId, {
          creatorId,
          creatorName,
          listings: []
        });
      }
      sellersMap.get(creatorId).listings.push({
        id: doc.id,
        ...data
      });
    });

    console.log(`Found ${sellersMap.size} unique sellers\n`);

    // Create Stripe Connect accounts for each seller
    const accountMap = new Map(); // creatorId -> connectAccountId
    
    for (const [creatorId, seller] of sellersMap.entries()) {
      try {
        console.log(`📦 Creating Stripe account for ${seller.creatorName} (${creatorId})...`);
        
        const email = `test-seller-${creatorId.replace(/[^a-zA-Z0-9]/g, '-')}@example.com`;
        const connectAccountId = await createConnectAccount(stripe, seller.creatorName, email);
        
        accountMap.set(creatorId, connectAccountId);
        console.log(`  ✓ Created Stripe account: ${connectAccountId}`);
        
        // Small delay to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        console.error(`  ✗ Failed to create account for ${seller.creatorName}:`, error.message);
      }
    }

    console.log(`\n📝 Updating listings with connectAccountId...\n`);

    // Update all listings with their seller's connectAccountId
    let updated = 0;
    let failed = 0;

    for (const [creatorId, seller] of sellersMap.entries()) {
      const connectAccountId = accountMap.get(creatorId);
      
      if (!connectAccountId) {
        console.log(`⚠ Skipping listings for ${seller.creatorName} (no Stripe account)`);
        failed += seller.listings.length;
        continue;
      }

      for (const listing of seller.listings) {
        try {
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

    console.log(`\n✅ Setup complete!`);
    console.log(`\nSummary:`);
    console.log(`  Stripe Connect Accounts Created: ${accountMap.size}`);
    console.log(`  Listings Updated: ${updated}`);
    if (failed > 0) {
      console.log(`  Failed Updates: ${failed}`);
    }
    
    console.log(`\n💡 Note: These are test Stripe Connect accounts in sandbox mode.`);
    console.log(`   They can accept test payments but won't work with real money.`);
    
  } catch (err) {
    console.error('\n❌ Error during setup:', err);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

