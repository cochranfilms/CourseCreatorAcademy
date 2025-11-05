import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';

// POST /api/subscribe/monthly
// Creates the $37/month standard membership subscription on the platform account.
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
            unit_amount: 3700, // $37.00
            recurring: { interval: 'month' },
            product_data: {
              name: 'CCA Monthly Membership',
              description: 'Stream videos, access content, community + downloads',
            },
          },
          quantity: 1,
        },
      ],
      subscription_data: {
        metadata: {
          planType: 'cca_monthly_37',
          ...(buyerId ? { buyerId: String(buyerId) } : {}),
        },
      },
      ...(embedded
        ? { return_url: `${origin}/home?session_id={CHECKOUT_SESSION_ID}` }
        : {
            success_url: `${origin}/home`,
            cancel_url: `${origin}/checkout/canceled?plan=monthly37`,
          }),
      metadata: {
        planType: 'cca_monthly_37',
        ...(buyerId ? { buyerId: String(buyerId) } : {}),
      },
    });

    if (embedded) {
      return NextResponse.json({ clientSecret: (session as any).client_secret || null, id: session.id });
    }
    return NextResponse.json({ id: session.id, url: session.url });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to create monthly subscription' }, { status: 500 });
  }
}

export const runtime = 'nodejs';


