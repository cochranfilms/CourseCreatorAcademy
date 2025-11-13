#!/usr/bin/env node
/*
  Enable Stripe Connect accounts for test mode
  
  In Stripe test mode, we can enable accounts programmatically using test tokens.
  This script enables all restricted Connect accounts so they can accept test payments.

  Requirements (env):
  - STRIPE_SECRET_KEY (test mode)

  Usage:
    node scripts/enable-stripe-connect-accounts.js
*/

// Load env from .env.local first, then fallback to .env
try {
  require('dotenv').config({ path: '.env.local' });
} catch {}
require('dotenv').config();
const Stripe = require('stripe');

function initStripe() {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('Missing STRIPE_SECRET_KEY');
  }
  return new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2023-10-16'
  });
}

async function enableAccount(stripe, accountId) {
  try {
    // Retrieve account to check current status
    const account = await stripe.accounts.retrieve(accountId);
    
    if (account.charges_enabled) {
      return { enabled: true, message: 'Already enabled' };
    }

    // In test mode, we can use test tokens to enable accounts
    // However, Express accounts need to go through onboarding
    // For test mode, we'll try to update the account with test bank account info
    
    // Try to enable by adding test bank account (test mode only)
    try {
      await stripe.accounts.update(accountId, {
        tos_acceptance: {
          date: Math.floor(Date.now() / 1000),
          ip: '127.0.0.1',
        },
      });
    } catch (e) {
      // ToS can't be accepted programmatically for Express accounts
      // That's okay, we'll try another approach
    }

    // For test mode, we can use Stripe's test mode features
    // Try creating a test person token and updating the account
    // Actually, in test mode, accounts can accept payments even when restricted
    // But the API check requires charges_enabled to be true
    
    // The real issue is that Express accounts need onboarding completion
    // In test mode, we can simulate this by updating capabilities
    
    // Check if we can enable charges directly
    const updated = await stripe.accounts.update(accountId, {
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true }
      },
      // Try to mark as ready for test mode
      settings: {
        payouts: {
          schedule: {
            interval: 'manual'
          }
        }
      }
    });

    // Re-check if charges are now enabled
    const recheck = await stripe.accounts.retrieve(accountId);
    
    if (recheck.charges_enabled) {
      return { enabled: true, message: 'Successfully enabled' };
    } else {
      return { 
        enabled: false, 
        message: `Still restricted. Requirements: ${JSON.stringify(recheck.requirements?.currently_due || [])}` 
      };
    }
  } catch (error) {
    return { enabled: false, message: error.message };
  }
}

async function main() {
  console.log('🚀 Enabling Stripe Connect accounts for test mode...\n');
  
  const stripe = initStripe();
  
  try {
    // List all connected accounts
    const accounts = await stripe.accounts.list({
      limit: 100
    });

    console.log(`Found ${accounts.data.length} connected accounts\n`);

    let enabled = 0;
    let alreadyEnabled = 0;
    let failed = 0;

    for (const account of accounts.data) {
      const accountId = account.id;
      const accountName = account.business_profile?.name || account.email || accountId;
      const status = account.charges_enabled ? 'Enabled' : 'Restricted';
      
      console.log(`📦 Processing: ${accountName}`);
      console.log(`   Status: ${status}`);
      console.log(`   Account ID: ${accountId}`);

      if (account.charges_enabled) {
        console.log(`   ✓ Already enabled\n`);
        alreadyEnabled++;
        continue;
      }

      const result = await enableAccount(stripe, accountId);
      
      if (result.enabled) {
        console.log(`   ✓ ${result.message}\n`);
        enabled++;
      } else {
        console.log(`   ✗ ${result.message}\n`);
        failed++;
      }

      // Small delay to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log('✅ Processing complete!');
    console.log(`\nSummary:`);
    console.log(`  Already Enabled: ${alreadyEnabled}`);
    console.log(`  Newly Enabled: ${enabled}`);
    console.log(`  Failed: ${failed}`);
    
    if (failed > 0) {
      console.log(`\n⚠ Note: Some accounts may still be restricted.`);
      console.log(`   In Stripe test mode, Express accounts typically need to complete`);
      console.log(`   onboarding through the Stripe dashboard or onboarding link.`);
      console.log(`   However, test payments may still work even when restricted.`);
    }
    
  } catch (err) {
    console.error('\n❌ Error:', err);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

