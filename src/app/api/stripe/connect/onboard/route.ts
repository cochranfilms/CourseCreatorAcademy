import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';

export async function POST(req: NextRequest) {
  try {
    const { accountId } = await req.json();
    const origin = req.headers.get('origin') || process.env.NEXT_PUBLIC_BASE_URL || '';
    const account = accountId ? await stripe.accounts.retrieve(accountId) : await stripe.accounts.create({ type: 'standard' });
    const link = await stripe.accountLinks.create({
      account: account.id,
      refresh_url: `${origin}/creator/onboarding?refresh=1`,
      return_url: `${origin}/creator/onboarding?return=1`,
      type: 'account_onboarding'
    });
    return NextResponse.json({ url: link.url, accountId: account.id });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}


