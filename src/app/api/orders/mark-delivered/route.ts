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

    const { orderId } = await req.json();
    if (!orderId) return badRequest('Missing orderId');

    // Get order
    const orderDoc = await adminDb.collection('orders').doc(orderId).get();
    if (!orderDoc.exists) return notFound('Order not found');

    const orderData = orderDoc.data();
    
    // Verify the user is the buyer
    if (orderData?.buyerId !== userId) return forbidden('Only the buyer can mark order as delivered');

    // Check if already delivered
    if (orderData?.status === 'delivered') return badRequest('Order is already marked as delivered');

    // Update order status
    await adminDb.collection('orders').doc(orderId).update({
      status: 'delivered',
      deliveredAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    // Create notification for seller (order marked as delivered)
    try {
      if (orderData?.sellerId) {
        // Get buyer name
        const buyerDoc = await adminDb.collection('users').doc(userId).get();
        const buyerData = buyerDoc.exists ? buyerDoc.data() : null;
        const buyerName = buyerData?.displayName || buyerData?.handle || 'Buyer';

        await createOrderNotification(String(orderData.sellerId), 'order_delivered', {
          orderId,
          listingTitle: orderData?.listingTitle || 'Product',
          amount: orderData?.amount,
          buyerName,
        });
      }
    } catch (notifErr) {
      console.error('Error creating order delivered notification:', notifErr);
      // Don't fail the request if notification fails
    }

    return NextResponse.json({ success: true, message: 'Order marked as delivered' });
  } catch (error: any) {
    console.error('Error marking order as delivered:', error);
    return serverError(error.message || 'Failed to mark order as delivered');
  }
}

export const runtime = 'nodejs';

