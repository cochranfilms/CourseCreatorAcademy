#!/usr/bin/env node

/**
 * Script to decode base64 Firebase private key for Vercel environment variables
 * 
 * Usage:
 *   node decode-private-key.js <base64-string>
 *   OR
 *   echo "your-base64-string" | node decode-private-key.js
 */

const readline = require('readline');

function decodeBase64Key(base64String) {
  try {
    // Remove any whitespace
    const cleanBase64 = base64String.trim().replace(/\s/g, '');
    
    // Decode from base64
    const decoded = Buffer.from(cleanBase64, 'base64').toString('utf-8');
    
    return decoded;
  } catch (error) {
    throw new Error(`Failed to decode base64: ${error.message}`);
  }
}

function formatForVercel(privateKey) {
  // Vercel expects the private key with \n as literal characters
  // so we need to escape newlines properly
  return privateKey.replace(/\n/g, '\\n');
}

// Get input from command line argument or stdin
const args = process.argv.slice(2);

if (args.length > 0) {
  // Input from command line argument
  const base64Input = args.join(' ');
  const decoded = decodeBase64Key(base64Input);
  
  console.log('\n=== Decoded Private Key ===\n');
  console.log(decoded);
  
  console.log('\n=== Formatted for Vercel (with \\n escapes) ===\n');
  console.log(formatForVercel(decoded));
  
  console.log('\n=== Copy the formatted version above and paste it into Vercel ===\n');
} else {
  // Read from stdin
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  rl.question('Paste your base64-encoded private key: ', (base64Input) => {
    try {
      const decoded = decodeBase64Key(base64Input);
      
      console.log('\n=== Decoded Private Key ===\n');
      console.log(decoded);
      
      console.log('\n=== Formatted for Vercel (with \\n escapes) ===\n');
      console.log(formatForVercel(decoded));
      
      console.log('\n=== Copy the formatted version above and paste it into Vercel ===\n');
    } catch (error) {
      console.error('Error:', error.message);
      process.exit(1);
    }
    
    rl.close();
  });
}

