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

    // Check if seller has a no-fees plan (seller pays the platform fee)
    let applicationFeeAmount = 0;
    if (sellerId && adminDb) {
      applicationFeeAmount = await computeApplicationFeeAmount(Number(amount), undefined, String(sellerId));
    } else {
      // Fallback to sync version if sellerId not provided (backwards compatibility)
      const { computeApplicationFeeAmountSync } = await import('@/lib/fees');
      applicationFeeAmount = computeApplicationFeeAmountSync(Number(amount));
    }

    // Verify the connected account can take payments before starting Checkout
    // In test mode, allow restricted accounts to accept test payments
    try {
      const account = await stripe.accounts.retrieve(sellerAccountId);
      const chargesEnabled = (account as any).charges_enabled;
      const capabilities = (account as any).capabilities || {};
      const transfersStatus = capabilities.transfers;
      const isTestMode = process.env.STRIPE_SECRET_KEY?.startsWith('sk_test_');
      
      // Check if transfers capability is active (required for transfer_data)
      if (transfersStatus !== 'active') {
        if (isTestMode) {
          // In test mode, provide helpful error message
          return NextResponse.json({
            error: 'Seller account needs to complete Stripe Connect onboarding. The transfers capability must be enabled. Please complete onboarding through the Stripe dashboard or contact support.',
            code: 'TRANSFERS_NOT_ENABLED',
            accountId: sellerAccountId
          }, { status: 400 });
        } else {
          return NextResponse.json({
            error: 'Seller is not ready to accept payments yet. Please complete Stripe Connect onboarding.'
          }, { status: 400 });
        }
      }
      
      if (!chargesEnabled && !isTestMode) {
        return NextResponse.json({
          error: 'Seller is not ready to accept payments yet. Please try again later.'
        }, { status: 400 });
      }
      // In test mode, allow restricted accounts (they can still accept test payments)
    } catch (e: any) {
      // Check if this is the transfers capability error
      if (e?.message?.includes('transfers') || e?.message?.includes('legacy_payments')) {
        return NextResponse.json({
          error: 'Seller account needs to complete Stripe Connect onboarding. The transfers capability must be enabled.',
          code: 'TRANSFERS_NOT_ENABLED',
          details: e.message
        }, { status: 400 });
      }
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

    // Create checkout session on PLATFORM account (not connected account)
    // This is the recommended marketplace pattern for proper payment splitting
    const session = await stripe.checkout.sessions.create({
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
        // Transfer funds to seller's connected account
        transfer_data: {
          destination: sellerAccountId
        },
        // Platform fee (3%) - goes to platform account
        application_fee_amount: applicationFeeAmount,
        metadata: {
          listingId: String(listingId || ''),
          listingTitle: String(listingTitle || ''),
          buyerId: String(buyerId || ''),
          sellerId: String(sellerId || ''),
          sellerAccountId: String(sellerAccountId || ''),
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
        sellerAccountId: String(sellerAccountId || ''),
        applicationFeeAmount: String(applicationFeeAmount)
      }
      // NOTE: Removed { stripeAccount: sellerAccountId } - session created on platform account
    });

    return NextResponse.json({ id: session.id, url: session.url });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}


export const runtime = 'nodejs';

