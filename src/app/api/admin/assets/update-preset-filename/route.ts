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

// PUT /api/admin/assets/update-preset-filename
// Updates the fileName field for a preset
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
    const { assetId, presetId, fileName } = body;

    if (!assetId || !presetId || !fileName) {
      return NextResponse.json(
        { error: 'Missing required fields: assetId, presetId, fileName' },
        { status: 400 }
      );
    }

    if (typeof fileName !== 'string' || fileName.trim().length === 0) {
      return NextResponse.json(
        { error: 'fileName must be a non-empty string' },
        { status: 400 }
      );
    }

    // Update preset document
    await adminDb
      .collection('assets')
      .doc(assetId)
      .collection('presets')
      .doc(presetId)
      .update({
        fileName: fileName.trim(),
        updatedAt: FirebaseFirestore.FieldValue.serverTimestamp(),
      });

    return NextResponse.json({
      success: true,
      fileName: fileName.trim(),
    });
  } catch (error: unknown) {
    console.error('Error updating preset fileName:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to update preset fileName';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

