import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';
import { getUserIdFromAuthHeader } from '@/lib/api/auth';
import { badRequest, forbidden, notFound, serverError } from '@/lib/api/responses';
import { createNotification } from '@/lib/notifications';

export async function POST(req: NextRequest) {
  try {
    if (!adminDb) return serverError('Server not configured');

    const userId = await getUserIdFromAuthHeader(req);
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { threadId, text } = await req.json();
    if (!threadId) return badRequest('Missing threadId');
    if (!text || !text.trim()) return badRequest('Missing text');

    // Get thread
    const threadDoc = await adminDb.collection('threads').doc(threadId).get();
    if (!threadDoc.exists) return notFound('Thread not found');

    const threadData = threadDoc.data();
    
    // Verify the user is a member of the thread
    if (!threadData?.members || !threadData.members.includes(userId)) {
      return forbidden('You are not a member of this thread');
    }

    // Get sender info
    const senderDoc = await adminDb.collection('users').doc(userId).get();
    const senderData = senderDoc.exists ? senderDoc.data() : null;
    const senderName = senderData?.displayName || senderData?.handle || 'Someone';

    // Create message
    const messageRef = await adminDb
      .collection('threads')
      .doc(threadId)
      .collection('messages')
      .add({
        senderId: userId,
        text: text.trim(),
        createdAt: FieldValue.serverTimestamp(),
        readBy: [userId],
      });

    // Update thread's lastMessageAt and lastMessage
    await adminDb.collection('threads').doc(threadId).update({
      lastMessageAt: FieldValue.serverTimestamp(),
      lastMessage: text.trim(),
      lastMessageSenderId: userId,
      updatedAt: FieldValue.serverTimestamp(),
    });

    // Create notifications for all other thread members
    try {
      const otherMembers = (threadData.members || []).filter((id: string) => id !== userId);
      for (const memberId of otherMembers) {
        await createNotification(String(memberId), {
          type: 'message_received',
          title: 'New Message',
          message: `${senderName} sent you a message: "${text.trim().substring(0, 50)}${text.trim().length > 50 ? '...' : ''}"`,
          actionUrl: '/dashboard',
          actionLabel: 'View Message',
          metadata: { threadId, messageId: messageRef.id, senderId: userId },
        });
      }
    } catch (notifErr) {
      console.error('Error creating message notifications:', notifErr);
      // Don't fail the request if notification fails
    }

    return NextResponse.json({ success: true, messageId: messageRef.id });
  } catch (error: any) {
    console.error('Error sending message:', error);
    return serverError(error.message || 'Failed to send message');
  }
}

export const runtime = 'nodejs';

