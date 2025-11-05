import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { adminDb } from '@/lib/firebaseAdmin';

// POST /api/legacy/subscribe
// Body: { creatorId: string, buyerId: string }
export async function POST(req: NextRequest) {
  try {
    const { creatorId, buyerId } = await req.json();
    if (!creatorId || !buyerId) {
      return NextResponse.json({ error: 'creatorId and buyerId are required' }, { status: 400 });
    }
    if (!adminDb) {
      return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
    }

    const origin = req.headers.get('origin') || process.env.NEXT_PUBLIC_BASE_URL || '';

    const creatorDoc = await adminDb.collection('legacy_creators').doc(String(creatorId)).get();
    if (!creatorDoc.exists) {
      return NextResponse.json({ error: 'Creator not found' }, { status: 404 });
    }
    const creator = creatorDoc.data() as any;
    let connectAccountId = (creator?.connectAccountId as string | undefined) || undefined;
    const creatorName = creator?.displayName || creator?.handle || 'Creator';
    // Fallback: derive connect account from owner user's profile if not present on creator doc
    if (!connectAccountId && creator?.ownerUserId) {
      try {
        const owner = await adminDb.collection('users').doc(String(creator.ownerUserId)).get();
        const ownerData = owner.exists ? (owner.data() as any) : null;
        if (ownerData?.connectAccountId) {
          connectAccountId = String(ownerData.connectAccountId);
          // Persist it on the creator doc for future calls
          await creatorDoc.ref.set({ connectAccountId }, { merge: true });
        }
      } catch {}
    }
    if (!connectAccountId) {
      return NextResponse.json({ error: 'Creator is not ready to accept subscriptions' }, { status: 400 });
    }

    // Try to enrich with buyer email (optional)
    let customerEmail: string | undefined = undefined;
    try {
      const userDoc = await adminDb.collection('users').doc(String(buyerId)).get();
      customerEmail = (userDoc.exists && (userDoc.data() as any)?.email) || undefined;
    } catch {}

    // Create a subscription Checkout Session on the PLATFORM account (no destination charge).
    // We will pay the legacy creator a fixed $3 per successful invoice via webhook transfers.
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer_email: customerEmail,
      line_items: [
        {
          // $10.00 USD monthly
          price_data: {
            currency: 'usd',
            unit_amount: 1000,
            recurring: { interval: 'month' },
            product_data: {
              name: `Legacy+ Support for ${creatorName}`,
            }
          },
          quantity: 1
        }
      ],
      // Put identifiers on the subscription for later invoice handling
      subscription_data: {
        metadata: {
          legacyCreatorId: String(creatorId),
          connectAccountId: String(connectAccountId)
        }
      },
      success_url: `${origin}/legacy/success?creatorId=${encodeURIComponent(String(creatorId))}`,
      cancel_url: `${origin}/legacy/canceled?creatorId=${encodeURIComponent(String(creatorId))}`,
      metadata: {
        legacyCreatorId: String(creatorId),
        buyerId: String(buyerId),
        connectAccountId: String(connectAccountId)
      }
    });

    return NextResponse.json({ id: session.id, url: session.url });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to create subscription' }, { status: 500 });
  }
}

export const runtime = 'nodejs';


