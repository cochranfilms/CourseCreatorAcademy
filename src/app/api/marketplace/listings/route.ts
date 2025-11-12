import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebaseAdmin';
import { z } from 'zod';

const createSchema = z.object({
  title: z.string().min(1),
  price: z.number().min(0),
  condition: z.string().min(1),
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

export async function POST(req: NextRequest) {
  try {
    if (!adminDb) return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
    const uid = await requireUser(req);
    if (!uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await req.json();
    const parsed = createSchema.safeParse({
      ...body,
      price: typeof body?.price === 'number' ? body.price : Number(body?.price || 0),
      shipping: typeof body?.shipping === 'number' ? body.shipping : Number(body?.shipping || 0),
    });
    if (!parsed.success) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    const data = parsed.data;
    const docRef = await adminDb.collection('listings').add({
      ...data,
      creatorId: uid,
      createdAt: new Date()
    });
    return NextResponse.json({ id: docRef.id });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to create listing' }, { status: 500 });
  }
}

export const runtime = 'nodejs';

