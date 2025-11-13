#!/usr/bin/env node
/*
  Generate Stripe Connect onboarding links for test accounts
  
  This script creates account links for all Connect accounts that need onboarding.
  These links can be used to complete ToS acceptance and enable transfers capability.

  Requirements (env):
  - STRIPE_SECRET_KEY (test mode)
  - NEXT_PUBLIC_BASE_URL (optional, defaults to localhost)

  Usage:
    node scripts/generate-onboarding-links.js
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

async function generateOnboardingLink(stripe, accountId, accountName) {
  try {
    const origin = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3002';
    
    const link = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${origin}/creator/onboarding?refresh=1`,
      return_url: `${origin}/creator/onboarding?return=1`,
      type: 'account_onboarding'
    });

    return { success: true, url: link.url };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function main() {
  console.log('🔗 Generating Stripe Connect onboarding links...\n');
  
  const stripe = initStripe();
  
  try {
    // List all connected accounts
    const accounts = await stripe.accounts.list({
      limit: 100
    });

    console.log(`Found ${accounts.data.length} connected accounts\n`);

    const links = [];
    let successCount = 0;
    let failedCount = 0;

    for (const account of accounts.data) {
      const accountId = account.id;
      const accountName = account.business_profile?.name || account.email || accountId;
      const capabilities = account.capabilities || {};
      const transfersStatus = capabilities.transfers;
      
      // Only generate links for accounts that don't have transfers active
      if (transfersStatus === 'active') {
        continue;
      }

      console.log(`📦 Processing: ${accountName}`);
      console.log(`   Account ID: ${accountId}`);
      console.log(`   Transfers Status: ${transfersStatus || 'not requested'}`);

      const result = await generateOnboardingLink(stripe, accountId, accountName);
      
      if (result.success) {
        console.log(`   ✓ Link generated`);
        console.log(`   ${result.url}\n`);
        links.push({
          accountId,
          accountName,
          url: result.url
        });
        successCount++;
      } else {
        console.log(`   ✗ Failed: ${result.error}\n`);
        failedCount++;
      }

      // Small delay to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    console.log('✅ Processing complete!');
    console.log(`\nSummary:`);
    console.log(`  Links Generated: ${successCount}`);
    console.log(`  Failed: ${failedCount}`);
    
    if (links.length > 0) {
      console.log(`\n📋 Onboarding Links:`);
      console.log(`\nTo enable transfers capability, visit these links and complete onboarding:`);
      console.log(`(In test mode, you can use fake data for all fields)\n`);
      
      links.forEach((link, index) => {
        console.log(`${index + 1}. ${link.accountName}`);
        console.log(`   ${link.url}\n`);
      });
      
      console.log(`\n💡 Tip: In Stripe test mode, you can use fake data for:`);
      console.log(`   - SSN: 0000`);
      console.log(`   - Bank account: Any test account number`);
      console.log(`   - Address: Any US address`);
      console.log(`   - Business info: Any test data`);
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

