import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { adminDb } from '@/lib/firebaseAdmin';
import { computeApplicationFeeAmount } from '@/lib/fees';

/**
 * Verify payment split for a marketplace order
 * 
 * GET /api/admin/verify-payment-split?orderId=<orderId>
 * GET /api/admin/verify-payment-split?checkoutSessionId=<sessionId>
 * GET /api/admin/verify-payment-split?paymentIntentId=<piId>
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const orderId = searchParams.get('orderId');
    const checkoutSessionId = searchParams.get('checkoutSessionId');
    const paymentIntentId = searchParams.get('paymentIntentId');

    if (!orderId && !checkoutSessionId && !paymentIntentId) {
      return NextResponse.json(
        { error: 'Provide orderId, checkoutSessionId, or paymentIntentId' },
        { status: 400 }
      );
    }

    let order: any = null;
    let session: any = null;
    let paymentIntent: any = null;

    // Fetch order from Firestore if orderId provided
    if (orderId && adminDb) {
      const orderDoc = await adminDb.collection('orders').doc(orderId).get();
      if (orderDoc.exists) {
        order = { id: orderDoc.id, ...orderDoc.data() };
        checkoutSessionId || (order.checkoutSessionId);
        paymentIntentId || (order.paymentIntentId);
      }
    }

    // Fetch checkout session from Stripe
    if (checkoutSessionId) {
      try {
        // Try to get session from platform account first
        session = await stripe.checkout.sessions.retrieve(checkoutSessionId);
      } catch (e) {
        // If not found, try from connected account (if we have sellerAccountId)
        if (order?.sellerAccountId) {
          try {
            session = await stripe.checkout.sessions.retrieve(
              checkoutSessionId,
              { stripeAccount: order.sellerAccountId }
            );
          } catch (e2) {
            // Session might be on platform account but we need to search connected accounts
            console.error('Could not retrieve session:', e2);
          }
        }
      }
    }

    // Fetch payment intent from Stripe
    if (paymentIntentId || session?.payment_intent) {
      const piId = paymentIntentId || session?.payment_intent;
      try {
        // Try platform account first
        paymentIntent = await stripe.paymentIntents.retrieve(piId as string);
      } catch (e) {
        // Try from connected account
        if (order?.sellerAccountId) {
          try {
            paymentIntent = await stripe.paymentIntents.retrieve(
              piId as string,
              { stripeAccount: order.sellerAccountId }
            );
          } catch (e2) {
            console.error('Could not retrieve payment intent:', e2);
          }
        }
      }
    }

    // If we have payment intent, fetch the charge to see actual transfers
    let charge: any = null;
    if (paymentIntent?.latest_charge) {
      try {
        charge = typeof paymentIntent.latest_charge === 'string'
          ? await stripe.charges.retrieve(paymentIntent.latest_charge)
          : paymentIntent.latest_charge;
      } catch (e) {
        console.error('Could not retrieve charge:', e);
      }
    }

    // Calculate expected values
    const totalAmount = order?.amount || session?.amount_total || paymentIntent?.amount || 0;
    const expectedApplicationFee = order?.application_fee_amount || 
      (totalAmount > 0 ? computeApplicationFeeAmount(totalAmount) : 0);
    const expectedSellerAmount = totalAmount - expectedApplicationFee;
    const expectedPlatformFeePercent = (expectedApplicationFee / totalAmount) * 100;
    const expectedSellerPercent = (expectedSellerAmount / totalAmount) * 100;

    // Get actual values from Stripe
    const actualApplicationFee = paymentIntent?.application_fee_amount || 0;
    const actualTransferAmount = charge?.transfer?.amount || charge?.amount || 0;

    // Calculate Stripe processing fees (these are separate from application fees)
    // Stripe fees are typically: 2.9% + $0.30 for US cards, but can vary
    const stripeFee = totalAmount - actualApplicationFee - actualTransferAmount;
    const stripeFeePercent = totalAmount > 0 ? (stripeFee / totalAmount) * 100 : 0;

    // Verification results
    const verification = {
      orderId: order?.id || null,
      checkoutSessionId: checkoutSessionId || session?.id || null,
      paymentIntentId: paymentIntentId || paymentIntent?.id || null,
      sellerAccountId: order?.sellerAccountId || null,
      status: {
        paymentIntentStatus: paymentIntent?.status || 'unknown',
        chargeStatus: charge?.status || 'unknown',
        sessionStatus: session?.payment_status || 'unknown',
      },
      amounts: {
        totalCharged: totalAmount,
        expectedApplicationFee: expectedApplicationFee,
        actualApplicationFee: actualApplicationFee,
        expectedSellerAmount: expectedSellerAmount,
        actualTransferAmount: actualTransferAmount,
        stripeProcessingFee: stripeFee,
      },
      percentages: {
        expectedPlatformFee: expectedPlatformFeePercent.toFixed(2) + '%',
        expectedSellerCut: expectedSellerPercent.toFixed(2) + '%',
        actualPlatformFee: totalAmount > 0 ? ((actualApplicationFee / totalAmount) * 100).toFixed(2) + '%' : '0%',
        actualSellerCut: totalAmount > 0 ? ((actualTransferAmount / totalAmount) * 100).toFixed(2) + '%' : '0%',
        stripeFeePercent: stripeFeePercent.toFixed(2) + '%',
      },
      verification: {
        applicationFeeCorrect: Math.abs(actualApplicationFee - expectedApplicationFee) <= 1, // Allow 1 cent tolerance
        sellerAmountCorrect: Math.abs(actualTransferAmount - expectedSellerAmount) <= 100, // Allow $1 tolerance for Stripe fees
        platformReceivedCorrect: actualApplicationFee >= expectedApplicationFee - 1,
        sellerReceivedCorrect: actualTransferAmount >= expectedSellerAmount - 100, // Seller gets their 97% minus Stripe fees
      },
      notes: [
        'Stripe processing fees are deducted from the seller\'s payout, not from the platform fee.',
        'The seller receives: 97% of sale - Stripe processing fees (~2.9% + $0.30 for US cards).',
        'The platform receives: 3% application fee (not affected by Stripe processing fees).',
      ],
    };

    return NextResponse.json(verification);
  } catch (err: any) {
    console.error('Payment split verification error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to verify payment split' },
      { status: 500 }
    );
  }
}

export const dynamic = 'force-dynamic';

