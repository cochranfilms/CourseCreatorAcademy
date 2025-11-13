#!/usr/bin/env node
/*
  Enable transfers capability on Stripe Connect accounts
  
  This script ensures all Connect accounts have the transfers capability
  enabled so they can receive payments via Stripe Connect transfers.

  Requirements (env):
  - STRIPE_SECRET_KEY (test mode)

  Usage:
    node scripts/enable-transfers-capability.js
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

async function enableTransfersCapability(stripe, accountId) {
  try {
    // Retrieve account to check current capabilities
    const account = await stripe.accounts.retrieve(accountId);
    const capabilities = account.capabilities || {};
    
    // Check if transfers is already active
    if (capabilities.transfers === 'active') {
      return { enabled: true, message: 'Already active' };
    }

    // Request transfers capability if not already requested
    if (!capabilities.transfers || capabilities.transfers === 'inactive') {
      await stripe.accounts.update(accountId, {
        capabilities: {
          transfers: { requested: true }
        }
      });
    }

    // In test mode, we can sometimes activate capabilities directly
    // But typically they need to be activated through onboarding
    // However, for test mode, requesting should be enough if the account
    // has the required information
    
    // Re-check status
    const updated = await stripe.accounts.retrieve(accountId);
    const updatedCapabilities = updated.capabilities || {};
    
    if (updatedCapabilities.transfers === 'active') {
      return { enabled: true, message: 'Successfully enabled' };
    } else if (updatedCapabilities.transfers === 'pending') {
      return { enabled: false, message: 'Pending activation (may need onboarding completion)' };
    } else {
      return { enabled: false, message: `Status: ${updatedCapabilities.transfers || 'not requested'}` };
    }
  } catch (error) {
    return { enabled: false, message: error.message };
  }
}

async function main() {
  console.log('🚀 Enabling transfers capability on Stripe Connect accounts...\n');
  
  const stripe = initStripe();
  
  try {
    // List all connected accounts
    const accounts = await stripe.accounts.list({
      limit: 100
    });

    console.log(`Found ${accounts.data.length} connected accounts\n`);

    let enabled = 0;
    let alreadyEnabled = 0;
    let pending = 0;
    let failed = 0;

    for (const account of accounts.data) {
      const accountId = account.id;
      const accountName = account.business_profile?.name || account.email || accountId;
      const capabilities = account.capabilities || {};
      const transfersStatus = capabilities.transfers || 'not requested';
      
      console.log(`📦 Processing: ${accountName}`);
      console.log(`   Account ID: ${accountId}`);
      console.log(`   Transfers Status: ${transfersStatus}`);

      if (capabilities.transfers === 'active') {
        console.log(`   ✓ Already active\n`);
        alreadyEnabled++;
        continue;
      }

      const result = await enableTransfersCapability(stripe, accountId);
      
      if (result.enabled) {
        console.log(`   ✓ ${result.message}\n`);
        enabled++;
      } else if (result.message.includes('Pending')) {
        console.log(`   ⏳ ${result.message}\n`);
        pending++;
      } else {
        console.log(`   ✗ ${result.message}\n`);
        failed++;
      }

      // Small delay to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    console.log('✅ Processing complete!');
    console.log(`\nSummary:`);
    console.log(`  Already Active: ${alreadyEnabled}`);
    console.log(`  Newly Enabled: ${enabled}`);
    console.log(`  Pending: ${pending}`);
    console.log(`  Failed: ${failed}`);
    
    if (pending > 0 || failed > 0) {
      console.log(`\n⚠ Note: Some accounts may need additional onboarding.`);
      console.log(`   In Stripe test mode, capabilities are typically activated`);
      console.log(`   automatically once required information is provided.`);
      console.log(`   For test payments, pending status may still work.`);
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

