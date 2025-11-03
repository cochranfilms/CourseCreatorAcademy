import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebaseAdmin';

// POST /api/legacy/creators/save
// Authorization: Bearer <Firebase ID token>
// Body: { displayName?, handle?, bio?, kitSlug?, avatarUrl?, bannerUrl? }
export async function POST(req: NextRequest) {
  try {
    if (!adminDb || !adminAuth) {
      return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
    }

    const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
    if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) {
      return NextResponse.json({ error: 'Missing Authorization header' }, { status: 401 });
    }
    const idToken = authHeader.split(' ')[1];
    const decoded = await adminAuth.verifyIdToken(idToken);
    const uid = decoded.uid;

    const body = await req.json();
    const allowedKeys = [
      'displayName','handle','bio','kitSlug','avatarUrl','bannerUrl',
      // enhanced public page content
      'featured', // { playbackId, title, description, durationSec }
      'assets',   // { overlays: [{title, tag, image}], sfx: [{title, tag, image}] }
      'gear'      // [{ name, category, image, url }]
    ];
    const updates: Record<string, any> = {};
    for (const k of allowedKeys) {
      if (body[k] !== undefined) updates[k] = body[k];
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    // Find the creator document this user owns: prefer ownerUserId mapping; fallback to doc(uid)
    let targetDocRef = adminDb.collection('legacy_creators').doc(uid);
    try {
      const byOwner = await adminDb
        .collection('legacy_creators')
        .where('ownerUserId', '==', uid)
        .limit(1)
        .get();
      if (!byOwner.empty) {
        targetDocRef = byOwner.docs[0].ref;
      } else {
        const byId = await adminDb.collection('legacy_creators').doc(uid).get();
        if (byId.exists) targetDocRef = byId.ref;
      }
    } catch {}

    // Ensure kitSlug exists
    if (!updates.kitSlug) {
      const snap = await targetDocRef.get();
      const existing = snap.exists ? (snap.data() as any) : {};
      updates.kitSlug = existing.kitSlug || uid;
    }

    // Always stamp ownerUserId for linkage
    updates.ownerUserId = uid;
    await targetDocRef.set({ ...updates, updatedAt: new Date() }, { merge: true });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to save' }, { status: 500 });
  }
}

export const runtime = 'nodejs';


