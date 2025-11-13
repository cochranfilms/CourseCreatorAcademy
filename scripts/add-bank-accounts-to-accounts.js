#!/usr/bin/env node
/*
  Add test bank accounts to Stripe Connect accounts
  
  This script adds test bank accounts to all Connect accounts that don't have one.
  Bank accounts are required for transfers capability to be enabled.

  Requirements (env):
  - STRIPE_SECRET_KEY (test mode)

  Usage:
    node scripts/add-bank-accounts-to-accounts.js
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

async function addBankAccount(stripe, accountId) {
  try {
    // Check if account already has external accounts
    const externalAccounts = await stripe.accounts.listExternalAccounts(accountId, {
      limit: 10
    });

    // Check if there's already a bank account
    const hasBankAccount = externalAccounts.data.some(acc => acc.object === 'bank_account');
    
    if (hasBankAccount) {
      return { added: false, message: 'Already has bank account' };
    }

    // Add test bank account
    await stripe.accounts.createExternalAccount(accountId, {
      external_account: {
        object: 'bank_account',
        country: 'US',
        currency: 'usd',
        account_number: '000123456789', // Test account number
        routing_number: '110000000', // Test routing number (ACH)
      },
    });

    return { added: true, message: 'Bank account added' };
  } catch (error) {
    return { added: false, message: error.message };
  }
}

async function main() {
  console.log('🏦 Adding test bank accounts to Stripe Connect accounts...\n');
  
  const stripe = initStripe();
  
  try {
    // List all connected accounts
    const accounts = await stripe.accounts.list({
      limit: 100
    });

    console.log(`Found ${accounts.data.length} connected accounts\n`);

    let added = 0;
    let alreadyHas = 0;
    let failed = 0;

    for (const account of accounts.data) {
      const accountId = account.id;
      const accountName = account.business_profile?.name || account.email || accountId;
      
      console.log(`📦 Processing: ${accountName}`);
      console.log(`   Account ID: ${accountId}`);

      const result = await addBankAccount(stripe, accountId);
      
      if (result.added) {
        console.log(`   ✓ ${result.message}\n`);
        added++;
      } else if (result.message.includes('Already')) {
        console.log(`   ⏭ ${result.message}\n`);
        alreadyHas++;
      } else {
        console.log(`   ✗ ${result.message}\n`);
        failed++;
      }

      // Small delay to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    console.log('✅ Processing complete!');
    console.log(`\nSummary:`);
    console.log(`  Bank Accounts Added: ${added}`);
    console.log(`  Already Had Bank Account: ${alreadyHas}`);
    console.log(`  Failed: ${failed}`);
    
    console.log(`\n💡 Note: After adding bank accounts, Stripe may automatically`);
    console.log(`   enable the transfers capability. If not, accounts may need`);
    console.log(`   to complete onboarding through the Stripe dashboard.`);
    
  } catch (err) {
    console.error('\n❌ Error:', err);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

