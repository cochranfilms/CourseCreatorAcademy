import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminStorage } from '@/lib/firebaseAdmin';

// GET /api/assets/sound-effect-download-proxy?assetId=xxx&soundEffectId=xxx
// Streams the file directly with Content-Disposition header to force download
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
    const fileName = soundEffectData?.fileName || 'sound-effect';

    if (!storagePath) {
      return NextResponse.json({ error: 'Sound effect has no storage path' }, { status: 400 });
    }

    // Get file from Firebase Storage
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
    
    // Get file metadata
    const [metadata] = await file.getMetadata();
    const contentType = metadata.contentType || 'application/octet-stream';
    
    // Create a readable stream from the file
    const stream = file.createReadStream();
    
    // Convert stream to buffer
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);
    
    // Return file with Content-Disposition header to force download
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${encodeURIComponent(fileName)}"`,
        'Content-Length': buffer.length.toString(),
      },
    });
  } catch (err: any) {
    console.error('Error streaming sound effect:', err);
    return NextResponse.json({ error: err?.message || 'Failed to download sound effect' }, { status: 500 });
  }
}

export const runtime = 'nodejs';

