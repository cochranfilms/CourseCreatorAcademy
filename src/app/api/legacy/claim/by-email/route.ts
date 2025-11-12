import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebaseAdmin';
import { stripe } from '@/lib/stripe';
import { FieldValue } from 'firebase-admin/firestore';

async function getUid(req: NextRequest): Promise<{ uid: string; email: string | null } | null> {
  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.toLowerCase().startsWith('bearer ') ? authHeader.split(' ')[1] : '';
  if (!token || !adminAuth) return null;
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    return { uid: decoded.uid, email: decoded.email || null };
  } catch {
    return null;
  }
}

// POST /api/legacy/claim/by-email
// Body: { email?: string } - defaults to the authenticated user's email
// Behavior:
//  - Finds Stripe customers with the given email
//  - Lists subscriptions; for each Legacy+ subscription (metadata.legacyCreatorId) in active/trialing
//    updates legacySubscriptions doc (matched by subscriptionId) to the current uid
//  - For CCA membership plans, sets users/{uid}.membershipActive = true
export async function POST(req: NextRequest) {
  try {
    if (!adminDb) return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
    const auth = await getUid(req);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { uid, email: authEmail } = auth;
    const payload = await req.json().catch(() => ({}));
    const email = String(payload?.email || authEmail || '').trim().toLowerCase();
    if (!email) return NextResponse.json({ error: 'Email not available' }, { status: 400 });

    // Find customers by email
    const customers = await stripe.customers.list({ email, limit: 100 });
    const customerIds = customers.data.map((c) => c.id).filter(Boolean);
    if (customerIds.length === 0) {
      return NextResponse.json({ ok: true, updatedLegacySubs: 0, membershipActivated: false });
    }

    let updatedLegacySubs = 0;
    let membershipActivated = false;

    // For each customer, list subscriptions and process
    for (const customerId of customerIds) {
      const subs = await stripe.subscriptions.list({ customer: customerId, limit: 100 });
      for (const s of subs.data) {
        const status = String(s.status || '');
        if (!['active', 'trialing'].includes(status)) continue;
        const md: any = s.metadata || {};
        const legacyCreatorId = md.legacyCreatorId || null;
        const planType = md.planType || null;

        if (legacyCreatorId && s.id) {
          // Reassign legacySubscriptions doc by subscriptionId
          const snap = await adminDb.collection('legacySubscriptions').where('subscriptionId', '==', String(s.id)).limit(1).get();
          if (!snap.empty) {
            const ref = snap.docs[0].ref;
            await ref.set(
              {
                userId: String(uid),
                updatedAt: FieldValue.serverTimestamp(),
              },
              { merge: true }
            );
            updatedLegacySubs += 1;
          }
        }

        if (planType === 'cca_membership_87' || planType === 'cca_monthly_37') {
          await adminDb.collection('users').doc(uid).set(
            {
              membershipActive: true,
              membershipPlan: planType,
              membershipSubscriptionId: String(s.id),
              updatedAt: FieldValue.serverTimestamp(),
            },
            { merge: true }
          );
          membershipActivated = true;
        }
      }
    }

    return NextResponse.json({ ok: true, updatedLegacySubs, membershipActivated });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to claim subscriptions' }, { status: 500 });
  }
}

export const runtime = 'nodejs';


