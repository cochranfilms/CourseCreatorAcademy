import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const accountId = searchParams.get('accountId');
    if (!accountId) {
      return NextResponse.json({ error: 'Missing accountId' }, { status: 400 });
    }

    const account = await stripe.accounts.retrieve(accountId);
    let loginLinkUrl: string | null = null;
    try {
      const ll = await stripe.accounts.createLoginLink(accountId);
      loginLinkUrl = ll.url;
    } catch {
      loginLinkUrl = null;
    }

    const acct: any = account as any;
    const payoutsSettings = acct.settings?.payouts || {};

    return NextResponse.json({
      id: acct.id,
      charges_enabled: acct.charges_enabled,
      payouts_enabled: acct.payouts_enabled,
      details_submitted: acct.details_submitted,
      requirements: acct.requirements,            // includes disabled_reason, currently_due, etc.
      capabilities: acct.capabilities || null,
      payoutSchedule: {
        interval: payoutsSettings?.schedule?.interval || null, // daily | weekly | monthly | manual
        weekly_anchor: payoutsSettings?.schedule?.weekly_anchor || null, // monday..sunday
        monthly_anchor: payoutsSettings?.schedule?.monthly_anchor || null,
        delay_days: payoutsSettings?.schedule?.delay_days || null,
      },
      statementDescriptor: acct.settings?.payments?.statement_descriptor || null,
      loginLinkUrl
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}


