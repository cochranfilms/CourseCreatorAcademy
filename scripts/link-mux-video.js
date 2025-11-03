#!/usr/bin/env node

/**
 * Helper script to link a Mux video asset to a Firestore lesson
 * 
 * Usage:
 *   node scripts/link-mux-video.js
 * 
 * This script will prompt you for:
 * - Course ID
 * - Module ID  
 * - Lesson ID
 * - Mux Asset ID
 * - Mux Playback ID
 * - Lesson title (optional)
 */

// Load environment variables from .env.local if available
try {
  require('dotenv').config({ path: '.env.local' });
} catch (e) {
  // dotenv not installed or file not found, use process.env directly
}

const readline = require('readline');
const admin = require('firebase-admin');

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  // Try to use service account from environment
  const serviceAccount = {
    projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
    clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  };

  if (!serviceAccount.projectId || !serviceAccount.clientEmail || !serviceAccount.privateKey) {
    console.error('❌ Firebase Admin credentials not found in environment variables.');
    console.error('Please set:');
    console.error('  - FIREBASE_ADMIN_PROJECT_ID');
    console.error('  - FIREBASE_ADMIN_CLIENT_EMAIL');
    console.error('  - FIREBASE_ADMIN_PRIVATE_KEY');
    process.exit(1);
  }

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function linkMuxVideo() {
  console.log('\n🎬 Mux Video Linker\n');
  console.log('This script will help you link a Mux video asset to a Firestore lesson.\n');

  try {
    // Get course ID
    const courseId = await question('Enter Course ID: ');
    if (!courseId) {
      console.error('❌ Course ID is required');
      process.exit(1);
    }

    // Check if course exists
    const courseRef = db.collection('courses').doc(courseId);
    const courseDoc = await courseRef.get();
    if (!courseDoc.exists) {
      console.log(`⚠️  Course "${courseId}" does not exist.`);
      const createCourse = await question('Create this course? (y/n): ');
      if (createCourse.toLowerCase() === 'y') {
        const courseTitle = await question('Enter course title: ');
        const courseSlug = await question('Enter course slug (or press Enter to use courseId): ') || courseId;
        const coursePrice = await question('Enter course price (default 0): ') || '0';
        
        await courseRef.set({
          title: courseTitle,
          slug: courseSlug,
          summary: '',
          price: parseFloat(coursePrice),
          isSubscription: false,
          featured: false,
          categories: [],
          modulesCount: 0,
          lessonsCount: 0,
          createdBy: 'admin',
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          published: false,
        });
        console.log('✅ Course created');
      } else {
        console.log('❌ Cannot proceed without course');
        process.exit(1);
      }
    }

    // Get module ID
    const moduleId = await question('Enter Module ID: ');
    if (!moduleId) {
      console.error('❌ Module ID is required');
      process.exit(1);
    }

    // Check if module exists
    const moduleRef = courseRef.collection('modules').doc(moduleId);
    const moduleDoc = await moduleRef.get();
    if (!moduleDoc.exists) {
      console.log(`⚠️  Module "${moduleId}" does not exist.`);
      const createModule = await question('Create this module? (y/n): ');
      if (createModule.toLowerCase() === 'y') {
        const moduleTitle = await question('Enter module title: ');
        const moduleIndex = await question('Enter module index (default 1): ') || '1';
        
        await moduleRef.set({
          title: moduleTitle,
          index: parseInt(moduleIndex),
        });
        console.log('✅ Module created');
      } else {
        console.log('❌ Cannot proceed without module');
        process.exit(1);
      }
    }

    // Get lesson ID
    const lessonId = await question('Enter Lesson ID: ');
    if (!lessonId) {
      console.error('❌ Lesson ID is required');
      process.exit(1);
    }

    // Get Mux Asset ID
    const muxAssetId = await question('Enter Mux Asset ID: ');
    if (!muxAssetId) {
      console.error('❌ Mux Asset ID is required');
      process.exit(1);
    }

    // Get Mux Playback ID
    const muxPlaybackId = await question('Enter Mux Playback ID: ');
    if (!muxPlaybackId) {
      console.error('❌ Mux Playback ID is required');
      process.exit(1);
    }

    // Get lesson title (optional)
    const lessonTitle = await question('Enter lesson title (optional): ');

    // Get lesson index
    const lessonIndex = await question('Enter lesson index (default 1): ') || '1';

    // Get free preview setting
    const freePreview = await question('Is this a free preview? (y/n, default n): ');
    const isFreePreview = freePreview.toLowerCase() === 'y';

    // Check if lesson exists
    const lessonRef = moduleRef.collection('lessons').doc(lessonId);
    const lessonDoc = await lessonRef.get();

    const lessonData = {
      muxAssetId,
      muxPlaybackId,
      index: parseInt(lessonIndex),
      freePreview: isFreePreview,
      resources: [],
      transcriptPath: null,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    if (lessonTitle) {
      lessonData.title = lessonTitle;
    }

    if (lessonDoc.exists) {
      // Update existing lesson
      await lessonRef.update(lessonData);
      console.log(`\n✅ Updated lesson "${lessonId}" with Mux video`);
    } else {
      // Create new lesson
      lessonData.durationSec = 0; // Will be updated by webhook
      lessonData.createdAt = admin.firestore.FieldValue.serverTimestamp();
      
      if (!lessonData.title) {
        lessonData.title = `Lesson ${lessonIndex}`;
      }

      await lessonRef.set(lessonData);
      console.log(`\n✅ Created lesson "${lessonId}" with Mux video`);

      // Update course lesson count
      const courseData = courseDoc.data();
      await courseRef.update({
        lessonsCount: (courseData?.lessonsCount || 0) + 1,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    console.log('\n📋 Summary:');
    console.log(`   Course: ${courseId}`);
    console.log(`   Module: ${moduleId}`);
    console.log(`   Lesson: ${lessonId}`);
    console.log(`   Mux Asset ID: ${muxAssetId}`);
    console.log(`   Mux Playback ID: ${muxPlaybackId}`);
    console.log('\n✅ Video linked successfully!\n');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    rl.close();
  }
}

// Run the script
linkMuxVideo();

