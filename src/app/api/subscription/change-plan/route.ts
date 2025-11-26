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

    // Use Stripe's API to calculate proration accurately
    // This gives us the exact amount Stripe will charge/credit
    const upcomingInvoice = await stripe.invoices.retrieveUpcoming({
      customer: subscription.customer as string,
      subscription: subscription.id,
      subscription_items: [{
        id: currentItem.id,
        price: newPrice.id,
      }],
      subscription_proration_behavior: 'always_invoice',
    });

    // Extract proration amounts from Stripe's invoice line items
    // This is the most accurate method as it uses Stripe's exact calculation
    let prorationAmount = 0;
    let creditAmount = 0;
    
    if (upcomingInvoice.lines?.data) {
      for (const line of upcomingInvoice.lines.data) {
        if (line.proration) {
          if (line.amount > 0) {
            // Positive proration = charge for upgrade
            prorationAmount += line.amount;
          } else if (line.amount < 0) {
            // Negative proration = credit for downgrade
            creditAmount += Math.abs(line.amount);
          }
        }
      }
    }

    // Fallback: if no proration line items found, use amount_due
    // For upgrades: amount_due is positive (charge)
    // For downgrades: amount_due can be negative (credit) or 0
    if (prorationAmount === 0 && creditAmount === 0) {
      if (isUpgrade && upcomingInvoice.amount_due > 0) {
        prorationAmount = upcomingInvoice.amount_due;
      } else if (!isUpgrade && upcomingInvoice.amount_due < 0) {
        creditAmount = Math.abs(upcomingInvoice.amount_due);
      }
    }

    // Calculate days remaining for display
    const now = Math.floor(Date.now() / 1000);
    const periodEnd = subscription.current_period_end;
    const daysRemaining = Math.ceil((periodEnd - now) / 86400);

    // Enhanced logging for debugging proration calculations
    const prorationLines = upcomingInvoice.lines?.data.filter(line => line.proration) || [];
    console.log('[Plan Change Preview] Stripe Proration Calculation', {
      currentPlanType,
      newPlanType,
      isUpgrade,
      prorationAmount: prorationAmount / 100, // Convert to dollars for readability
      creditAmount: creditAmount / 100, // Convert to dollars for readability
      invoiceAmountDue: upcomingInvoice.amount_due / 100,
      invoiceTotal: upcomingInvoice.total / 100,
      currentPlanPrice: (currentPlan?.price || 0) / 100,
      newPlanPrice: newPlan.price / 100,
      prorationLineItems: prorationLines.map(line => ({
        description: line.description,
        amount: line.amount / 100,
        proration: line.proration,
      })),
      periodStart: new Date(subscription.current_period_start * 1000).toISOString(),
      periodEnd: new Date(subscription.current_period_end * 1000).toISOString(),
      daysRemaining,
    });

    // If preview mode, just return the calculation
    if (preview) {
      const displayAmount = isUpgrade ? prorationAmount : creditAmount;
      return NextResponse.json({
        success: true,
        preview: true,
        prorationAmount: displayAmount,
        creditAmount: creditAmount,
        isUpgrade,
        message: isUpgrade 
          ? `You'll be charged $${(prorationAmount / 100).toFixed(2)} for the prorated upgrade.`
          : `You'll receive a credit of $${(creditAmount / 100).toFixed(2)} for the unused portion.`,
        daysRemaining,
      });
    }

    // Update the subscription with the new plan
    // Stripe will automatically prorate the difference
    // Note: newPrice was already created above for the preview calculation
    const updatedSubscription = await stripe.subscriptions.update(subscriptionId, {
      items: [{
        id: currentItem.id,
        price: newPrice.id,
      }],
      proration_behavior: 'always_invoice', // Always prorate when changing plans
      metadata: {
        planType: newPlanType,
        buyerId: userId,
      },
    });

    // The proration amounts were already calculated above using retrieveUpcoming
    // This is the exact amount Stripe will charge/credit
    const displayAmount = isUpgrade ? prorationAmount : creditAmount;

    return NextResponse.json({
      success: true,
      subscriptionId: updatedSubscription.id,
      newPlanType,
      prorationAmount: displayAmount,
      creditAmount: creditAmount,
      isUpgrade,
      message: isUpgrade 
        ? `Plan upgraded! You've been charged $${(prorationAmount / 100).toFixed(2)} for the prorated upgrade.`
        : `Plan downgraded! You'll receive a credit of $${(creditAmount / 100).toFixed(2)} for the unused portion.`,
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

