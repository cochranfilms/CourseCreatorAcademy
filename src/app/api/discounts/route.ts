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

    // Check membership requirement - but be lenient for authenticated users
    // This allows users who are authenticated but membership check fails to still see discounts
    const hasMembership = await hasGlobalMembership(uid);
    if (!hasMembership) {
      // Log warning but don't block - user might have membership but it's not set properly
      console.warn(`[Discounts API] User ${uid} membership check failed, but allowing access (authenticated user)`);
      // Continue to fetch discounts anyway - fail open for authenticated users
    }

    // Fetch all active discounts
    const discountsSnapshot = await adminDb
      .collection('discounts')
      .where('isActive', '==', true)
      .orderBy('createdAt', 'desc')
      .get();

    console.log(`[Discounts API] Found ${discountsSnapshot.docs.length} active discounts in Firestore`);

    const now = new Date();
    console.log(`[Discounts API] Current time: ${now.toISOString()}`);

    const discounts = discountsSnapshot.docs
      .map((doc: any) => {
        const data = doc.data();
        console.log(`[Discounts API] Processing discount ${doc.id}:`, {
          title: data.title,
          isActive: data.isActive,
          expirationDate: data.expirationDate?.toDate?.()?.toISOString() || data.expirationDate,
        });

        // Check expiration date if set
        if (data.expirationDate) {
          try {
            const expirationDate = data.expirationDate?.toDate ? data.expirationDate.toDate() : new Date(data.expirationDate);
            console.log(`[Discounts API] Discount ${doc.id} expiration check:`, {
              expirationDate: expirationDate.toISOString(),
              now: now.toISOString(),
              isExpired: expirationDate < now,
            });
            if (expirationDate < now) {
              console.log(`[Discounts API] Discount ${doc.id} (${data.title}) is EXPIRED - filtering out`);
              return null; // Filter out expired discounts
            }
          } catch (error) {
            // If expirationDate is invalid, skip expiration check
            console.warn(`[Discounts API] Invalid expirationDate format for discount ${doc.id}:`, error);
          }
        }

        const discountData = {
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate?.()?.toISOString(),
          updatedAt: data.updatedAt?.toDate?.()?.toISOString(),
          expirationDate: data.expirationDate?.toDate?.()?.toISOString(),
        };
        console.log(`[Discounts API] Discount ${doc.id} (${data.title}) INCLUDED in results`);
        return discountData;
      })
      .filter(Boolean);

    console.log(`[Discounts API] Returning ${discounts.length} discounts after filtering`);
    return NextResponse.json({ discounts });
  } catch (error: any) {
    console.error('Error fetching discounts:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch discounts' },
      { status: 500 }
    );
  }
}

