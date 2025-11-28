import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import { getUserIdFromAuthHeader } from '@/lib/api/auth';
import { hasGlobalMembership } from '@/lib/entitlements';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: NextRequest) {
  try {
    if (!adminDb) {
      return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
    }

    // Verify user is authenticated
    const uid = await getUserIdFromAuthHeader(req);
    if (!uid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check membership (includes legacy creators)
    const hasMembership = await hasGlobalMembership(uid);
    if (!hasMembership) {
      return NextResponse.json({ error: 'Membership required' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '3', 10), 1), 10);

    // Fetch marketplace listings
    const listingsSnapshot = await adminDb
      .collection('listings')
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get();

    console.log(`[Home Listings API] Found ${listingsSnapshot.docs.length} listings for user ${uid}`);

    const listings = listingsSnapshot.docs.map((doc: any) => {
      const data = doc.data();
      return {
        id: doc.id,
        title: data.title || 'Untitled Listing',
        image: data.images && data.images.length > 0 ? data.images[0] : '',
        price: data.price || 0,
        condition: data.condition || '',
        images: data.images || [],
      };
    });

    return NextResponse.json({ listings });
  } catch (error: any) {
    console.error('[Home Listings API] Error fetching listings:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch listings' },
      { status: 500 }
    );
  }
}

export const runtime = 'nodejs';

