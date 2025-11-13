#!/usr/bin/env node
/*
  Seed test data for Opportunities and Marketplace listings

  Requirements (env):
  - FIREBASE_ADMIN_PROJECT_ID
  - FIREBASE_ADMIN_CLIENT_EMAIL
  - FIREBASE_ADMIN_PRIVATE_KEY

  Usage:
    node scripts/seed-test-data.js
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

// Generate a test user ID (or use existing test user)
function getTestUserId(index) {
  // These are placeholder user IDs - in real scenario, you'd use actual user IDs
  // For testing, we'll create documents that reference these IDs
  const testUserIds = [
    'test_user_1',
    'test_user_2',
    'test_user_3',
    'test_user_4',
    'test_user_5'
  ];
  return testUserIds[index % testUserIds.length];
}

async function seedOpportunities(db) {
  console.log('\n📋 Seeding Opportunities (Job Board)...\n');

  const opportunities = [
    {
      title: 'Travel Videographer Needed for European Campaign',
      company: 'Horizon Media Productions',
      location: 'Remote',
      type: 'Contract',
      applyUrl: 'https://horizonmedia.com/apply/travel-videographer',
      description: 'We are seeking an experienced travel videographer to create stunning video content for our European tourism campaign. Must have experience with cinematic storytelling, color grading, and post-production. Travel required (expenses covered).',
      posterId: getTestUserId(0),
      posted: admin.firestore.Timestamp.fromDate(new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)) // 2 days ago
    },
    {
      title: 'Wedding Cinematographer - Los Angeles',
      company: 'Elegant Moments Films',
      location: 'Los Angeles, CA',
      type: 'Freelance',
      applyUrl: 'https://elegantmoments.com/careers',
      description: 'Join our team of talented wedding cinematographers! We\'re looking for someone with a passion for capturing love stories. Experience with Canon C70 or similar preferred. Must have portfolio of at least 10 weddings.',
      posterId: getTestUserId(1),
      posted: admin.firestore.Timestamp.fromDate(new Date(Date.now() - 5 * 24 * 60 * 60 * 1000)) // 5 days ago
    },
    {
      title: 'Real Estate Video Editor',
      company: 'Property Visuals Co.',
      location: 'Remote',
      type: 'Part Time',
      applyUrl: 'https://propertyvisuals.com/jobs/editor',
      description: 'Part-time video editor needed for real estate marketing content. Must be proficient in Premiere Pro or DaVinci Resolve. Experience with real estate video editing preferred. Flexible hours, 15-20 hours/week.',
      posterId: getTestUserId(2),
      posted: admin.firestore.Timestamp.fromDate(new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)) // 1 day ago
    },
    {
      title: 'Commercial Video Production Intern',
      company: 'Creative Studio NYC',
      location: 'New York, NY',
      type: 'Internship',
      applyUrl: 'https://creativestudiony.com/internships',
      description: 'Paid internship opportunity for aspiring video producers. Learn from industry professionals while working on real client projects. Must be enrolled in film/media program or recent graduate.',
      posterId: getTestUserId(0),
      posted: admin.firestore.Timestamp.fromDate(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)) // 7 days ago
    },
    {
      title: 'Drone Operator for Documentary Series',
      company: 'Wildlife Documentaries Inc.',
      location: 'Various Locations',
      type: 'Full Time',
      applyUrl: 'https://wildlifedocs.com/careers/drone-operator',
      description: 'Experienced drone operator needed for upcoming nature documentary series. Must have Part 107 license and experience with professional drone systems (DJI Inspire, etc.). Travel required.',
      posterId: getTestUserId(3),
      posted: admin.firestore.Timestamp.fromDate(new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)) // 3 days ago
    },
    {
      title: 'Social Media Video Content Creator',
      company: 'Brand Boost Media',
      location: 'Remote',
      type: 'Contract',
      applyUrl: 'https://brandboost.com/apply/content-creator',
      description: 'Create engaging short-form video content for social media platforms (Instagram Reels, TikTok, YouTube Shorts). Must understand current trends and have strong editing skills. Portfolio required.',
      posterId: getTestUserId(1),
      posted: admin.firestore.Timestamp.fromDate(new Date(Date.now() - 4 * 24 * 60 * 60 * 1000)) // 4 days ago
    },
    {
      title: 'Music Video Director',
      company: 'Sound Visuals',
      location: 'Los Angeles, CA',
      type: 'Freelance',
      applyUrl: 'https://soundvisuals.com/directors',
      description: 'Seeking creative music video director with strong visual storytelling skills. Must have experience directing music videos and working with artists. Budget: $5,000-$15,000 per project.',
      posterId: getTestUserId(4),
      posted: admin.firestore.Timestamp.fromDate(new Date(Date.now() - 6 * 24 * 60 * 60 * 1000)) // 6 days ago
    },
    {
      title: 'Corporate Video Producer',
      company: 'Business Media Group',
      location: 'Chicago, IL',
      type: 'Full Time',
      applyUrl: 'https://businessmediagroup.com/careers',
      description: 'Full-time video producer for corporate clients. Create explainer videos, training content, and marketing materials. Must have 3+ years experience and strong client communication skills.',
      posterId: getTestUserId(2),
      posted: admin.firestore.Timestamp.fromDate(new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)) // 1 day ago
    },
    {
      title: 'Event Videographer - Weekend Gigs',
      company: 'Event Capture Pro',
      location: 'San Francisco, CA',
      type: 'Part Time',
      applyUrl: 'https://eventcapturepro.com/apply',
      description: 'Weekend event videographer needed for weddings, corporate events, and parties. Must have own equipment and reliable transportation. Competitive pay, flexible schedule.',
      posterId: getTestUserId(3),
      posted: admin.firestore.Timestamp.fromDate(new Date(Date.now() - 8 * 24 * 60 * 60 * 1000)) // 8 days ago
    },
    {
      title: 'YouTube Channel Video Editor',
      company: 'Creator Studio',
      location: 'Remote',
      type: 'Contract',
      applyUrl: 'https://creatorstudio.com/editors',
      description: 'Long-term contract for YouTube channel video editing. Must be able to edit 3-5 videos per week. Experience with YouTube optimization, thumbnails, and engaging editing styles required.',
      posterId: getTestUserId(4),
      posted: admin.firestore.Timestamp.fromDate(new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)) // 2 days ago
    }
  ];

  let created = 0;
  let skipped = 0;

  for (const opp of opportunities) {
    try {
      // Check if opportunity with same title already exists
      const existing = await db.collection('opportunities')
        .where('title', '==', opp.title)
        .limit(1)
        .get();

      if (!existing.empty) {
        console.log(`⚠ Skipping "${opp.title}" (already exists)`);
        skipped++;
        continue;
      }

      await db.collection('opportunities').add(opp);
      console.log(`✓ Created: ${opp.title}`);
      console.log(`  Company: ${opp.company} | Location: ${opp.location} | Type: ${opp.type}`);
      created++;
    } catch (err) {
      console.error(`✗ Error creating "${opp.title}":`, err.message);
    }
  }

  console.log(`\n📋 Opportunities: ${created} created, ${skipped} skipped`);
  return { created, skipped };
}

async function seedMarketplaceListings(db) {
  console.log('\n🛒 Seeding Marketplace Listings...\n');

  // Test image URLs (using placeholder images - replace with actual test images if needed)
  const testImages = [
    'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=800',
    'https://images.unsplash.com/photo-1502920917128-1aa500764cbd?w=800',
    'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=800',
  ];

  const listings = [
    {
      title: 'Canon EOS R6 Mark II Body',
      price: 2499,
      shipping: 35,
      condition: 'Like New',
      location: 'United States',
      description: 'Excellent condition Canon R6 Mark II. Purchased 6 months ago, used for professional work. Shutter count under 5,000. Includes original box, charger, and battery. No scratches or marks. Selling to upgrade to R5.',
      images: [testImages[0]],
      creatorId: getTestUserId(0),
      creatorName: 'Alex Thompson',
      createdAt: admin.firestore.Timestamp.fromDate(new Date(Date.now() - 3 * 24 * 60 * 60 * 1000))
    },
    {
      title: 'Sony FE 24-70mm f/2.8 GM Lens',
      price: 1899,
      shipping: 25,
      condition: 'Excellent',
      location: 'United States',
      description: 'Professional Sony G Master lens in perfect condition. Used primarily for studio work. Glass is flawless, no fungus or scratches. Includes front and rear caps, lens hood, and original box. Selling because I switched to Canon system.',
      images: [testImages[1]],
      creatorId: getTestUserId(1),
      creatorName: 'Sarah Chen',
      createdAt: admin.firestore.Timestamp.fromDate(new Date(Date.now() - 5 * 24 * 60 * 60 * 1000))
    },
    {
      title: 'DJI Mini 3 Pro Fly More Combo',
      price: 899,
      shipping: 0,
      condition: 'Like New',
      location: 'United States',
      description: 'DJI Mini 3 Pro with Fly More Combo. Includes drone, 3 batteries, charging hub, propellers, and carrying case. Flown less than 10 times, perfect condition. No crashes or damage. Free shipping included.',
      images: [testImages[2]],
      creatorId: getTestUserId(2),
      creatorName: 'Mike Rodriguez',
      createdAt: admin.firestore.Timestamp.fromDate(new Date(Date.now() - 1 * 24 * 60 * 60 * 1000))
    },
    {
      title: 'Canon EF 70-200mm f/2.8L IS III USM',
      price: 1999,
      shipping: 30,
      condition: 'Excellent',
      location: 'United States',
      description: 'Canon L-series telephoto zoom lens. Professional quality, used for weddings and events. Excellent optical quality, autofocus works perfectly. Includes lens hood, caps, and case. Minor wear on exterior but glass is pristine.',
      images: [testImages[0]],
      creatorId: getTestUserId(3),
      creatorName: 'Jessica Martinez',
      createdAt: admin.firestore.Timestamp.fromDate(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
    },
    {
      title: 'Blackmagic Pocket Cinema Camera 6K',
      price: 2495,
      shipping: 40,
      condition: 'Good',
      location: 'United States',
      description: 'BMPCC 6K camera body. Great for cinematic work. Some wear on body but fully functional. Includes battery and charger. No lens included. Perfect for filmmakers looking for RAW recording capabilities.',
      images: [testImages[1]],
      creatorId: getTestUserId(4),
      creatorName: 'David Kim',
      createdAt: admin.firestore.Timestamp.fromDate(new Date(Date.now() - 4 * 24 * 60 * 60 * 1000))
    },
    {
      title: 'Godox SL-60W LED Video Light',
      price: 89,
      shipping: 15,
      condition: 'New',
      location: 'United States',
      description: 'Brand new, never used Godox SL-60W LED light. Still in original packaging. Perfect for video interviews and small studio setups. Includes power adapter and remote control.',
      images: [testImages[2]],
      creatorId: getTestUserId(0),
      creatorName: 'Alex Thompson',
      createdAt: admin.firestore.Timestamp.fromDate(new Date(Date.now() - 2 * 24 * 60 * 60 * 1000))
    },
    {
      title: 'Rode VideoMic Pro+ Shotgun Microphone',
      price: 329,
      shipping: 10,
      condition: 'Like New',
      location: 'United States',
      description: 'Professional shotgun microphone for video work. Used on a few projects, excellent condition. Includes shock mount, windscreen, and all accessories. Perfect for DSLR/mirrorless cameras.',
      images: [testImages[0]],
      creatorId: getTestUserId(1),
      creatorName: 'Sarah Chen',
      createdAt: admin.firestore.Timestamp.fromDate(new Date(Date.now() - 6 * 24 * 60 * 60 * 1000))
    },
    {
      title: 'Manfrotto 055 Carbon Fiber Tripod',
      price: 449,
      shipping: 20,
      condition: 'Excellent',
      location: 'United States',
      description: 'Lightweight carbon fiber tripod perfect for travel and outdoor shoots. Excellent condition, used but well-maintained. Includes quick-release plate. Great for photographers and videographers.',
      images: [testImages[1]],
      creatorId: getTestUserId(2),
      creatorName: 'Mike Rodriguez',
      createdAt: admin.firestore.Timestamp.fromDate(new Date(Date.now() - 8 * 24 * 60 * 60 * 1000))
    },
    {
      title: 'Sony A7S III Camera Body',
      price: 3499,
      shipping: 50,
      condition: 'Like New',
      location: 'United States',
      description: 'Sony A7S III in excellent condition. Low light champion, perfect for video work. Shutter count under 2,000. Includes original box, charger, battery, and all accessories. Selling to fund A7IV purchase.',
      images: [testImages[2]],
      creatorId: getTestUserId(3),
      creatorName: 'Jessica Martinez',
      createdAt: admin.firestore.Timestamp.fromDate(new Date(Date.now() - 3 * 24 * 60 * 60 * 1000))
    },
    {
      title: 'Canon RF 50mm f/1.2L USM Lens',
      price: 2199,
      shipping: 30,
      condition: 'Excellent',
      location: 'United States',
      description: 'Canon RF mount 50mm f/1.2L lens. Professional portrait lens with incredible bokeh. Used for professional work but maintained perfectly. Glass is flawless. Includes caps, hood, and case.',
      images: [testImages[0]],
      creatorId: getTestUserId(4),
      creatorName: 'David Kim',
      createdAt: admin.firestore.Timestamp.fromDate(new Date(Date.now() - 2 * 24 * 60 * 60 * 1000))
    },
    {
      title: 'Atomos Ninja V 5" HDR Monitor/Recorder',
      price: 599,
      shipping: 25,
      condition: 'Good',
      location: 'United States',
      description: 'Atomos Ninja V external recorder/monitor. Great for recording ProRes and monitoring. Some scratches on screen protector but screen itself is fine. Includes SSD caddy and cables.',
      images: [testImages[1]],
      creatorId: getTestUserId(0),
      creatorName: 'Alex Thompson',
      createdAt: admin.firestore.Timestamp.fromDate(new Date(Date.now() - 4 * 24 * 60 * 60 * 1000))
    },
    {
      title: 'Canon EF 16-35mm f/2.8L III USM',
      price: 2099,
      shipping: 35,
      condition: 'Excellent',
      location: 'United States',
      description: 'Canon wide-angle zoom lens for landscapes and architecture. Professional L-series quality. Used for travel photography, excellent condition. Includes hood, caps, and case.',
      images: [testImages[2]],
      creatorId: getTestUserId(1),
      creatorName: 'Sarah Chen',
      createdAt: admin.firestore.Timestamp.fromDate(new Date(Date.now() - 1 * 24 * 60 * 60 * 1000))
    }
  ];

  let created = 0;
  let skipped = 0;

  for (const listing of listings) {
    try {
      // Check if listing with same title already exists
      const existing = await db.collection('listings')
        .where('title', '==', listing.title)
        .where('creatorId', '==', listing.creatorId)
        .limit(1)
        .get();

      if (!existing.empty) {
        console.log(`⚠ Skipping "${listing.title}" (already exists)`);
        skipped++;
        continue;
      }

      await db.collection('listings').add(listing);
      console.log(`✓ Created: ${listing.title}`);
      console.log(`  Price: $${listing.price}${listing.shipping > 0 ? ` + $${listing.shipping} shipping` : ' (Free shipping)'} | Condition: ${listing.condition}`);
      created++;
    } catch (err) {
      console.error(`✗ Error creating "${listing.title}":`, err.message);
    }
  }

  console.log(`\n🛒 Marketplace Listings: ${created} created, ${skipped} skipped`);
  return { created, skipped };
}

async function main() {
  console.log('🚀 Starting test data seeding...\n');
  
  const db = initAdmin();
  
  try {
    const oppResults = await seedOpportunities(db);
    const listingResults = await seedMarketplaceListings(db);
    
    console.log('\n✅ Seeding complete!');
    console.log(`\nSummary:`);
    console.log(`  Opportunities: ${oppResults.created} created, ${oppResults.skipped} skipped`);
    console.log(`  Marketplace Listings: ${listingResults.created} created, ${listingResults.skipped} skipped`);
    console.log('\n💡 Note: These listings use placeholder user IDs. In production,');
    console.log('   you would use actual user IDs from your Firebase Auth users.');
  } catch (err) {
    console.error('\n❌ Error during seeding:', err);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

