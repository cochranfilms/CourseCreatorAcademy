import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';

export async function POST(req: NextRequest) {
  try {
    const origin = req.headers.get('origin') || process.env.NEXT_PUBLIC_BASE_URL || '';
    const priceId = process.env.STRIPE_PRICE_COURSE;
    if (!priceId) {
      return NextResponse.json({ error: 'Missing STRIPE_PRICE_COURSE' }, { status: 500 });
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/?success=1`,
      cancel_url: `${origin}/?canceled=1`,
      metadata: {}
    });

    return NextResponse.json({ id: session.id, url: session.url });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}


