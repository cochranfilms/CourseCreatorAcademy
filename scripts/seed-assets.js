#!/usr/bin/env node
/*
  Generate and upload placeholder images for assets

  Requirements (env):
  - FIREBASE_ADMIN_PROJECT_ID
  - FIREBASE_ADMIN_CLIENT_EMAIL
  - FIREBASE_ADMIN_PRIVATE_KEY

  Usage:
    node scripts/seed-assets.js

  This script will:
  1. Generate placeholder images for each asset category
  2. Upload images directly to Firebase Storage
  3. Create Firestore documents in the assets collection (if they don't exist)
*/

// Load env from .env.local first, then fallback to .env
try {
  require('dotenv').config({ path: '.env.local' });
} catch {}
require('dotenv').config();
const admin = require('firebase-admin');
const { createCanvas } = require('canvas');

function initAdmin() {
  if (admin.apps.length) {
    return {
      db: admin.firestore(),
      storage: admin.storage()
    };
  }
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
    admin.initializeApp({ 
      credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
      projectId: projectId
    });
  }
  const db = admin.firestore();
  db.settings({ ignoreUndefinedProperties: true });
  const storage = admin.storage();
  return { db, storage };
}

/**
 * Generates a placeholder image based on asset category
 */
function generatePlaceholderImage(category, title, width = 1920, height = 1080) {
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // Background gradient
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  
  if (category === 'LUTs & Presets') {
    // Color grading swatches
    gradient.addColorStop(0, '#1a1a2e');
    gradient.addColorStop(0.3, '#16213e');
    gradient.addColorStop(0.6, '#0f3460');
    gradient.addColorStop(1, '#533483');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
    
    // Add color swatches
    const swatchSize = width / 6;
    const colors = ['#ff6b6b', '#4ecdc4', '#ffe66d', '#95e1d3', '#f38181', '#aa96da'];
    colors.forEach((color, i) => {
      ctx.fillStyle = color;
      ctx.fillRect(i * swatchSize, height / 2 - 50, swatchSize - 20, 100);
    });
    
    // Title text
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 48px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(title, width / 2, height / 2 + 150);
    
  } else if (category === 'Overlays & Transitions') {
    // Light flares and effects
    gradient.addColorStop(0, '#0a0a0a');
    gradient.addColorStop(0.5, '#1a1a2e');
    gradient.addColorStop(1, '#0a0a0a');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
    
    // Create lens flare effect
    const centerX = width / 2;
    const centerY = height / 2;
    const radialGradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, width / 2);
    radialGradient.addColorStop(0, 'rgba(255, 255, 255, 0.8)');
    radialGradient.addColorStop(0.3, 'rgba(255, 200, 100, 0.4)');
    radialGradient.addColorStop(0.6, 'rgba(100, 150, 255, 0.2)');
    radialGradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = radialGradient;
    ctx.fillRect(0, 0, width, height);
    
    // Add light streaks
    for (let i = 0; i < 5; i++) {
      const x = (width / 6) * (i + 1);
      const streakGradient = ctx.createLinearGradient(x, 0, x, height);
      streakGradient.addColorStop(0, 'rgba(255, 255, 255, 0)');
      streakGradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.3)');
      streakGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = streakGradient;
      ctx.fillRect(x - 2, 0, 4, height);
    }
    
    // Title text
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 48px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(title, width / 2, height - 100);
    
  } else if (category === 'SFX & Plugins') {
    // Sound wave visualization
    gradient.addColorStop(0, '#1e3c72');
    gradient.addColorStop(1, '#2a5298');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
    
    // Draw sound waves
    ctx.strokeStyle = '#4ecdc4';
    ctx.lineWidth = 4;
    const centerY = height / 2;
    const waveLength = width / 8;
    
    for (let i = 0; i < 8; i++) {
      ctx.beginPath();
      const x = i * waveLength;
      const amplitude = 50 + Math.random() * 100;
      ctx.moveTo(x, centerY);
      for (let j = 0; j < waveLength; j++) {
        const y = centerY + Math.sin((j / waveLength) * Math.PI * 4) * amplitude;
        ctx.lineTo(x + j, y);
      }
      ctx.stroke();
    }
    
    // Add frequency bars
    ctx.fillStyle = '#ffe66d';
    const barWidth = width / 20;
    for (let i = 0; i < 20; i++) {
      const barHeight = 50 + Math.random() * 200;
      ctx.fillRect(i * barWidth + 10, centerY - barHeight / 2, barWidth - 20, barHeight);
    }
    
    // Title text
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 48px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(title, width / 2, height - 100);
    
  } else if (category === 'Templates') {
    // Video editing interface mockup
    gradient.addColorStop(0, '#2d3436');
    gradient.addColorStop(1, '#636e72');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
    
    // Timeline area
    ctx.fillStyle = '#1e1e1e';
    ctx.fillRect(0, height * 0.7, width, height * 0.3);
    
    // Timeline tracks
    ctx.strokeStyle = '#4a4a4a';
    ctx.lineWidth = 2;
    for (let i = 1; i < 4; i++) {
      const y = height * 0.7 + (height * 0.3 / 4) * i;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
    
    // Video clips on timeline
    const clipColors = ['#e74c3c', '#3498db', '#2ecc71', '#f39c12'];
    clipColors.forEach((color, i) => {
      ctx.fillStyle = color;
      const clipX = (width / 5) * (i + 0.5);
      const clipWidth = width / 6;
      ctx.fillRect(clipX, height * 0.7 + 20, clipWidth, (height * 0.3 / 4) - 40);
    });
    
    // Preview area
    ctx.fillStyle = '#000000';
    ctx.fillRect(width * 0.1, height * 0.1, width * 0.8, height * 0.5);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.strokeRect(width * 0.1, height * 0.1, width * 0.8, height * 0.5);
    
    // Title text
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 48px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(title, width / 2, height * 0.65);
  } else {
    // Default gradient
    gradient.addColorStop(0, '#667eea');
    gradient.addColorStop(1, '#764ba2');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
    
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 48px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(title, width / 2, height / 2);
  }

  return canvas.toBuffer('image/png');
}

