import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminStorage } from '@/lib/firebaseAdmin';

// GET /api/assets/download?assetId=xxx
// Returns a signed download URL for the asset file
export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const assetId = searchParams.get('assetId');

    if (!assetId) {
      return NextResponse.json({ error: 'assetId is required' }, { status: 400 });
    }

    if (!adminDb || !adminStorage) {
      return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
    }

    // Get asset document from Firestore
    const assetDoc = await adminDb.collection('assets').doc(assetId).get();
    if (!assetDoc.exists) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
    }

    const assetData = assetDoc.data();
    const storagePath = assetData?.storagePath;

    if (!storagePath) {
      return NextResponse.json({ error: 'Asset has no storage path' }, { status: 400 });
    }

    // Get signed URL from Firebase Storage (valid for 1 hour)
    const bucket = adminStorage.bucket();
    const file = bucket.file(storagePath);
    
    const [signedUrl] = await file.getSignedUrl({
      action: 'read',
      expires: Date.now() + 60 * 60 * 1000, // 1 hour
    });

    return NextResponse.json({ downloadUrl: signedUrl });
  } catch (err: any) {
    console.error('Error generating download URL:', err);
    return NextResponse.json({ error: err?.message || 'Failed to generate download URL' }, { status: 500 });
  }
}

export const runtime = 'nodejs';

