import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import { ensureAdmin } from '@/lib/api/admin';

export async function GET(req: NextRequest) {
  try {
    if (!adminDb) {
      return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
    }

    const adminId = await ensureAdmin(req);
    if (!adminId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch all discounts (admin can see all)
    const discountsSnapshot = await adminDb
      .collection('discounts')
      .orderBy('createdAt', 'desc')
      .get();

    const discounts = discountsSnapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate?.()?.toISOString(),
        updatedAt: data.updatedAt?.toDate?.()?.toISOString(),
        expirationDate: data.expirationDate?.toDate?.()?.toISOString(),
      };
    });

    return NextResponse.json({ discounts });
  } catch (error: any) {
    console.error('Error fetching discounts:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch discounts' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!adminDb) {
      return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
    }

    const adminId = await ensureAdmin(req);
    if (!adminId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const {
      title,
      description,
      partnerName,
      partnerLogoUrl,
      discountCode,
      discountLink,
      discountType,
      discountAmount,
      category,
      isActive,
      isTestOnly,
      requiresMembership,
      maxRedemptions,
      expirationDate,
    } = body;

    // Validate required fields
    if (!title || !partnerName || !discountType) {
      return NextResponse.json(
        { error: 'Missing required fields: title, partnerName, discountType' },
        { status: 400 }
      );
    }

    if (!['code', 'link', 'both'].includes(discountType)) {
      return NextResponse.json(
        { error: 'Invalid discountType. Must be "code", "link", or "both"' },
        { status: 400 }
      );
    }

    if (discountType === 'code' && !discountCode) {
      return NextResponse.json(
        { error: 'discountCode required when discountType is "code" or "both"' },
        { status: 400 }
      );
    }

    if (discountType === 'link' && !discountLink) {
      return NextResponse.json(
        { error: 'discountLink required when discountType is "link" or "both"' },
        { status: 400 }
      );
    }

    // Create discount document
    const discountData: any = {
      title,
      description: description || '',
      partnerName,
      partnerLogoUrl: partnerLogoUrl || null,
      discountCode: discountCode || null,
      discountLink: discountLink || null,
      discountType,
      discountAmount: discountAmount || null,
      category: category || null,
      isActive: isActive !== undefined ? isActive : true,
      isTestOnly: isTestOnly !== undefined ? isTestOnly : false,
      requiresMembership: requiresMembership !== undefined ? requiresMembership : true,
      maxRedemptions: maxRedemptions || null,
      expirationDate: expirationDate ? new Date(expirationDate) : null,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: adminId,
    };

    const docRef = await adminDb.collection('discounts').add(discountData);

    return NextResponse.json({
      success: true,
      discount: {
        id: docRef.id,
        ...discountData,
        createdAt: discountData.createdAt.toISOString(),
        updatedAt: discountData.updatedAt.toISOString(),
        expirationDate: discountData.expirationDate?.toISOString(),
      },
    });
  } catch (error: any) {
    console.error('Error creating discount:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create discount' },
      { status: 500 }
    );
  }
}

