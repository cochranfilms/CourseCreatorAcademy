import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebaseAdmin';
import { stripe } from '@/lib/stripe';

async function getUserId(req: NextRequest): Promise<string | null> {
	const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
	if (authHeader && authHeader.toLowerCase().startsWith('bearer ') && adminAuth) {
		const idToken = authHeader.split(' ')[1];
		try {
			const decoded = await adminAuth.verifyIdToken(idToken);
			return decoded.uid || null;
		} catch {
			// fall through
		}
	}
	// Optional fallback to query param (less secure, but useful in local dev)
	const { searchParams } = new URL(req.url);
	const qp = searchParams.get('userId');
	return qp ? String(qp) : null;
}

export async function GET(req: NextRequest) {
	try {
		if (!adminDb) {
			return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
		}
		const uid = await getUserId(req);
		if (!uid) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		// Fetch all orders for this seller
		const snap = await adminDb.collection('orders').where('sellerId', '==', String(uid)).get();
		let gross = 0;
		let applicationFees = 0;
		let count = 0;

		// Collect PI ids to query Stripe fees for
		const paymentIntentIds: string[] = [];
		snap.docs.forEach((d: FirebaseFirestore.QueryDocumentSnapshot) => {
			const o = d.data() as any;
			count += 1;
			gross += Number(o?.amount || 0);
			applicationFees += Number(o?.application_fee_amount || 0);
			const pi = o?.paymentIntentId ? String(o.paymentIntentId) : null;
			if (pi) paymentIntentIds.push(pi);
		});

		// Sum Stripe processing fees by looking up each payment intent's latest charge balance transaction
		let stripeFees = 0;
		for (const piId of paymentIntentIds) {
			try {
				const pi = await stripe.paymentIntents.retrieve(piId, {
					expand: ['latest_charge.balance_transaction']
				} as any);
				const latestCharge: any = (pi as any).latest_charge;
				const bt: any = latestCharge?.balance_transaction;
				if (bt && typeof bt.fee === 'number') {
					stripeFees += Number(bt.fee);
				} else if (latestCharge?.balance_transaction) {
					// Fallback if expand didn’t attach object
					const bt2 = await stripe.balanceTransactions.retrieve(String(latestCharge.balance_transaction));
					// @ts-ignore
					if (bt2 && typeof (bt2 as any).fee === 'number') {
						// @ts-ignore
						stripeFees += Number((bt2 as any).fee);
					}
				}
			} catch {
				// ignore individual failures
			}
		}

		const netAfterPlatform = Math.max(gross - applicationFees, 0);
		const netAfterStripe = Math.max(gross - applicationFees - stripeFees, 0);

		return NextResponse.json({
			ok: true,
			ordersCount: count,
			gross,
			applicationFees,
			stripeFees,
			netAfterPlatform,
			netAfterStripe
		});
	} catch (err: any) {
		return NextResponse.json({ error: err?.message || 'Failed to compute analytics' }, { status: 500 });
	}
}

export const dynamic = 'force-dynamic';


