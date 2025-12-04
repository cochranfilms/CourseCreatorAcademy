import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import { getUserIdFromAuthHeader } from '@/lib/api/auth';
import { notifyPostComment } from '@/lib/messageBoardNotifications';

export async function POST(req: NextRequest) {
  try {
    if (!adminDb) {
      return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
    }

    const userId = await getUserIdFromAuthHeader(req);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { postId, commentId, postAuthorId } = await req.json();
    if (!postId || !commentId || !postAuthorId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Get comment author name
    const commentAuthorDoc = await adminDb.collection('users').doc(userId).get();
    const commentAuthorData = commentAuthorDoc.exists ? commentAuthorDoc.data() : null;
    const commentAuthorName = commentAuthorData?.displayName || commentAuthorData?.handle || 'Someone';

    // Send notification to post author
    if (postAuthorId !== userId) {
      await notifyPostComment(postAuthorId, commentAuthorName, postId, commentId);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error sending comment notification:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to send notification' },
      { status: 500 }
    );
  }
}

export const runtime = 'nodejs';

