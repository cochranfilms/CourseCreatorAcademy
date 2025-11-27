import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';
import { getUserIdFromAuthHeader } from '@/lib/api/auth';
import { badRequest, forbidden, notFound, serverError } from '@/lib/api/responses';
import { createOrderNotification } from '@/lib/notifications';

export async function POST(req: NextRequest) {
  try {
    if (!adminDb) return serverError('Server not configured');

    const userId = await getUserIdFromAuthHeader(req);
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { orderId, trackingNumber, trackingCarrier, trackingUrl } = await req.json();
    if (!orderId) return badRequest('Missing orderId');
    if (!trackingNumber) return badRequest('Missing trackingNumber');

    // Get order
    const orderDoc = await adminDb.collection('orders').doc(orderId).get();
    if (!orderDoc.exists) return notFound('Order not found');

    const orderData = orderDoc.data();
    
    // Verify the user is the seller
    if (orderData?.sellerId !== userId) return forbidden('Only the seller can update tracking');

    // Update order with tracking information
    await adminDb.collection('orders').doc(orderId).update({
      trackingNumber: String(trackingNumber),
      trackingCarrier: trackingCarrier ? String(trackingCarrier) : null,
      trackingUrl: trackingUrl ? String(trackingUrl) : null,
      status: 'shipped',
      shippedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    // Create notification for buyer (order shipped with tracking)
    try {
      if (orderData?.buyerId) {
        // Get seller name
        const sellerDoc = await adminDb.collection('users').doc(userId).get();
        const sellerData = sellerDoc.exists ? sellerDoc.data() : null;
        const sellerName = sellerData?.displayName || sellerData?.handle || 'Seller';

        await createOrderNotification(String(orderData.buyerId), 'order_delivered', {
          orderId,
          listingTitle: orderData?.listingTitle || 'Product',
          amount: orderData?.amount,
          sellerName,
        });
      }
    } catch (notifErr) {
      console.error('Error creating order tracking notification:', notifErr);
      // Don't fail the request if notification fails
    }

    return NextResponse.json({ success: true, message: 'Tracking information updated' });
  } catch (error: any) {
    console.error('Error updating tracking:', error);
    return serverError(error.message || 'Failed to update tracking');
  }
}

export const runtime = 'nodejs';

