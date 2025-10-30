import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';

export async function POST(req: NextRequest) {
  const sig = req.headers.get('stripe-signature');
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!sig || !secret) return NextResponse.json({ ok: true });

  const body = await req.text();
  let event: any;
  try {
    event = stripe.webhooks.constructEvent(body, sig, secret);
  } catch (err: any) {
    return new NextResponse(`Webhook Error: ${err.message}`, { status: 400 });
  }

  switch (event.type) {
    case 'checkout.session.completed':
      // TODO: grant course access by creating enrollment
      break;
    case 'payment_intent.succeeded':
      // TODO: fulfill marketplace order
      break;
    default:
      break;
  }

  return NextResponse.json({ received: true });
}

export const dynamic = 'force-dynamic';


