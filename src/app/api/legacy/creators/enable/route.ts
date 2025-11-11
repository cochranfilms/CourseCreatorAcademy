import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebaseAdmin';
import { recordAudit } from '@/lib/audit';

// POST /api/legacy/creators/enable
// Authorization: Bearer <Firebase ID token>
// Body: { }
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

    // Load user
    const userDoc = await adminDb.collection('users').doc(uid).get();
    const user = userDoc.exists ? (userDoc.data() as any) : {};
    const connectAccountId = user?.connectAccountId || null;
    if (!connectAccountId) {
      return NextResponse.json({ error: 'Stripe Connect account not linked' }, { status: 400 });
    }

    // Verify charges are enabled
    let chargesEnabled = false;
    try {
      const origin = req.headers.get('origin') || process.env.NEXT_PUBLIC_BASE_URL || process.env.SITE_URL || '';
      const url = `${String(origin).replace(/\/$/,'')}/api/stripe/connect/status?accountId=${encodeURIComponent(String(connectAccountId))}`;
      const res = await fetch(url, { cache: 'no-store' });
      const json = await res.json();
      chargesEnabled = Boolean(json?.charges_enabled);
    } catch {}
    if (!chargesEnabled) {
      return NextResponse.json({ error: 'Stripe Connect charges not enabled' }, { status: 400 });
    }

    // Create or update legacy_creators mapping
    // Prefer an existing doc with ownerUserId == uid, else use doc(uid)
    let targetRef = adminDb.collection('legacy_creators').doc(uid);
    try {
      const byOwner = await adminDb.collection('legacy_creators').where('ownerUserId', '==', uid).limit(1).get();
      if (!byOwner.empty) targetRef = byOwner.docs[0].ref;
    } catch {}

    const displayName = user?.displayName || user?.handle || 'Creator';
    const kitSlug = user?.kitSlug || uid;

    await targetRef.set({
      ownerUserId: uid,
      displayName,
      kitSlug,
      connectAccountId,
      updatedAt: new Date(),
      createdAt: new Date(),
    }, { merge: true });

    recordAudit('legacy_creator_enabled', { userId: uid, creatorId: targetRef.id }).catch(()=>{});
    return NextResponse.json({ ok: true, creatorId: targetRef.id });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to enable legacy creator' }, { status: 500 });
  }
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';