/**
 * Uploads an image buffer to Firebase Storage
 */
async function uploadImageToStorage(bucket, storagePath, imageBuffer) {
  const file = bucket.file(storagePath);
  const [fileExists] = await file.exists();
  
  if (fileExists) {
    return false; // File already exists, skip upload
  }
  
  const stream = file.createWriteStream({
    metadata: {
      contentType: 'image/png',
    },
  });

  await new Promise((resolve, reject) => {
    stream.on('error', reject);
    stream.on('finish', resolve);
    stream.end(imageBuffer);
  });
  
  return true; // File was uploaded
}

/**
 * Generates a public download URL for a Firebase Storage file
 * Uses the Firebase Storage public URL format
 */
async function getPublicUrl(bucket, filePath) {
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID || 'course-creator-academy-866d6';
  // Generate public URL format - this works when storage rules allow public read
  // Format: https://firebasestorage.googleapis.com/v0/b/{bucket}/o/{path}?alt=media
  const encodedPath = encodeURIComponent(filePath);
  return `https://firebasestorage.googleapis.com/v0/b/${projectId}.appspot.com/o/${encodedPath}?alt=media`;
}

/**
 * Generates and uploads placeholder images for an asset
 * Returns the thumbnail URL for the preview image
 */
async function generateAndUploadImages(bucket, asset) {
  const uploadedImages = [];
  
  // Extract folder name from storage path (e.g., "assets/luts/sleektone-minimal-luts.zip" -> "sleektone-minimal-luts")
  const zipFileName = asset.storagePath.split('/').pop().replace('.zip', '');
  const folderPath = asset.storagePath.replace(`/${zipFileName}.zip`, '');
  const imageFolderPath = `${folderPath}/${zipFileName}`;
  
  // Generate multiple example images
  const imageCount = asset.category === 'Templates' ? 3 : 5;
  
  for (let i = 1; i <= imageCount; i++) {
    const imageBuffer = generatePlaceholderImage(asset.category, asset.title);
    const imagePath = `${imageFolderPath}/example-${i.toString().padStart(2, '0')}.png`;
    
    const wasUploaded = await uploadImageToStorage(bucket, imagePath, imageBuffer);
    if (wasUploaded) {
      uploadedImages.push(imagePath);
      console.log(`  📸 Uploaded: ${imagePath}`);
    } else {
      console.log(`  ⏭️  Skipped (exists): ${imagePath}`);
    }
  }
  
  // Generate and upload preview image (smaller size)
  const previewBuffer = generatePlaceholderImage(asset.category, asset.title, 800, 450);
  const previewPath = `${imageFolderPath}/preview.png`;
  
  const previewUploaded = await uploadImageToStorage(bucket, previewPath, previewBuffer);
  if (previewUploaded) {
    uploadedImages.push(previewPath);
    console.log(`  📸 Uploaded: ${previewPath}`);
  } else {
    console.log(`  ⏭️  Skipped (exists): ${previewPath}`);
  }
  
  // Generate public URL for the preview image
  const thumbnailUrl = await getPublicUrl(bucket, previewPath);
  
  return { uploadedImages, thumbnailUrl };
}

