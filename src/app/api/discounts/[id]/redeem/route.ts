import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebaseAdmin';
import { getUserIdFromAuthHeader } from '@/lib/api/auth';
import { hasGlobalMembership } from '@/lib/entitlements';

export async function POST(req: NextRequest, context: any) {
  try {
    if (!adminDb || !adminAuth) {
      return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
    }

    const discountId = String(context?.params?.id || '');
    if (!discountId) {
      return NextResponse.json({ error: 'Discount ID required' }, { status: 400 });
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

    // Fetch discount
    const discountDoc = await adminDb.collection('discounts').doc(discountId).get();
    if (!discountDoc.exists) {
      return NextResponse.json({ error: 'Discount not found' }, { status: 404 });
    }

    const discount = discountDoc.data() as any;

    // Check if discount is active
    if (!discount.isActive) {
      return NextResponse.json({ error: 'Discount is not active' }, { status: 400 });
    }

    // Check expiration date if set
    if (discount.expirationDate) {
      const expirationDate = discount.expirationDate.toDate();
      if (expirationDate < new Date()) {
        return NextResponse.json({ error: 'Discount has expired' }, { status: 400 });
      }
    }

    // Check if user already redeemed (optional - if maxRedemptions per user is enforced)
    // For now, we allow multiple redemptions but track them all

    // Check global maxRedemptions if set
    if (discount.maxRedemptions) {
      const redemptionsSnapshot = await adminDb
        .collection('discountRedemptions')
        .where('discountId', '==', discountId)
        .get();
      
      if (redemptionsSnapshot.size >= discount.maxRedemptions) {
        return NextResponse.json(
          { error: 'Maximum redemptions reached for this discount' },
          { status: 400 }
        );
      }
    }

    // Create redemption record
    const redemptionData = {
      userId: uid,
      discountId,
      redeemedAt: new Date(),
      codeUsed: discount.discountCode || null,
      linkUsed: discount.discountLink || null,
    };

    await adminDb.collection('discountRedemptions').add(redemptionData);

    // Return discount code/link
    return NextResponse.json({
      success: true,
      discount: {
        id: discountId,
        title: discount.title,
        discountCode: discount.discountCode,
        discountLink: discount.discountLink,
        discountType: discount.discountType,
        description: discount.description,
      },
    });
  } catch (error: any) {
    console.error('Error redeeming discount:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to redeem discount' },
      { status: 500 }
    );
  }
}

