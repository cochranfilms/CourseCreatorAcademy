import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import { mux } from '@/lib/mux';

// POST /api/legacy/upload-from-url
// Body: { creatorId: string, title: string, description?: string, isSample?: boolean, fileUrl: string }
// Ingests a browser-uploaded file (e.g., Firebase Storage download URL) into Mux, avoiding TUS CORS.
export async function POST(req: NextRequest) {
  try {
    const { creatorId, title, description, isSample, fileUrl } = await req.json();
    if (!creatorId || !title || !fileUrl) {
      return NextResponse.json({ error: 'creatorId, title, and fileUrl are required' }, { status: 400 });
    }
    if (!adminDb) {
      return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
    }

    // Verify creator exists (accept legacy doc id or owner uid)
    let creatorDoc = await adminDb.collection('legacy_creators').doc(String(creatorId)).get();
    if (!creatorDoc.exists) {
      const byOwner = await adminDb.collection('legacy_creators').where('ownerUserId', '==', String(creatorId)).limit(1).get();
      if (!byOwner.empty) creatorDoc = byOwner.docs[0] as any;
    }
    if (!creatorDoc.exists) {
      return NextResponse.json({ error: 'Creator not found or not a Legacy creator' }, { status: 404 });
    }

    // Create asset from public URL (e.g., Firebase downloadURL)
    const asset = await mux.video.assets.create({
      input: fileUrl,
      playback_policy: ['public'],
      passthrough: JSON.stringify({
        legacyCreatorId: String(creatorId),
        title: String(title),
        description: description || '',
        isSample: Boolean(isSample),
      }),
    } as any);

    return NextResponse.json({ assetId: asset.id });
  } catch (err: any) {
    console.error('Legacy upload-from-url error:', err);
    return NextResponse.json({ error: err?.message || 'Failed to create asset from URL' }, { status: 500 });
  }
}

export const runtime = 'nodejs';


