import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import { ensureAdmin } from '@/lib/api/admin';

export async function PUT(req: NextRequest, context: any) {
  try {
    if (!adminDb) {
      return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
    }

    const adminId = await ensureAdmin(req);
    if (!adminId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const discountId = String(context?.params?.id || '');
    if (!discountId) {
      return NextResponse.json({ error: 'Discount ID required' }, { status: 400 });
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

    // Check if discount exists
    const discountRef = adminDb.collection('discounts').doc(discountId);
    const discountDoc = await discountRef.get();
    if (!discountDoc.exists) {
      return NextResponse.json({ error: 'Discount not found' }, { status: 404 });
    }

    // Build update object with only provided fields
    const updates: any = {
      updatedAt: new Date(),
    };

    if (title !== undefined) updates.title = title;
    if (description !== undefined) updates.description = description;
    if (partnerName !== undefined) updates.partnerName = partnerName;
    if (partnerLogoUrl !== undefined) updates.partnerLogoUrl = partnerLogoUrl;
    if (discountCode !== undefined) updates.discountCode = discountCode;
    if (discountLink !== undefined) updates.discountLink = discountLink;
    if (discountType !== undefined) {
      if (!['code', 'link', 'both'].includes(discountType)) {
        return NextResponse.json(
          { error: 'Invalid discountType. Must be "code", "link", or "both"' },
          { status: 400 }
        );
      }
      updates.discountType = discountType;
    }
    if (discountAmount !== undefined) updates.discountAmount = discountAmount;
    if (category !== undefined) updates.category = category;
    if (isActive !== undefined) updates.isActive = isActive;
    if (isTestOnly !== undefined) updates.isTestOnly = isTestOnly;
    if (requiresMembership !== undefined) updates.requiresMembership = requiresMembership;
    if (maxRedemptions !== undefined) updates.maxRedemptions = maxRedemptions;
    if (expirationDate !== undefined) {
      updates.expirationDate = expirationDate ? new Date(expirationDate) : null;
    }

    await discountRef.update(updates);

    // Fetch updated discount
    const updatedDoc = await discountRef.get();
    const updatedData = updatedDoc.data() as any;

    return NextResponse.json({
      success: true,
      discount: {
        id: discountId,
        ...updatedData,
        createdAt: updatedData.createdAt?.toDate?.()?.toISOString(),
        updatedAt: updatedData.updatedAt?.toDate?.()?.toISOString(),
        expirationDate: updatedData.expirationDate?.toDate?.()?.toISOString(),
      },
    });
  } catch (error: any) {
    console.error('Error updating discount:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update discount' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest, context: any) {
  try {
    if (!adminDb) {
      return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
    }

    const adminId = await ensureAdmin(req);
    if (!adminId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const discountId = String(context?.params?.id || '');
    if (!discountId) {
      return NextResponse.json({ error: 'Discount ID required' }, { status: 400 });
    }

    // Check if discount exists
    const discountRef = adminDb.collection('discounts').doc(discountId);
    const discountDoc = await discountRef.get();
    if (!discountDoc.exists) {
      return NextResponse.json({ error: 'Discount not found' }, { status: 404 });
    }

    // Hard delete (or you could soft delete by setting isActive: false)
    await discountRef.delete();

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting discount:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete discount' },
      { status: 500 }
    );
  }
}

