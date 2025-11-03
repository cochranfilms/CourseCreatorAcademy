import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import { mux } from '@/lib/mux';

// POST /api/legacy/upload
// Body: { creatorId: string, title: string, description?: string, isSample?: boolean }
// Creates a MUX direct upload URL for legacy creators to upload videos
export async function POST(req: NextRequest) {
  try {
    const { creatorId, title, description, isSample } = await req.json();

    if (!creatorId || !title) {
      return NextResponse.json({ error: 'creatorId and title are required' }, { status: 400 });
    }
    if (!adminDb) {
      return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
    }

    // Verify creator exists and is a legacy creator
    const creatorDoc = await adminDb.collection('legacy_creators').doc(String(creatorId)).get();
    if (!creatorDoc.exists) {
      return NextResponse.json({ error: 'Creator not found or not a Legacy creator' }, { status: 404 });
    }

    // Create MUX direct upload
    const upload = await mux.video.uploads.create({
      new_asset_settings: {
        playback_policy: ['public'],
        passthrough: JSON.stringify({
          legacyCreatorId: String(creatorId),
          title: String(title),
          description: description || '',
          isSample: Boolean(isSample),
        }),
      },
    });

    // Store upload info in Firestore for tracking
    await adminDb.collection(`legacy_creators/${creatorId}/uploads`).add({
      uploadId: upload.id,
      uploadUrl: upload.url,
      title: String(title),
      description: description || '',
      isSample: Boolean(isSample),
      status: 'pending',
      createdAt: adminDb.FieldValue.serverTimestamp(),
    });

    return NextResponse.json({
      uploadId: upload.id,
      uploadUrl: upload.url,
    });
  } catch (err: any) {
    console.error('Legacy upload error:', err);
    return NextResponse.json({ error: err.message || 'Failed to create upload' }, { status: 500 });
  }
}

export const runtime = 'nodejs';

