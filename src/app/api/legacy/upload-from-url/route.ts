import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import { mux } from '@/lib/mux';
import { z } from 'zod';
import { logInfo, logError } from '@/lib/log';
import { recordAudit } from '@/lib/audit';

// POST /api/legacy/upload-from-url
// Body: { creatorId: string, title: string, description?: string, isSample?: boolean, fileUrl: string }
// Ingests a browser-uploaded file (e.g., Firebase Storage download URL) into Mux, avoiding TUS CORS.
export async function POST(req: NextRequest) {
  try {
    const schema = z.object({
      creatorId: z.string().min(1),
      title: z.string().min(1),
      description: z.string().optional(),
      isSample: z.boolean().optional(),
      fileUrl: z.string().url(),
    });
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
    }
    const { creatorId, title, description, isSample, fileUrl } = parsed.data;
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

    // Resolve canonical legacy creator doc id so webhook writes to the expected path
    const targetId = (creatorDoc as any).id || String(creatorId);
    // Create asset from public URL (e.g., Firebase downloadURL)
    const asset = await mux.video.assets.create({
      input: fileUrl,
      // Samples remain public; all other assets use signed playback
      playback_policy: Boolean(isSample) ? ['public'] : ['signed'],
      passthrough: JSON.stringify({
        legacyCreatorId: String(targetId),
        title: String(title),
        description: description || '',
        isSample: Boolean(isSample),
      }),
    } as any);

    logInfo('legacy.uploadFromUrl.created', { creatorId: targetId, isSample: Boolean(isSample) });
    recordAudit('legacy_upload_from_url_created', { creatorId: targetId, assetId: asset.id, isSample: Boolean(isSample) }).catch(()=>{});
    return NextResponse.json({ assetId: asset.id });
  } catch (err: any) {
    logError('legacy.uploadFromUrl.error', { error: err?.message || String(err) });
    return NextResponse.json({ error: err?.message || 'Failed to create asset from URL' }, { status: 500 });
  }
}

export const runtime = 'nodejs';


