import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { adminDb } from '@/lib/firebaseAdmin';
import { getUserIdFromAuthHeader } from '@/lib/api/auth';

// Plan configuration
const PLAN_CONFIG = {
  cca_monthly_37: {
    name: 'Monthly Membership',
    price: 3700, // $37.00 in cents
    priceId: null, // We'll use price_data, but could store Stripe Price IDs here
  },
  cca_no_fees_60: {
    name: 'No-Fees Membership',
    price: 6000, // $60.00 in cents
    priceId: null,
  },
  cca_membership_87: {
    name: 'All-Access Membership',
    price: 8700, // $87.00 in cents
    priceId: null,
  },
};

// POST /api/subscription/change-plan
// Body: { newPlanType: 'cca_monthly_37' | 'cca_no_fees_60' | 'cca_membership_87' }
// Updates the user's subscription to a new plan with proration
export async function POST(req: NextRequest) {
  try {
    if (!adminDb) {
      return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
    }

    const userId = await getUserIdFromAuthHeader(req);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { newPlanType, preview } = await req.json();
    if (!newPlanType || !PLAN_CONFIG[newPlanType as keyof typeof PLAN_CONFIG]) {
      return NextResponse.json({ error: 'Invalid plan type' }, { status: 400 });
    }

    // Get user's current subscription
    const userDoc = await adminDb.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const userData = userDoc.data() as any;
    const currentPlanType = userData?.membershipPlan;
    const subscriptionId = userData?.membershipSubscriptionId;

    if (!subscriptionId) {
      return NextResponse.json({ error: 'No active subscription found' }, { status: 400 });
    }

    if (currentPlanType === newPlanType) {
      return NextResponse.json({ error: 'Already on this plan' }, { status: 400 });
    }

    // Get the subscription from Stripe
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    
    if (!subscription || subscription.status !== 'active') {
      return NextResponse.json({ error: 'Subscription is not active' }, { status: 400 });
    }

    // Get the current price item (first item in the subscription)
    const currentItem = subscription.items.data[0];
    if (!currentItem) {
      return NextResponse.json({ error: 'Subscription has no items' }, { status: 400 });
    }

    const newPlan = PLAN_CONFIG[newPlanType as keyof typeof PLAN_CONFIG];
    const currentPlan = PLAN_CONFIG[currentPlanType as keyof typeof PLAN_CONFIG];
    const isUpgrade = newPlan.price > (currentPlan?.price || 0);

    // Calculate proration preview
    // Calculate days remaining in current period
    const now = Math.floor(Date.now() / 1000);
    const periodEnd = subscription.current_period_end;
    const periodStart = subscription.current_period_start;
    const daysInPeriod = periodEnd - periodStart;
    const daysRemaining = periodEnd - now;
    const daysUsed = daysInPeriod - daysRemaining;

    // Calculate prorated amounts
    const currentMonthlyPrice = currentPlan?.price || 0;
    const newMonthlyPrice = newPlan.price;
    
    // Prorate based on days remaining
    const dailyRateCurrent = currentMonthlyPrice / daysInPeriod;
    const dailyRateNew = newMonthlyPrice / daysInPeriod;
    const unusedAmount = dailyRateCurrent * daysRemaining;
    const proratedNewAmount = dailyRateNew * daysRemaining;
    const prorationAmount = Math.abs(proratedNewAmount - unusedAmount);

    // If preview mode, just return the calculation
    if (preview) {
      return NextResponse.json({
        success: true,
        preview: true,
        prorationAmount: Math.round(prorationAmount),
        isUpgrade,
        message: isUpgrade 
          ? `You'll be charged approximately $${(Math.round(prorationAmount) / 100).toFixed(2)} for the prorated upgrade.`
          : `You'll receive approximately $${(Math.round(prorationAmount) / 100).toFixed(2)} credit for the unused portion.`,
        daysRemaining: Math.ceil(daysRemaining / 86400), // Convert to days
      });
    }

    // Update the subscription with the new plan
    // Stripe will automatically prorate the difference
    const updatedSubscription = await stripe.subscriptions.update(subscriptionId, {
      items: [{
        id: currentItem.id,
        price_data: {
          currency: 'usd',
          unit_amount: newPlan.price,
          recurring: { interval: 'month' },
          product_data: {
            name: newPlan.name,
            description: newPlan.name === 'All-Access Membership' 
              ? 'All-access membership with Legacy Creator access and no platform fees'
              : newPlan.name === 'No-Fees Membership'
              ? 'Skip all platform fees on marketplace sales and job listings'
              : 'Platform access to courses, community, and marketplace',
          },
        },
      }],
      proration_behavior: 'always_invoice', // Always prorate when changing plans
      metadata: {
        planType: newPlanType,
        buyerId: userId,
      },
    });

    // Get the actual proration from Stripe's upcoming invoice
    const upcomingInvoice = await stripe.invoices.retrieveUpcoming({
      customer: subscription.customer as string,
      subscription: subscriptionId,
    });

    const actualProrationAmount = upcomingInvoice.amount_due - (upcomingInvoice.subtotal || 0);

    return NextResponse.json({
      success: true,
      subscriptionId: updatedSubscription.id,
      newPlanType,
      prorationAmount: Math.abs(actualProrationAmount),
      isUpgrade,
      message: isUpgrade 
        ? `Plan upgraded! You've been charged $${(Math.abs(actualProrationAmount) / 100).toFixed(2)} for the prorated upgrade.`
        : `Plan downgraded! You'll receive a $${(Math.abs(actualProrationAmount) / 100).toFixed(2)} credit for the unused portion.`,
    });
  } catch (err: any) {
    console.error('Error changing plan:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to change plan' },
      { status: 500 }
    );
  }
}

export const runtime = 'nodejs';

