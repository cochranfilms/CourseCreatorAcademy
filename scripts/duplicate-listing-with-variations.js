#!/usr/bin/env node
/*
  Duplicate an existing marketplace listing multiple times with variations.

  What it does:
  - Reads a source listing from Firestore collection `listings/{listingId}`
  - Creates N duplicates with:
      - Different titles (suffixes)
      - Varied prices (small +/- deltas)
      - Varied creatorName (suffixes)
      - connectAccountId forced to a given Connect account (destination)
      - createdAt set to now
    All other fields are copied as-is.

  Defaults:
  - Destination Connect Account: from CLI flag --destination or env DUPL_CONNECT_ACCOUNT_ID
  - Count: --count (default 10)
  - Title prefix override: --titlePrefix (optional). If omitted, base title is taken from source.

  Requirements (env):
  - FIREBASE_ADMIN_PROJECT_ID
  - FIREBASE_ADMIN_CLIENT_EMAIL
  - FIREBASE_ADMIN_PRIVATE_KEY

  Usage:
    node scripts/duplicate-listing-with-variations.js --source aQZBr8dEffOwBcog7hTA --destination acct_1SPHen36uaEym15v --count 12
*/

// Load env from .env.local first, then fallback to .env
try {
  require('dotenv').config({ path: '.env.local' });
} catch {}
require('dotenv').config();
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
      throw new Error('Missing Firebase Admin credentials');
    }
    admin.initializeApp({ credential: admin.credential.cert({ projectId, clientEmail, privateKey }) });
  }
  const db = admin.firestore();
  db.settings({ ignoreUndefinedProperties: true });
  return db;
}

function parseArgs() {
  const args = process.argv.slice(2);
  const out = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--source') out.source = args[++i];
    else if (a === '--destination') out.destination = args[++i];
    else if (a === '--count') out.count = Number(args[++i]);
    else if (a === '--titlePrefix') out.titlePrefix = args[++i];
  }
  return out;
}

function generatePrice(basePriceCents, index) {
  // Vary by up to +/- 10% with deterministic steps based on index
  const percentSteps = [-0.1, -0.07, -0.05, -0.03, 0, 0.02, 0.04, 0.06, 0.08, 0.1];
  const step = percentSteps[index % percentSteps.length];
  const varied = Math.round(basePriceCents * (1 + step));
  return Math.max(varied, 1);
}

function varyCreatorName(baseName, index) {
  const suffixes = ['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo', 'Foxtrot', 'Golf', 'Hotel', 'India', 'Juliet'];
  const suffix = suffixes[index % suffixes.length];
  return `${baseName} ${suffix}`;
}

function varyTitle(baseTitle, titlePrefix, index) {
  const variants = ['Edition', 'Bundle', 'Set', 'Kit', 'Series', 'Pro', 'Plus', 'Lite', 'Max', 'Prime'];
  const variant = variants[index % variants.length];
  const base = titlePrefix ? `${titlePrefix}` : baseTitle;
  return `${base} - ${variant} ${index + 1}`;
}

async function main() {
  console.log('🧬 Duplicating listing with variations...\n');
  const { source, destination, count, titlePrefix } = parseArgs();

  const sourceId = source || process.env.DUPL_SOURCE_LISTING_ID;
  const connectDestination = destination || process.env.DUPL_CONNECT_ACCOUNT_ID;
  const copies = Number.isFinite(count) && count > 0 ? Number(count) : 10;

  if (!sourceId) {
    console.error('✗ Missing required --source <listingId> (or DUPL_SOURCE_LISTING_ID env)');
    process.exit(1);
  }
  if (!connectDestination) {
    console.error('✗ Missing required --destination <acct_...> (or DUPL_CONNECT_ACCOUNT_ID env)');
    process.exit(1);
  }

  const db = initAdmin();

  try {
    // Load source listing
    const srcRef = db.collection('listings').doc(String(sourceId));
    const srcSnap = await srcRef.get();
    if (!srcSnap.exists) {
      console.error(`✗ Source listing not found: ${sourceId}`);
      process.exit(1);
    }
    const src = srcSnap.data() || {};

    // Base values from source
    const baseTitle = String(src.title || 'Untitled Listing');
    const basePrice = Number(src.price || 1000);
    const baseCreatorName = String(src.creatorName || 'Test Seller');

    console.log(`📄 Source: ${sourceId}`);
    console.log(`   Title: ${baseTitle}`);
    console.log(`   Price: ${basePrice}`);
    console.log(`   Creator: ${baseCreatorName}`);
    console.log(`   Destination connectAccountId: ${connectDestination}\n`);

    let created = 0;
    for (let i = 0; i < copies; i++) {
      const newTitle = varyTitle(baseTitle, titlePrefix, i);
      const newPrice = generatePrice(basePrice, i);
      const newCreatorName = varyCreatorName(baseCreatorName, i);

      // Copy all fields except those we intentionally override
      const payload = {
        ...src,
        title: newTitle,
        price: newPrice,
        creatorName: newCreatorName,
        connectAccountId: connectDestination,
        createdAt: admin.firestore.Timestamp.fromDate(new Date())
      };

      // Avoid copying Firestore server timestamp objects that shouldn't be reused directly
      delete payload.id;

      await db.collection('listings').add(payload);
      console.log(`   ✓ Created copy ${i + 1}/${copies}: ${newTitle} ($${(newPrice / 100).toFixed(2)})`);
      created++;

      // Small delay to avoid write spikes
      await new Promise(r => setTimeout(r, 100));
    }

    console.log('\n✅ Duplication complete!');
    console.log(`   Total new listings created: ${created}`);
  } catch (err) {
    console.error('\n❌ Error during duplication:', err);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});


