import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { adminDb } from '@/lib/firebaseAdmin';
import { getUserIdFromAuthHeader } from '@/lib/api/auth';
import { FieldValue } from 'firebase-admin/firestore';

// POST /api/subscription/cancel
// Cancels the user's subscription (no refund)
export async function POST(req: NextRequest) {
  try {
    if (!adminDb) {
      return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
    }

    const userId = await getUserIdFromAuthHeader(req);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's current subscription
    const userDoc = await adminDb.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const userData = userDoc.data() as any;
    const subscriptionId = userData?.membershipSubscriptionId;

    if (!subscriptionId) {
      return NextResponse.json({ error: 'No active subscription found' }, { status: 400 });
    }

    // Get the subscription from Stripe
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    
    if (!subscription || subscription.status !== 'active') {
      return NextResponse.json({ error: 'Subscription is not active' }, { status: 400 });
    }

    // Cancel the subscription at period end (no immediate cancellation, no refund)
    await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: true,
    });

    // Update Firebase to reflect cancellation status
    try {
      await adminDb
        .collection('users')
        .doc(String(userId))
        .set(
          {
            subscriptionCancelAtPeriodEnd: true,
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
    } catch (firebaseErr: any) {
      console.error('Failed to update Firebase after cancellation:', firebaseErr);
      // Don't fail the whole operation if Firebase update fails
    }

    return NextResponse.json({
      success: true,
      message: 'Subscription will be canceled at the end of the billing period',
      cancelAtPeriodEnd: true,
    });
  } catch (err: any) {
    console.error('Error canceling subscription:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to cancel subscription' },
      { status: 500 }
    );
  }
}

export const runtime = 'nodejs';

