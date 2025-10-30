#!/usr/bin/env node

/**
 * Quick script to link Mux video to Technical 101 course for testing
 * 
 * Usage:
 *   node scripts/link-technical-101-video.js
 */

// Load environment variables from .env.local if available
try {
  require('dotenv').config({ path: '.env.local' });
} catch (e) {
  // dotenv not installed or file not found, use process.env directly
}

const admin = require('firebase-admin');

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
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

async function linkTechnical101Video() {
  const courseId = 'technical-101';
  const moduleId = 'module-1';
  const lessonId = 'lesson-1';
  
  const muxAssetId = '02Vp3dV4QiLM22Ge2n004DfOFkxWJp6kpBhBtddLILwKw';
  const muxPlaybackId = 'Mv2sHA2ZvbpkEUn3W9PtO2XEP2kSG6zpOD1c02a8liqE';
  const lessonTitle = 'How To Shorten Background Music (Remix Tool)';

  try {
    console.log('\n🎬 Linking Mux video to Technical 101...\n');

    // Check/create course
    const courseRef = db.collection('courses').doc(courseId);
    const courseDoc = await courseRef.get();
    
    if (!courseDoc.exists) {
      console.log('📚 Creating course: Technical 101');
      await courseRef.set({
        title: 'Technical 101',
        slug: courseId,
        summary: 'Technical course for testing',
        price: 0,
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
      console.log('✅ Course exists');
    }

    // Check/create module
    const moduleRef = courseRef.collection('modules').doc(moduleId);
    const moduleDoc = await moduleRef.get();
    
    if (!moduleDoc.exists) {
      console.log('📦 Creating module: Module 1');
      await moduleRef.set({
        title: 'Module 1: Introduction',
        index: 1,
      });
      console.log('✅ Module created');
      
      // Update course modules count
      const courseData = courseDoc.data();
      await courseRef.update({
        modulesCount: (courseData?.modulesCount || 0) + 1,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    } else {
      console.log('✅ Module exists');
    }

    // Check/create lesson
    const lessonRef = moduleRef.collection('lessons').doc(lessonId);
    const lessonDoc = await lessonRef.get();
    
    const lessonData = {
      title: lessonTitle,
      index: 1,
      muxAssetId,
      muxPlaybackId,
      durationSec: 138, // 2:18 from the asset details
      freePreview: false,
      resources: [],
      transcriptPath: null,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    if (!lessonDoc.exists) {
      console.log('📹 Creating lesson: Lesson 1');
      lessonData.createdAt = admin.firestore.FieldValue.serverTimestamp();
      await lessonRef.set(lessonData);
      console.log('✅ Lesson created');
      
      // Update course lessons count
      const courseData = courseDoc.data();
      await courseRef.update({
        lessonsCount: (courseData?.lessonsCount || 0) + 1,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    } else {
      console.log('📹 Updating existing lesson');
      await lessonRef.update(lessonData);
      console.log('✅ Lesson updated');
    }

    console.log('\n📋 Summary:');
    console.log(`   Course: ${courseId} (Technical 101)`);
    console.log(`   Module: ${moduleId} (Module 1)`);
    console.log(`   Lesson: ${lessonId} (${lessonTitle})`);
    console.log(`   Mux Asset ID: ${muxAssetId}`);
    console.log(`   Mux Playback ID: ${muxPlaybackId}`);
    console.log('\n✅ Video linked successfully!\n');
    console.log('📍 Firestore path:');
    console.log(`   courses/${courseId}/modules/${moduleId}/lessons/${lessonId}\n`);

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  }
}

// Run the script
linkTechnical101Video();

