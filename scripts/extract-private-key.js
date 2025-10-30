#!/usr/bin/env node

/**
 * Extract Firebase private key from service account JSON file
 * Formats it correctly for Vercel environment variables
 * 
 * Usage:
 *   node scripts/extract-private-key.js path/to/service-account-key.json
 */

const fs = require('fs');
const path = require('path');

const jsonPath = process.argv[2];

if (!jsonPath) {
  console.error('Usage: node scripts/extract-private-key.js <path-to-service-account-key.json>');
  console.error('\nExample:');
  console.error('  node scripts/extract-private-key.js ./firebase-service-account.json');
  process.exit(1);
}

if (!fs.existsSync(jsonPath)) {
  console.error(`Error: File not found: ${jsonPath}`);
  process.exit(1);
}

try {
  const jsonContent = fs.readFileSync(jsonPath, 'utf8');
  const serviceAccount = JSON.parse(jsonContent);
  
  if (!serviceAccount.private_key) {
    console.error('Error: private_key not found in JSON file');
    process.exit(1);
  }

  const privateKey = serviceAccount.private_key;
  
  console.log('\n=== Firebase Private Key (Ready for Vercel) ===\n');
  console.log('Copy the entire block below:\n');
  console.log('─'.repeat(60));
  console.log(privateKey);
  console.log('─'.repeat(60));
  
  console.log('\n=== Additional Info ===\n');
  console.log(`Project ID: ${serviceAccount.project_id || 'Not found'}`);
  console.log(`Client Email: ${serviceAccount.client_email || 'Not found'}`);
  
  console.log('\n=== Environment Variables for Vercel ===\n');
  console.log('FIREBASE_ADMIN_PROJECT_ID=' + (serviceAccount.project_id || 'your-project-id'));
  console.log('FIREBASE_ADMIN_CLIENT_EMAIL=' + (serviceAccount.client_email || 'your-client-email'));
  console.log('\nFIREBASE_ADMIN_PRIVATE_KEY=');
  console.log('(Copy the private key block shown above)');
  
  console.log('\n✅ The private key above is ready to paste directly into Vercel\n');
  
} catch (error) {
  console.error('Error:', error.message);
  process.exit(1);
}

