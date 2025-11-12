import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebaseAdmin';
import { z } from 'zod';

const schema = z.object({
  title: z.string().min(1),
  location: z.string().min(1),
  type: z.string().min(1),
  applyUrl: z.string().url(),
  description: z.string().optional()
});

async function getUid(req: NextRequest): Promise<string | null> {
  const auth = req.headers.get('authorization') || '';
  const token = auth.toLowerCase().startsWith('bearer ') ? auth.split(' ')[1] : '';
  if (!token || !adminAuth) return null;
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    return decoded.uid || null;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!adminDb) return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
    const uid = await getUid(req);
    if (!uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await req.json().catch(() => ({}));
    const parsed = schema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });

    // Ensure user is a legacy creator (check users doc or legacy_creators membership)
    let isLegacy = false;
    try {
      const u = await adminDb.collection('users').doc(String(uid)).get();
      const data = u.exists ? (u.data() as any) : null;
      isLegacy = Boolean(data?.isLegacyCreator || data?.roles?.legacyCreator);
    } catch {}
    if (!isLegacy) {
      // Fallback: existence under legacy_creators
      try {
        const lc = await adminDb.collection('legacy_creators').doc(String(uid)).get();
        isLegacy = lc.exists;
      } catch {}
    }
    if (!isLegacy) return NextResponse.json({ error: 'Only legacy creators can post opportunities' }, { status: 403 });

    // Write under subcollection
    const ref = await adminDb
      .collection(`legacy_creators/${uid}/opportunities`)
      .add({
        ...parsed.data,
        posted: new Date()
      });

    return NextResponse.json({ id: ref.id });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to create opportunity' }, { status: 500 });
  }
}

export const runtime = 'nodejs';

