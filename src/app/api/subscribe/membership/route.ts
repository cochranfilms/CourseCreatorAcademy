import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';

// POST /api/subscribe/membership
// Creates the $87/month CCA Membership subscription on the platform account.
// Payouts to legacy creators are handled in the Stripe webhook (invoice.payment_succeeded).
export async function POST(req: NextRequest) {
  try {
    const origin = req.headers.get('origin') || process.env.NEXT_PUBLIC_BASE_URL || '';
    const { customerEmail, buyerId, embedded }: { customerEmail?: string; buyerId?: string; embedded?: boolean } = await req.json().catch(() => ({}));

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer_email: customerEmail,
      client_reference_id: buyerId,
      ...(embedded ? { ui_mode: 'embedded' as const } : {}),
      line_items: [
        {
          price_data: {
            currency: 'usd',
            unit_amount: 8700, // $87.00
            recurring: { interval: 'month' },
            product_data: {
              name: 'CCA Membership',
              description: 'All‑access membership paid monthly',
            },
          },
          quantity: 1,
        },
      ],
      subscription_data: {
        metadata: {
          planType: 'cca_membership_87',
          ...(buyerId ? { buyerId: String(buyerId) } : {}),
        },
      },
      ...(embedded
        ? { return_url: `${origin}/home?session_id={CHECKOUT_SESSION_ID}` }
        : {
            success_url: `${origin}/home`,
            cancel_url: `${origin}/checkout/canceled?plan=membership87`,
          }),
      metadata: {
        planType: 'cca_membership_87',
        ...(buyerId ? { buyerId: String(buyerId) } : {}),
      },
    });

    // Embedded checkout returns a client secret to mount on client
    if (embedded) {
      return NextResponse.json({ clientSecret: (session as any).client_secret || null, id: session.id });
    }
    return NextResponse.json({ id: session.id, url: session.url });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to create membership subscription' }, { status: 500 });
  }
}

export const runtime = 'nodejs';


