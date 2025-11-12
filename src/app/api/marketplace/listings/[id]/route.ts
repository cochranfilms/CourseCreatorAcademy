import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebaseAdmin';
import { z } from 'zod';

const updateSchema = z.object({
  title: z.string().min(1).optional(),
  price: z.number().min(0).optional(),
  condition: z.string().min(1).optional(),
  description: z.string().optional(),
  shipping: z.number().min(0).optional(),
  location: z.string().optional(),
  images: z.array(z.string().url()).max(6).optional()
});

async function requireUser(req: NextRequest): Promise<string | null> {
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

export async function PUT(req: NextRequest, context: { params: { id: string } }) {
  try {
    if (!adminDb) return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
    const uid = await requireUser(req);
    if (!uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const id = String(context.params?.id || '');
    const ref = adminDb.collection('listings').doc(id);
    const snap = await ref.get();
    if (!snap.exists) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const data = snap.data() as any;
    if (String(data.creatorId) !== uid) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json();
    const parsed = updateSchema.safeParse({
      ...body,
      price: typeof body?.price === 'number' ? body.price : (body?.price ? Number(body?.price) : undefined),
      shipping: typeof body?.shipping === 'number' ? body.shipping : (body?.shipping ? Number(body?.shipping) : undefined),
    });
    if (!parsed.success) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    await ref.set({ ...parsed.data, updatedAt: new Date() }, { merge: true });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to update listing' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, context: { params: { id: string } }) {
  try {
    if (!adminDb) return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
    const uid = await requireUser(req);
    if (!uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const id = String(context.params?.id || '');
    const ref = adminDb.collection('listings').doc(id);
    const snap = await ref.get();
    if (!snap.exists) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const data = snap.data() as any;
    if (String(data.creatorId) !== uid) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    await ref.delete();
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to delete listing' }, { status: 500 });
  }
}

export const runtime = 'nodejs';

