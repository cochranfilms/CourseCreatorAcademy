import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';

export async function POST(req: NextRequest) {
  try {
    const { priceId, destinationAccountId, applicationFeeAmount } = await req.json();
    const origin = req.headers.get('origin') || process.env.NEXT_PUBLIC_BASE_URL || '';
    if (!priceId || !destinationAccountId) {
      return NextResponse.json({ error: 'priceId and destinationAccountId required' }, { status: 400 });
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{ price: priceId, quantity: 1 }],
      payment_intent_data: {
        transfer_data: { destination: destinationAccountId },
        application_fee_amount: applicationFeeAmount ?? 0
      },
      success_url: `${origin}/?success=1`,
      cancel_url: `${origin}/?canceled=1`
    });

    return NextResponse.json({ id: session.id, url: session.url });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}


