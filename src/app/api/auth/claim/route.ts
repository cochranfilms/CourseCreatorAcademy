import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';

// GET /api/auth/claim?session_id=cs_test_...
// Exchanges a Stripe Checkout Session for a Firebase custom token to sign the user in post‑checkout.
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get('session_id');
    if (!sessionId) return NextResponse.json({ error: 'Missing session_id' }, { status: 400 });

    const session = await stripe.checkout.sessions.retrieve(String(sessionId));
    if (!session) return NextResponse.json({ error: 'Invalid session' }, { status: 404 });

    // Only allow for paid/complete subscription sessions
    const isSub = session.mode === 'subscription' || Boolean(session.subscription);
    const paid = session.payment_status === 'paid' || session.status === 'complete';
    if (!isSub || !paid) return NextResponse.json({ error: 'Session not paid' }, { status: 400 });

    const email = (session.customer_details && (session.customer_details as any).email) || (session as any).customer_email || null;
    if (!email) return NextResponse.json({ error: 'No email on session' }, { status: 400 });

    if (!adminAuth) return NextResponse.json({ error: 'Server not configured' }, { status: 500 });

    // Ensure a Firebase user exists for this email
    let uid: string;
    try {
      const userRecord = await adminAuth.getUserByEmail(String(email));
      uid = userRecord.uid;
    } catch {
      const created = await adminAuth.createUser({ email: String(email) });
      uid = created.uid;
    }

    // Optional: mark membership active immediately (webhook also handles this)
    try {
      const planType = (session.metadata && (session.metadata as any).planType) || null;
      if (adminDb && planType) {
        await adminDb.collection('users').doc(uid).set({
          email: String(email),
          membershipActive: true,
          membershipPlan: planType,
          membershipSubscriptionId: String(session.subscription || ''),
          updatedAt: new Date()
        }, { merge: true });
      }
    } catch {}

    // Mint a custom token for client sign-in
    const customToken = await adminAuth.createCustomToken(uid, { from: 'checkout' });
    return NextResponse.json({ token: customToken, uid });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to claim session' }, { status: 500 });
  }
}

export const runtime = 'nodejs';


