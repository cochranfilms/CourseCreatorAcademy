import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import { getUserIdFromAuthHeader } from '@/lib/api/auth';
import { notifyPostMention } from '@/lib/messageBoardNotifications';

export async function POST(req: NextRequest) {
  try {
    if (!adminDb) {
      return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
    }

    const userId = await getUserIdFromAuthHeader(req);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { postId, mentions, authorName } = await req.json();
    if (!postId || !mentions || !Array.isArray(mentions)) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Resolve mentions to user IDs
    const usersSnapshot = await adminDb.collection('users').get();
    const userMap = new Map<string, string>();
    
    usersSnapshot.forEach((doc: any) => {
      const data = doc.data();
      const handle = data.handle?.toLowerCase();
      const displayName = data.displayName?.toLowerCase();
      if (handle || displayName) {
        if (handle) userMap.set(handle, doc.id);
        if (displayName) userMap.set(displayName, doc.id);
      }
    });

    // Send notifications to mentioned users
    const notificationPromises = mentions.map(async (mention: string) => {
      const mentionLower = mention.toLowerCase();
      const mentionedUserId = userMap.get(mentionLower);
      if (mentionedUserId && mentionedUserId !== userId) {
        return notifyPostMention(mentionedUserId, authorName, postId);
      }
      return null;
    });

    await Promise.all(notificationPromises);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error sending mention notifications:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to send notifications' },
      { status: 500 }
    );
  }
}

export const runtime = 'nodejs';

