import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminStorage } from '@/lib/firebaseAdmin';
import { ensureAdmin } from '@/lib/api/admin';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    if (!adminDb || !adminStorage) {
      return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
    }

    const adminId = await ensureAdmin(req);
    if (!adminId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const discountId = params.id;
    if (!discountId) {
      return NextResponse.json({ error: 'Discount ID required' }, { status: 400 });
    }

    // Check if discount exists
    const discountRef = adminDb.collection('discounts').doc(discountId);
    const discountDoc = await discountRef.get();
    if (!discountDoc.exists) {
      return NextResponse.json({ error: 'Discount not found' }, { status: 404 });
    }

    // Get file from form data
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'File must be an image' }, { status: 400 });
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'File size must be less than 5MB' }, { status: 400 });
    }

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload to Firebase Storage
    const bucket = adminStorage.bucket();
    const fileName = `${discountId}/${Date.now()}_${file.name.replace(/\s+/g, '_')}`;
    const fileRef = bucket.file(`discount-logos/${fileName}`);

    await fileRef.save(buffer, {
      metadata: {
        contentType: file.type,
      },
    });

    // Make file publicly readable
    await fileRef.makePublic();

    // Get public URL
    const logoUrl = `https://storage.googleapis.com/${bucket.name}/discount-logos/${fileName}`;

    // Update discount document
    await discountRef.update({
      partnerLogoUrl: logoUrl,
      updatedAt: new Date(),
    });

    return NextResponse.json({
      success: true,
      logoUrl,
    });
  } catch (error: any) {
    console.error('Error uploading logo:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to upload logo' },
      { status: 500 }
    );
  }
}

