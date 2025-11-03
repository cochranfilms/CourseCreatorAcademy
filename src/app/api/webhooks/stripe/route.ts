import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { adminDb } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';

export async function POST(req: NextRequest) {
  const sig = req.headers.get('stripe-signature');
  const platformSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const connectSecret = process.env.STRIPE_CONNECT_WEBHOOK_SECRET;
  if (!sig || (!platformSecret && !connectSecret)) return NextResponse.json({ ok: true });

  const body = await req.text();
  let event: any | null = null;
  let verifiedWith: 'platform' | 'connect' | null = null;

  // Try platform secret first
  if (platformSecret) {
    try {
      event = stripe.webhooks.constructEvent(body, sig, platformSecret);
      verifiedWith = 'platform';
    } catch (e) {
      event = null;
    }
  }

  // Fallback to connect secret if needed
  if (!event && connectSecret) {
    try {
      event = stripe.webhooks.constructEvent(body, sig, connectSecret);
      verifiedWith = 'connect';
    } catch (e) {
      event = null;
    }
  }

  if (!event) {
    return new NextResponse('Webhook signature verification failed', { status: 400 });
  }

  const isConnectEvent = verifiedWith === 'connect' || Boolean(event.account);

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object;
      const isSubscription = (session.mode === 'subscription') || Boolean(session.subscription);
      console.log('checkout.session.completed', {
        isConnectEvent,
        account: event.account,
        sessionId: session.id,
        amount_total: session.amount_total,
        currency: session.currency,
        mode: session.mode,
        subscription: session.subscription,
        metadata: session.metadata
      });
      try {
        if (isSubscription && isConnectEvent && adminDb) {
          // Legacy+ subscription flow
          const creatorId = session.metadata?.legacyCreatorId || null;
          const buyerId = session.metadata?.buyerId || null;
          if (creatorId && buyerId) {
            const subId = session.subscription || null;
            const subDoc = {
              userId: String(buyerId),
              creatorId: String(creatorId),
              subscriptionId: subId,
              checkoutSessionId: session.id,
              currency: session.currency || 'usd',
              amount: session.amount_total || 1000,
              status: 'active',
              sellerAccountId: event.account || null,
              createdAt: FieldValue.serverTimestamp(),
              updatedAt: FieldValue.serverTimestamp(),
            };
            await adminDb.collection('legacySubscriptions').add(subDoc);
          }
        } else {
          // Marketplace order (existing)
          // Since checkout is created on platform account, get seller account ID from metadata or payment intent transfer
          let sellerAccountId = event.account || session.metadata?.sellerAccountId || null;
          if (!sellerAccountId && session.payment_intent) {
            try {
              const paymentIntent = await stripe.paymentIntents.retrieve(session.payment_intent as string);
              sellerAccountId = paymentIntent.transfer_data?.destination || null;
            } catch (e) {
              console.error('Failed to fetch payment intent for seller account ID:', e);
            }
          }
          
          const now = Date.now();
          const deadlineMs = 72 * 60 * 60 * 1000; // 72h
          const order = {
            checkoutSessionId: session.id,
            paymentIntentId: session.payment_intent || null,
            amount: session.amount_total || 0,
            currency: session.currency || 'usd',
            application_fee_amount: Number(session.metadata?.applicationFeeAmount || 0),
            listingId: session.metadata?.listingId || null,
            listingTitle: session.metadata?.listingTitle || null,
            buyerId: session.metadata?.buyerId || null,
            sellerId: session.metadata?.sellerId || null,
            sellerAccountId: sellerAccountId,
            shippingDetails: session.shipping_details || null,
            status: 'awaiting_tracking',
            createdAt: FieldValue.serverTimestamp(),
            trackingDeadlineAtMs: now + deadlineMs,
          };
          await adminDb.collection('orders').add(order);
        }
      } catch (err) {
        console.error('Webhook handling error (checkout.session.completed):', err);
      }
      break;
    }
    case 'customer.subscription.updated': {
      const sub = event.data.object;
      console.log('customer.subscription.updated', { account: event.account, id: sub.id, status: sub.status });
      try {
        if (adminDb) {
          const q = await adminDb.collection('legacySubscriptions').where('subscriptionId', '==', sub.id).limit(1).get();
          if (!q.empty) {
            await q.docs[0].ref.set({ status: sub.status || 'active', updatedAt: FieldValue.serverTimestamp() }, { merge: true });
          }
        }
      } catch (err) {
        console.error('Failed to update legacySubscription on sub.update', err);
      }
      break;
    }
    case 'customer.subscription.deleted': {
      const sub = event.data.object;
      console.log('customer.subscription.deleted', { account: event.account, id: sub.id, status: sub.status });
      try {
        if (adminDb) {
          const q = await adminDb.collection('legacySubscriptions').where('subscriptionId', '==', sub.id).limit(1).get();
          if (!q.empty) {
            await q.docs[0].ref.set({ status: 'canceled', updatedAt: FieldValue.serverTimestamp() }, { merge: true });
          }
        }
      } catch (err) {
        console.error('Failed to update legacySubscription on sub.delete', err);
      }
      break;
    }
    case 'payment_intent.succeeded': {
      const pi = event.data.object;
      console.log('payment_intent.succeeded', {
        isConnectEvent,
        account: event.account,
        payment_intent: pi.id,
        amount: pi.amount,
        currency: pi.currency,
        application_fee_amount: pi.application_fee_amount
      });
      break;
    }
    case 'payment_intent.payment_failed': {
      const pi = event.data.object;
      console.warn('payment_intent.payment_failed', { isConnectEvent, account: event.account, payment_intent: pi.id });
      break;
    }
    case 'charge.dispute.created': {
      console.warn('charge.dispute.created', { isConnectEvent, account: event.account });
      break;
    }
    case 'charge.refunded': {
      console.log('charge.refunded', { isConnectEvent, account: event.account });
      break;
    }
    default:
      break;
  }

  return NextResponse.json({ received: true });
}

export const dynamic = 'force-dynamic';


