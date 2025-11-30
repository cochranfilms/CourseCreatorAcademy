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

// PUT /api/admin/assets/update-lut-filename
// Updates the fileName and lutName fields for a LUT preview
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
    const { assetId, previewId, fileName, lutName } = body;

    if (!assetId || !previewId) {
      return NextResponse.json(
        { error: 'Missing required fields: assetId, previewId' },
        { status: 400 }
      );
    }

    const updateData: any = {
      updatedAt: FirebaseFirestore.FieldValue.serverTimestamp(),
    };

    if (fileName !== undefined) {
      if (typeof fileName !== 'string' || fileName.trim().length === 0) {
        return NextResponse.json(
          { error: 'fileName must be a non-empty string' },
          { status: 400 }
        );
      }
      updateData.fileName = fileName.trim();
    }

    if (lutName !== undefined) {
      if (typeof lutName !== 'string' || lutName.trim().length === 0) {
        return NextResponse.json(
          { error: 'lutName must be a non-empty string' },
          { status: 400 }
        );
      }
      updateData.lutName = lutName.trim();
    }

    if (Object.keys(updateData).length === 1) {
      // Only updatedAt, nothing to update
      return NextResponse.json(
        { error: 'Must provide fileName or lutName to update' },
        { status: 400 }
      );
    }

    // Update LUT preview document
    await adminDb
      .collection('assets')
      .doc(assetId)
      .collection('lutPreviews')
      .doc(previewId)
      .update(updateData);

    return NextResponse.json({
      success: true,
      ...updateData,
    });
  } catch (error: unknown) {
    console.error('Error updating LUT fileName:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to update LUT fileName';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

