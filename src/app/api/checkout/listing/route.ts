import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { computeApplicationFeeAmount } from '@/lib/fees';
import { adminDb } from '@/lib/firebaseAdmin';

export async function POST(req: NextRequest) {
  try {
    const {
      amount,               // integer cents
      currency = 'usd',
      sellerAccountId,      // connected account ID (acct_...)
      listingId,
      listingTitle = 'Marketplace item',
      buyerId,
      sellerId
    } = await req.json();

    const origin = req.headers.get('origin') || process.env.NEXT_PUBLIC_BASE_URL || '';

    if (!sellerAccountId || !amount || amount <= 0) {
      return NextResponse.json({ error: 'sellerAccountId and positive amount are required' }, { status: 400 });
    }
    if (!buyerId) {
      return NextResponse.json({ error: 'buyerId is required' }, { status: 400 });
    }

    const applicationFeeAmount = computeApplicationFeeAmount(Number(amount));

    // Verify the connected account can take payments before starting Checkout
    try {
      const account = await stripe.accounts.retrieve(sellerAccountId);
      const chargesEnabled = (account as any).charges_enabled;
      if (!chargesEnabled) {
        return NextResponse.json({
          error: 'Seller is not ready to accept payments yet. Please try again later.'
        }, { status: 400 });
      }
    } catch (e: any) {
      return NextResponse.json({ error: e?.message || 'Failed to verify seller account' }, { status: 400 });
    }

    // Verify the buyer has connected their Stripe account (Connect onboarding completed enough to have an account)
    try {
      if (!adminDb) {
        return NextResponse.json({ error: 'Server not configured for user verification' }, { status: 500 });
      }
      const buyerRef = adminDb.collection('users').doc(String(buyerId));
      const buyerSnap = await buyerRef.get();
      const buyerData = buyerSnap.exists ? buyerSnap.data() as any : null;
      const buyerConnectAccountId = buyerData?.connectAccountId;
      if (!buyerConnectAccountId) {
        return NextResponse.json({
          error: 'Buyer must connect a Stripe account before purchasing.'
        }, { status: 400 });
      }
      // Ensure the account exists (we do not require charges_enabled for buyers; existence implies onboarding started)
      await stripe.accounts.retrieve(String(buyerConnectAccountId));
    } catch (e: any) {
      return NextResponse.json({ error: e?.message || 'Failed to verify buyer account' }, { status: 400 });
    }

    const session = await stripe.checkout.sessions.create(
      {
        mode: 'payment',
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency,
              unit_amount: Number(amount),
              product_data: { name: String(listingTitle) }
            }
          }
        ],
        payment_intent_data: {
          application_fee_amount: applicationFeeAmount,
          metadata: {
            listingId: String(listingId || ''),
            listingTitle: String(listingTitle || ''),
            buyerId: String(buyerId || ''),
            sellerId: String(sellerId || ''),
            applicationFeeAmount: String(applicationFeeAmount)
          }
        },
        shipping_address_collection: { allowed_countries: ['US'] },
        success_url: `${origin}/checkout/success?listingId=${encodeURIComponent(String(listingId || ''))}`,
        cancel_url: `${origin}/checkout/canceled?listingId=${encodeURIComponent(String(listingId || ''))}`,
        metadata: {
          listingId: String(listingId || ''),
          listingTitle: String(listingTitle || ''),
          buyerId: String(buyerId || ''),
          sellerId: String(sellerId || ''),
          applicationFeeAmount: String(applicationFeeAmount)
        }
      },
      { stripeAccount: sellerAccountId }
    );

    return NextResponse.json({ id: session.id, url: session.url });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}


export const runtime = 'nodejs';

