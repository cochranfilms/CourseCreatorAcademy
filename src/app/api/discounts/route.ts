import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebaseAdmin';
import { getUserIdFromAuthHeader } from '@/lib/api/auth';
import { hasGlobalMembership } from '@/lib/entitlements';

export async function GET(req: NextRequest) {
  try {
    if (!adminDb || !adminAuth) {
      return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
    }

    // Verify user is authenticated
    const uid = await getUserIdFromAuthHeader(req);
    if (!uid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check membership requirement
    const hasMembership = await hasGlobalMembership(uid);
    if (!hasMembership) {
      return NextResponse.json({ error: 'Membership required' }, { status: 403 });
    }

    // Fetch all active discounts
    const discountsSnapshot = await adminDb
      .collection('discounts')
      .where('isActive', '==', true)
      .orderBy('createdAt', 'desc')
      .get();

    const now = new Date();
    const discounts = discountsSnapshot.docs
      .map((doc) => {
        const data = doc.data();
        // Check expiration date if set
        if (data.expirationDate) {
          const expirationDate = data.expirationDate.toDate();
          if (expirationDate < now) {
            return null; // Filter out expired discounts
          }
        }
        return {
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate?.()?.toISOString(),
          updatedAt: data.updatedAt?.toDate?.()?.toISOString(),
          expirationDate: data.expirationDate?.toDate?.()?.toISOString(),
        };
      })
      .filter(Boolean);

    return NextResponse.json({ discounts });
  } catch (error: any) {
    console.error('Error fetching discounts:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch discounts' },
      { status: 500 }
    );
  }
}

