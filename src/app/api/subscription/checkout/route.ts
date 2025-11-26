import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { adminDb } from '@/lib/firebaseAdmin';
import { getUserIdFromAuthHeader } from '@/lib/api/auth';

// Plan configuration
const PLAN_CONFIG = {
  cca_monthly_37: {
    name: 'Monthly Membership',
    price: 3700, // $37.00 in cents
  },
  cca_no_fees_60: {
    name: 'No-Fees Membership',
    price: 6000, // $60.00 in cents
  },
  cca_membership_87: {
    name: 'All-Access Membership',
    price: 8700, // $87.00 in cents
  },
};

// POST /api/subscription/checkout
// Creates a Stripe Checkout session for plan changes with prorated amounts
export async function POST(req: NextRequest) {
  try {
    if (!adminDb) {
      return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
    }

    const userId = await getUserIdFromAuthHeader(req);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { newPlanType } = await req.json();
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
    const customerEmail = userData?.email;

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

    const newPlan = PLAN_CONFIG[newPlanType as keyof typeof PLAN_CONFIG];
    const currentPlan = PLAN_CONFIG[currentPlanType as keyof typeof PLAN_CONFIG];
    const isUpgrade = newPlan.price > (currentPlan?.price || 0);

    // Calculate proration using Stripe's upcoming invoice
    const currentItem = subscription.items.data[0];
    if (!currentItem) {
      return NextResponse.json({ error: 'Subscription has no items' }, { status: 400 });
    }

    // Create or find a product for CCA memberships
    let product;
    const products = await stripe.products.list({ limit: 100 });
    product = products.data.find((p) => p.name === 'CCA Membership' || p.name?.includes('CCA'));
    
    if (!product) {
      product = await stripe.products.create({
        name: 'CCA Membership',
        description: 'Course Creator Academy membership plans',
      });
    }

    // Create a new price for the new plan
    const newPrice = await stripe.prices.create({
      currency: 'usd',
      unit_amount: newPlan.price,
      recurring: { interval: 'month' },
      product: product.id,
      metadata: {
        planType: newPlanType,
      },
    });

    // Calculate proration by getting upcoming invoice
    const upcomingInvoice = await stripe.invoices.retrieveUpcoming({
      customer: subscription.customer as string,
      subscription: subscription.id,
      subscription_items: [{
        id: currentItem.id,
        price: newPrice.id,
      }],
      subscription_proration_behavior: 'always_invoice',
    });

    const prorationAmount = Math.abs(upcomingInvoice.amount_due || 0);

    const origin = req.headers.get('origin') || process.env.NEXT_PUBLIC_BASE_URL || '';

    // For downgrades (credit), update subscription immediately
    // For upgrades (charge), create checkout session for prorated amount
    if (!isUpgrade || prorationAmount === 0) {
      // Downgrade or no charge - update subscription immediately
      await stripe.subscriptions.update(subscriptionId, {
        items: [{
          id: currentItem.id,
          price: newPrice.id,
        }],
        proration_behavior: 'always_invoice',
        metadata: {
          planType: newPlanType,
          buyerId: userId,
        },
      });

      return NextResponse.json({
        success: true,
        requiresPayment: false,
        message: 'Plan downgraded successfully. Credit has been applied to your account.',
      });
    }

    // Upgrade requires payment - create checkout session
    const session = await stripe.checkout.sessions.create({
      mode: 'payment', // One-time payment for proration
      customer: subscription.customer as string,
      client_reference_id: userId,
      line_items: [
        {
          price_data: {
            currency: 'usd',
            unit_amount: prorationAmount,
            product_data: {
              name: `Prorated Upgrade to ${newPlan.name}`,
              description: `Prorated amount for upgrading from ${currentPlan?.name || 'current plan'} to ${newPlan.name}`,
            },
          },
          quantity: 1,
        },
      ],
      payment_intent_data: {
        metadata: {
          action: 'upgrade_plan',
          subscriptionId,
          currentPlanType,
          newPlanType,
          buyerId: userId,
        },
      },
      success_url: `${origin}/dashboard?plan_change=success&new_plan=${newPlanType}`,
      cancel_url: `${origin}/dashboard?plan_change=canceled`,
      metadata: {
        action: 'upgrade_plan',
        subscriptionId,
        currentPlanType,
        newPlanType,
        buyerId: userId,
        prorationAmount: String(prorationAmount),
      },
    });

    return NextResponse.json({
      success: true,
      requiresPayment: true,
      checkoutSessionId: session.id,
      checkoutUrl: session.url,
      prorationAmount,
      message: `Please complete payment of $${(prorationAmount / 100).toFixed(2)} to upgrade your plan.`,
    });
  } catch (err: any) {
    console.error('Error creating checkout session for plan change:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}

export const runtime = 'nodejs';

