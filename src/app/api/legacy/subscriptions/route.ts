import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';

// GET /api/legacy/subscriptions?userId=<userId>
// Returns user's active Legacy+ subscriptions
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }
    if (!adminDb) {
      return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
    }

    const subsSnap = await adminDb.collection('legacySubscriptions')
      .where('userId', '==', String(userId))
      .where('status', 'in', ['active', 'trialing'])
      .get();

    const subscriptions = subsSnap.docs.map((d: FirebaseFirestore.QueryDocumentSnapshot) => {
      const data = d.data() as any;
      return {
        id: d.id,
        creatorId: data.creatorId,
        subscriptionId: data.subscriptionId,
        status: data.status,
        amount: data.amount || 1000,
        currency: data.currency || 'usd',
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
      };
    });

    // Enrich with creator info
    type LegacySub = {
      id: string;
      creatorId: string;
      subscriptionId: string | null;
      status: string;
      amount: number;
      currency: string;
      createdAt: any;
      updatedAt: any;
    };

    const enriched = await Promise.all(
      subscriptions.map(async (sub: LegacySub) => {
        const creatorDoc = await adminDb.collection('legacy_creators').doc(String(sub.creatorId)).get();
        if (creatorDoc.exists) {
          const creator = creatorDoc.data() as any;
          return {
            ...sub,
            creator: {
              id: creatorDoc.id,
              displayName: creator.displayName || creator.handle || 'Creator',
              handle: creator.handle,
              avatarUrl: creator.avatarUrl || null,
            },
          };
        }
        return sub;
      })
    );

    return NextResponse.json({ subscriptions: enriched });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to fetch subscriptions' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';

