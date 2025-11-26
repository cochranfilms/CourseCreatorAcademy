import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminStorage } from '@/lib/firebaseAdmin';

// GET /api/assets/sound-effect-download?assetId=xxx&soundEffectId=xxx
// Returns a signed download URL for an individual sound effect
export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const assetId = searchParams.get('assetId');
    const soundEffectId = searchParams.get('soundEffectId');

    if (!assetId || !soundEffectId) {
      return NextResponse.json({ error: 'assetId and soundEffectId are required' }, { status: 400 });
    }

    if (!adminDb || !adminStorage) {
      return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
    }

    // Get sound effect document
    const soundEffectDoc = await adminDb
      .collection('assets')
      .doc(assetId)
      .collection('soundEffects')
      .doc(soundEffectId)
      .get();

    if (!soundEffectDoc.exists) {
      return NextResponse.json({ error: 'Sound effect not found' }, { status: 404 });
    }

    const soundEffectData = soundEffectDoc.data();
    const storagePath = soundEffectData?.storagePath;

    if (!storagePath) {
      return NextResponse.json({ error: 'Sound effect has no storage path' }, { status: 400 });
    }

    // Get signed URL from Firebase Storage
    const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID || 'course-creator-academy-866d6';
    const bucketName = `${projectId}.firebasestorage.app`;
    const bucket = adminStorage.bucket(bucketName);
    const file = bucket.file(storagePath);
    
    // Check if file exists
    const [exists] = await file.exists();
    if (!exists) {
      console.error(`File not found at path: ${storagePath}`);
      return NextResponse.json({ 
        error: 'File not found in storage',
        details: `Path: ${storagePath}`
      }, { status: 404 });
    }
    
    // Generate signed URL (valid for 1 hour)
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1);
    
    try {
      const [signedUrl] = await file.getSignedUrl({
        action: 'read',
        expires: expiresAt,
      });

      return NextResponse.json({ downloadUrl: signedUrl });
    } catch (signError: any) {
      console.error('Error generating signed URL:', signError);
      throw signError;
    }
  } catch (err: any) {
    console.error('Error generating download URL:', err);
    return NextResponse.json({ error: err?.message || 'Failed to generate download URL' }, { status: 500 });
  }
}

export const runtime = 'nodejs';