const sampleAssets = [
  // LUTs & Presets (2 assets)
  {
    title: 'Sleektone Minimal LUTs',
    category: 'LUTs & Presets',
    description: 'Professional color grading LUTs for a clean, minimal aesthetic',
    storagePath: 'assets/luts/sleektone-minimal-luts.zip',
    fileType: 'zip',
  },
  {
    title: 'Cinematic Color Pack',
    category: 'LUTs & Presets',
    description: 'A collection of cinematic color grading presets for video editing',
    storagePath: 'assets/luts/cinematic-color-pack.zip',
    fileType: 'zip',
  },
  
  // Overlays & Transitions (2 assets)
  {
    title: 'Cinematic Flares Vol.1',
    category: 'Overlays & Transitions',
    description: 'Professional lens flares and light leaks for cinematic effects',
    storagePath: 'assets/overlays/cinematic-flares-vol1.zip',
    fileType: 'zip',
  },
  {
    title: 'Smooth Transitions Pack',
    category: 'Overlays & Transitions',
    description: 'Smooth, professional transition effects for video editing',
    storagePath: 'assets/overlays/smooth-transitions.zip',
    fileType: 'zip',
  },
  
  // SFX & Plugins (2 assets)
  {
    title: 'Flash & Pop SFX',
    category: 'SFX & Plugins',
    description: 'High-quality sound effects for flash and pop transitions',
    storagePath: 'assets/sfx/flash-pop-sfx.zip',
    fileType: 'zip',
  },
  {
    title: 'Ambient Sound Library',
    category: 'SFX & Plugins',
    description: 'A comprehensive library of ambient sounds and background audio',
    storagePath: 'assets/sfx/ambient-sound-library.zip',
    fileType: 'zip',
  },
  
  // Templates (2 assets)
  {
    title: 'After Effects Title Pack',
    category: 'Templates',
    description: 'Professional title animations and lower thirds for After Effects',
    storagePath: 'assets/templates/ae-title-pack.zip',
    fileType: 'zip',
  },
  {
    title: 'Premiere Pro Editing Template',
    category: 'Templates',
    description: 'Ready-to-use editing template with transitions and effects',
    storagePath: 'assets/templates/premiere-template.zip',
    fileType: 'zip',
  },
];

async function seedAssets() {
  const { db, storage } = initAdmin();
  console.log('Generating and uploading placeholder images for assets...\n');

  // Get the storage bucket
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID || 'course-creator-academy-866d6';
  const bucketName = `${projectId}.firebasestorage.app`;
  const bucket = storage.bucket(bucketName);

  for (const asset of sampleAssets) {
    try {
      console.log(`\n🎨 Processing: "${asset.title}"`);
      
      // Check if asset already exists in Firestore (by title)
      const existing = await db.collection('assets')
        .where('title', '==', asset.title)
        .limit(1)
        .get();

      let assetDocId;
      let assetDocRef;
      if (!existing.empty) {
        assetDocRef = existing.docs[0].ref;
        assetDocId = existing.docs[0].id;
        console.log(`  ⏭️  Firestore document already exists (${assetDocId})`);
      } else {
        // Create Firestore document if it doesn't exist
        const assetData = {
          ...asset,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        };
        assetDocRef = await db.collection('assets').add(assetData);
        assetDocId = assetDocRef.id;
        console.log(`  ✅ Created Firestore document (${assetDocId})`);
      }

      // Generate and upload placeholder images
      const { uploadedImages, thumbnailUrl } = await generateAndUploadImages(bucket, asset);
      
      if (uploadedImages.length > 0) {
        console.log(`  ✨ Uploaded ${uploadedImages.length} image(s)`);
      } else {
        console.log(`  ℹ️  All images already exist in Storage`);
      }
      
      // Update Firestore document with thumbnailUrl if it doesn't have one
      const currentData = !existing.empty ? existing.docs[0].data() : null;
      if (!currentData?.thumbnailUrl) {
        await assetDocRef.update({
          thumbnailUrl: thumbnailUrl,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        console.log(`  ✅ Updated Firestore with thumbnailUrl`);
      } else {
        console.log(`  ⏭️  Firestore already has thumbnailUrl`);
      }
      
    } catch (error) {
      console.error(`❌ Error processing asset "${asset.title}":`, error.message);
      console.error(error.stack);
    }
  }

  console.log('\n✨ Image generation complete!');
  console.log('\n📝 Note: Placeholder images have been uploaded to Firebase Storage.');
  console.log('   Images are organized in folders matching the ZIP file names.');
  console.log('   Each asset folder contains:');
  console.log('   - Multiple example PNG images (5 for most assets, 3 for templates)');
  console.log('   - A preview.png file (800x450)');
}

seedAssets().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

