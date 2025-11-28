import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminStorage } from '@/lib/firebaseAdmin';
import { getUserIdFromAuthHeader } from '@/lib/api/auth';
import { hasGlobalMembership } from '@/lib/entitlements';

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

    // Verify user is authenticated and has membership (including legacy creators)
    const uid = await getUserIdFromAuthHeader(req);
    if (!uid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check membership (includes legacy creators)
    const hasMembership = await hasGlobalMembership(uid);
    if (!hasMembership) {
      return NextResponse.json({ error: 'Membership required' }, { status: 403 });
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
    // Use explicit bucket name - Firebase supports both .appspot.com and .firebasestorage.app
    // Both refer to the same bucket, but we'll use .firebasestorage.app (newer format)
    const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID || 'course-creator-academy-866d6';
    const bucketName = `${projectId}.firebasestorage.app`;
    const bucket = adminStorage.bucket(bucketName);
    const file = bucket.file(storagePath);
    
    // Check if file exists
    const [exists] = await file.exists();
    if (!exists) {
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
      throw signError;
    }
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to generate download URL' }, { status: 500 });
  }
}

export const runtime = 'nodejs';

