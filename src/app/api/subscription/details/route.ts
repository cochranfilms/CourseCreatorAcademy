import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { adminDb } from '@/lib/firebaseAdmin';
import { getUserIdFromAuthHeader } from '@/lib/api/auth';

// GET /api/subscription/details
// Returns the user's current subscription details including plan info and next billing date
export async function GET(req: NextRequest) {
  try {
    if (!adminDb) {
      return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
    }

    const userId = await getUserIdFromAuthHeader(req);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's subscription info
    const userDoc = await adminDb.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const userData = userDoc.data() as any;
    const membershipActive = userData?.membershipActive || false;
    const planType = userData?.membershipPlan || null;
    const subscriptionId = userData?.membershipSubscriptionId || null;

    if (!membershipActive || !planType || !subscriptionId) {
      return NextResponse.json({
        hasSubscription: false,
        membershipActive: false,
      });
    }

    // Get subscription details from Stripe
    let subscription;
    let nextBillingDate = null;
    let currentPeriodEnd = null;
    let cancelAtPeriodEnd = false;

    try {
      subscription = await stripe.subscriptions.retrieve(subscriptionId);
      if (subscription) {
        nextBillingDate = subscription.current_period_end 
          ? new Date(subscription.current_period_end * 1000).toISOString()
          : null;
        currentPeriodEnd = subscription.current_period_end || null;
        cancelAtPeriodEnd = subscription.cancel_at_period_end || false;
      }
    } catch (err: any) {
      console.error('Error fetching subscription from Stripe:', err);
      // Continue with basic info if Stripe fetch fails
    }

    return NextResponse.json({
      hasSubscription: true,
      membershipActive,
      planType,
      subscriptionId,
      nextBillingDate,
      currentPeriodEnd,
      cancelAtPeriodEnd,
      status: subscription?.status || 'unknown',
    });
  } catch (err: any) {
    console.error('Error fetching subscription details:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to fetch subscription details' },
      { status: 500 }
    );
  }
}

export const runtime = 'nodejs';

