import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';

export async function POST(req: NextRequest) {
  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json({ error: 'Missing STRIPE_SECRET_KEY on server' }, { status: 500 });
    }
    const { accountId } = await req.json();
    const origin = req.headers.get('origin') || process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3002';

    // Use existing account if provided, else create a new Express account
    const account = accountId
      ? await stripe.accounts.retrieve(accountId)
      : await stripe.accounts.create({
          type: 'express',
          country: 'US',
          capabilities: {
            card_payments: { requested: true },
            transfers: { requested: true }
          }
        });

    const link = await stripe.accountLinks.create({
      account: account.id,
      refresh_url: `${origin}/creator/onboarding?refresh=1`,
      return_url: `${origin}/creator/onboarding?return=1`,
      type: 'account_onboarding'
    });

    return NextResponse.json({ url: link.url, accountId: account.id });
  } catch (err: any) {
    const message = err?.raw?.message || err?.message || 'Unknown error';
    const type = err?.type || 'Error';
    console.error('Stripe Connect Onboard Error:', { type, message });
    return NextResponse.json({ error: `${type}: ${message}` }, { status: 500 });
  }
}

export const runtime = 'nodejs';


