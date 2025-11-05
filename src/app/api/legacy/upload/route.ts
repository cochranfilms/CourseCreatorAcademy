import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import { mux } from '@/lib/mux';
import { FieldValue } from 'firebase-admin/firestore';

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

    // Verify creator exists and is a legacy creator. Accept either legacy doc ID or owner user ID.
    let creatorDoc = await adminDb.collection('legacy_creators').doc(String(creatorId)).get();
    if (!creatorDoc.exists) {
      const byOwner = await adminDb.collection('legacy_creators').where('ownerUserId', '==', String(creatorId)).limit(1).get();
      if (!byOwner.empty) creatorDoc = byOwner.docs[0] as any;
    }
    if (!creatorDoc.exists) {
      return NextResponse.json({ error: 'Creator not found or not a Legacy creator' }, { status: 404 });
    }

    // Resolve canonical legacy creator doc id to store under the correct path
    const targetIdPre = (creatorDoc as any).id || String(creatorId);

    // Create MUX direct upload. In development, allow any origin to avoid strict CORS issues
    // with the TUS preflight. In production, prefer an explicit origin.
    const isDev = process.env.NODE_ENV !== 'production';
    const corsOrigin = isDev
      ? '*'
      : (
      req.headers.get('origin') ||
      process.env.NEXT_PUBLIC_SITE_URL ||
      process.env.SITE_URL ||
          'https://coursecreatoracademy.vercel.app'
        );
    const upload = await mux.video.uploads.create({
      cors_origin: corsOrigin,
      new_asset_settings: {
        playback_policy: ['public'],
        passthrough: JSON.stringify({
          legacyCreatorId: String(targetIdPre),
          title: String(title),
          description: description || '',
          isSample: Boolean(isSample),
        }),
      },
    });

    // Store upload info in Firestore for tracking
    const targetId = targetIdPre;
    await adminDb.collection(`legacy_creators/${targetId}/uploads`).add({
      uploadId: upload.id,
      uploadUrl: upload.url,
      title: String(title),
      description: description || '',
      isSample: Boolean(isSample),
      status: 'pending',
      createdAt: FieldValue.serverTimestamp(),
    });

    // Return proxy endpoint in production to avoid Mux CORS issues
    const baseUrl = req.headers.get('origin') || process.env.NEXT_PUBLIC_BASE_URL || process.env.SITE_URL || '';
    const uploadUrl = baseUrl
      ? `${baseUrl.replace(/\/$/, '')}/api/mux/tus-proxy?u=${encodeURIComponent(upload.url)}`
      : upload.url;

    return NextResponse.json({ uploadId: upload.id, uploadUrl });
  } catch (err: any) {
    console.error('Legacy upload error:', err);
    return NextResponse.json({ error: err.message || 'Failed to create upload' }, { status: 500 });
  }
}

export const runtime = 'nodejs';

