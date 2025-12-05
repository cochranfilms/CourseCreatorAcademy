import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import { FieldValue, QueryDocumentSnapshot } from 'firebase-admin/firestore';
import { getUserIdFromAuthHeader } from '@/lib/api/auth';
import { badRequest, serverError } from '@/lib/api/responses';

// POST /api/messages/threads
// Create or get existing thread with a recipient
export async function POST(req: NextRequest) {
  try {
    if (!adminDb) return serverError('Server not configured');

    const userId = await getUserIdFromAuthHeader(req);
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { recipientUserId } = await req.json();
    if (!recipientUserId) return badRequest('Missing recipientUserId');
    if (recipientUserId === userId) return badRequest('Cannot create thread with yourself');

    // Check if thread already exists
    const threadsSnap = await adminDb
      .collection('threads')
      .where('type', '==', 'dm')
      .where('members', 'array-contains', userId)
      .get();

    const existingThread = threadsSnap.docs.find((doc: QueryDocumentSnapshot) => {
      const data = doc.data();
      return data.members.includes(recipientUserId) && data.members.length === 2;
    });

    if (existingThread) {
      return NextResponse.json({ threadId: existingThread.id });
    }

    // Create new thread
    const threadRef = await adminDb.collection('threads').add({
      type: 'dm',
      members: [userId, recipientUserId],
      createdAt: FieldValue.serverTimestamp(),
      lastMessageAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ threadId: threadRef.id });
  } catch (error: any) {
    console.error('Error creating/getting thread:', error);
    return serverError(error.message || 'Failed to create/get thread');
  }
}

export const runtime = 'nodejs';

