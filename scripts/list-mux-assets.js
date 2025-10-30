#!/usr/bin/env node

/**
 * List all Mux video assets
 * 
 * Usage:
 *   node scripts/list-mux-assets.js
 * 
 * This script requires MUX_TOKEN_ID and MUX_TOKEN_SECRET environment variables
 */

// Load environment variables from .env.local if available
try {
  require('dotenv').config({ path: '.env.local' });
} catch (e) {
  // dotenv not installed or file not found, use process.env directly
}

const { Mux } = require('@mux/mux-node');

const mux = new Mux({
  tokenId: process.env.MUX_TOKEN_ID,
  tokenSecret: process.env.MUX_TOKEN_SECRET,
});

async function listAssets() {
  try {
    console.log('\n📹 Fetching Mux assets...\n');

    const assets = await mux.video.assets.list({ limit: 100 });

    if (assets.data.length === 0) {
      console.log('No assets found.');
      return;
    }

    console.log(`Found ${assets.data.length} asset(s):\n`);
    console.log('─'.repeat(80));

    assets.data.forEach((asset, index) => {
      const playbackId = asset.playback_ids?.[0]?.id || 'No playback ID';
      const status = asset.status || 'unknown';
      const duration = asset.duration ? `${Math.round(asset.duration)}s` : 'N/A';
      const createdAt = asset.created_at ? new Date(asset.created_at * 1000).toLocaleDateString() : 'N/A';

      console.log(`\n${index + 1}. Asset ID: ${asset.id}`);
      console.log(`   Playback ID: ${playbackId}`);
      console.log(`   Status: ${status}`);
      console.log(`   Duration: ${duration}`);
      console.log(`   Created: ${createdAt}`);
      if (asset.mp4_support) {
        console.log(`   MP4 Support: ${asset.mp4_support}`);
      }
    });

    console.log('\n' + '─'.repeat(80));
    console.log('\n💡 To link a video to a lesson, use:');
    console.log('   node scripts/link-mux-video.js\n');

  } catch (error) {
    console.error('\n❌ Error fetching assets:', error.message);
    if (error.message.includes('MUX_TOKEN_ID') || error.message.includes('MUX_TOKEN_SECRET')) {
      console.error('\n💡 Make sure MUX_TOKEN_ID and MUX_TOKEN_SECRET are set in .env.local');
    }
    process.exit(1);
  }
}

listAssets();

