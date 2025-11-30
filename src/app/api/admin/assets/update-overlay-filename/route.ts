import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';
import * as FirebaseFirestore from 'firebase-admin/firestore';

/**
 * Verify user is authorized (info@cochranfilms.com)
 */
async function verifyAuth(req: NextRequest): Promise<{ uid: string; email: string } | null> {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7);
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    if (decoded.email !== 'info@cochranfilms.com') {
      return null;
    }
    return { uid: decoded.uid, email: decoded.email };
  } catch {
    return null;
  }
}

// PUT /api/admin/assets/update-overlay-filename
// Updates the fileName field for an overlay/transition file
export async function PUT(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!adminDb) {
    return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
  }

  try {
    const body = await req.json();
    const { assetId, overlayId, fileName } = body;

    if (!assetId || !overlayId || !fileName) {
      return NextResponse.json(
        { error: 'Missing required fields: assetId, overlayId, fileName' },
        { status: 400 }
      );
    }

    if (typeof fileName !== 'string' || fileName.trim().length === 0) {
      return NextResponse.json(
        { error: 'fileName must be a non-empty string' },
        { status: 400 }
      );
    }

    // Update overlay document
    await adminDb
      .collection('assets')
      .doc(assetId)
      .collection('overlays')
      .doc(overlayId)
      .update({
        fileName: fileName.trim(),
        updatedAt: FirebaseFirestore.FieldValue.serverTimestamp(),
      });

    return NextResponse.json({
      success: true,
      fileName: fileName.trim(),
    });
  } catch (error: unknown) {
    console.error('Error updating overlay fileName:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to update overlay fileName';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

