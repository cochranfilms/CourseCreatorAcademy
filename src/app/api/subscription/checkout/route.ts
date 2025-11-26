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

    // Calculate proration amount
    // For upgrades: amount_due will be positive (what they owe)
    // For downgrades: amount_due will be negative (credit to be applied)
    let prorationAmount = 0;
    let creditAmount = 0;
    
    if (isUpgrade) {
      // For upgrades, use the total amount due (includes proration charge)
      prorationAmount = Math.max(0, upcomingInvoice.amount_due || 0);
      
      // If amount_due is 0, calculate manually from line items
      if (prorationAmount === 0 && upcomingInvoice.lines?.data) {
        for (const line of upcomingInvoice.lines.data) {
          if (line.proration && line.amount > 0) {
            prorationAmount += line.amount;
          }
        }
      }
      
      // If still 0, calculate based on price difference
      if (prorationAmount === 0) {
        const daysInPeriod = subscription.current_period_end - subscription.current_period_start;
        const daysRemaining = subscription.current_period_end - Math.floor(Date.now() / 1000);
        const dailyRateCurrent = (currentPlan?.price || 0) / daysInPeriod;
        const dailyRateNew = newPlan.price / daysInPeriod;
        const unusedAmount = dailyRateCurrent * daysRemaining;
        const proratedNewAmount = dailyRateNew * daysRemaining;
        prorationAmount = Math.max(0, Math.round(proratedNewAmount - unusedAmount));
      }
    } else {
      // For downgrades, calculate the credit amount
      // Credit = unused portion of current plan - prorated cost of new plan
      const daysInPeriod = subscription.current_period_end - subscription.current_period_start;
      const daysRemaining = subscription.current_period_end - Math.floor(Date.now() / 1000);
      const dailyRateCurrent = (currentPlan?.price || 0) / daysInPeriod;
      const dailyRateNew = newPlan.price / daysInPeriod;
      const unusedAmount = dailyRateCurrent * daysRemaining;
      const proratedNewAmount = dailyRateNew * daysRemaining;
      creditAmount = Math.max(0, Math.round(unusedAmount - proratedNewAmount));
      
      // Also check Stripe's invoice for credit amount
      if (upcomingInvoice.amount_due < 0) {
        // Negative amount_due means credit
        creditAmount = Math.max(creditAmount, Math.abs(upcomingInvoice.amount_due));
      }
      
      // Check invoice line items for proration credits
      if (upcomingInvoice.lines?.data) {
        for (const line of upcomingInvoice.lines.data) {
          if (line.proration && line.amount < 0) {
            // Negative amount means credit
            creditAmount = Math.max(creditAmount, Math.abs(line.amount));
          }
        }
      }
      
      prorationAmount = 0; // No charge for downgrades
    }

    console.log('[Plan Change]', {
      currentPlanType,
      newPlanType,
      isUpgrade,
      prorationAmount,
      creditAmount: isUpgrade ? 0 : creditAmount,
      invoiceAmountDue: upcomingInvoice.amount_due,
      invoiceTotal: upcomingInvoice.total,
      currentPlanPrice: currentPlan?.price,
      newPlanPrice: newPlan.price,
    });

    const origin = req.headers.get('origin') || process.env.NEXT_PUBLIC_BASE_URL || '';

    // For downgrades (credit), update subscription immediately
    // For upgrades (charge), create checkout session for prorated amount
    // Always require payment for upgrades, even if proration is small
    if (!isUpgrade) {
      // Downgrade - update subscription immediately
      // Stripe will automatically create a credit invoice with proration_behavior: 'always_invoice'
      const updatedSubscription = await stripe.subscriptions.update(subscriptionId, {
        items: [{
          id: currentItem.id,
          price: newPrice.id,
        }],
        proration_behavior: 'always_invoice', // Creates credit invoice immediately
        metadata: {
          planType: newPlanType,
          buyerId: userId,
        },
      });

      // Verify the credit was created by checking the latest invoice
      let actualCreditAmount = creditAmount;
      try {
        const invoices = await stripe.invoices.list({
          customer: subscription.customer as string,
          subscription: subscriptionId,
          limit: 1,
        });
        
        if (invoices.data.length > 0) {
          const latestInvoice = invoices.data[0];
          // If invoice has negative amount_due, that's the credit
          if (latestInvoice.amount_due < 0) {
            actualCreditAmount = Math.abs(latestInvoice.amount_due);
          } else if (latestInvoice.amount_paid < 0) {
            // Or check amount_paid for credits
            actualCreditAmount = Math.abs(latestInvoice.amount_paid);
          }
        }
      } catch (err) {
        console.error('Error checking invoice for credit:', err);
        // Use calculated credit amount as fallback
      }

      return NextResponse.json({
        success: true,
        requiresPayment: false,
        creditAmount: actualCreditAmount,
        message: actualCreditAmount > 0
          ? `Plan downgraded successfully! A credit of $${(actualCreditAmount / 100).toFixed(2)} has been applied to your account and will be used for future charges.`
          : 'Plan downgraded successfully! Your subscription has been updated.',
      });
    }

    // Upgrade requires payment - create checkout session
    // Ensure minimum charge amount (Stripe requires at least $0.50)
    const chargeAmount = Math.max(prorationAmount, 50); // Minimum $0.50
    
    const session = await stripe.checkout.sessions.create({
      mode: 'payment', // One-time payment for proration
      customer: subscription.customer as string,
      client_reference_id: userId,
      line_items: [
        {
          price_data: {
            currency: 'usd',
            unit_amount: chargeAmount,
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
        prorationAmount: String(chargeAmount),
      },
    });

    return NextResponse.json({
      success: true,
      requiresPayment: true,
      checkoutSessionId: session.id,
      checkoutUrl: session.url,
      prorationAmount,
      message: `Please complete payment of $${(chargeAmount / 100).toFixed(2)} to upgrade your plan.`,
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

