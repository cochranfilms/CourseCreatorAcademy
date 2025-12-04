import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import { getUserIdFromAuthHeader } from '@/lib/api/auth';
import { notifyCommentReply } from '@/lib/messageBoardNotifications';

export async function POST(req: NextRequest) {
  try {
    if (!adminDb) {
      return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
    }

    const userId = await getUserIdFromAuthHeader(req);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { postId, commentId, replyId, commentAuthorId } = await req.json();
    if (!postId || !commentId || !replyId || !commentAuthorId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Get reply author name
    const replyAuthorDoc = await adminDb.collection('users').doc(userId).get();
    const replyAuthorData = replyAuthorDoc.exists ? replyAuthorDoc.data() : null;
    const replyAuthorName = replyAuthorData?.displayName || replyAuthorData?.handle || 'Someone';

    // Send notification to comment author
    if (commentAuthorId !== userId) {
      await notifyCommentReply(commentAuthorId, replyAuthorName, postId, commentId, replyId);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error sending reply notification:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to send notification' },
      { status: 500 }
    );
  }
}

export const runtime = 'nodejs';

