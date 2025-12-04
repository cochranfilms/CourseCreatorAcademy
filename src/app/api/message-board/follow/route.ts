import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';
import { getUserIdFromAuthHeader } from '@/lib/api/auth';
import { notifyUserFollowed } from '@/lib/messageBoardNotifications';

export async function POST(req: NextRequest) {
  try {
    if (!adminDb) {
      return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
    }

    const userId = await getUserIdFromAuthHeader(req);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { targetUserId } = await req.json();
    if (!targetUserId) {
      return NextResponse.json({ error: 'Missing targetUserId' }, { status: 400 });
    }

    if (targetUserId === userId) {
      return NextResponse.json({ error: 'Cannot follow yourself' }, { status: 400 });
    }

    // Check if already following
    const followDoc = await adminDb
      .collection('users')
      .doc(userId)
      .collection('following')
      .doc(targetUserId)
      .get();

    if (followDoc.exists) {
      return NextResponse.json({ error: 'Already following' }, { status: 400 });
    }

    // Add to following list
    await adminDb
      .collection('users')
      .doc(userId)
      .collection('following')
      .doc(targetUserId)
      .set({
        followedAt: FieldValue.serverTimestamp(),
      });

    // Add to followers list
    await adminDb
      .collection('users')
      .doc(targetUserId)
      .collection('followers')
      .doc(userId)
      .set({
        followedAt: FieldValue.serverTimestamp(),
      });

    // Send notification
    const followerDoc = await adminDb.collection('users').doc(userId).get();
    const followerData = followerDoc.exists ? followerDoc.data() : null;
    const followerName = followerData?.displayName || followerData?.handle || 'Someone';

    await notifyUserFollowed(targetUserId, followerName, userId);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error following user:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to follow user' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    if (!adminDb) {
      return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
    }

    const userId = await getUserIdFromAuthHeader(req);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const targetUserId = searchParams.get('targetUserId');
    if (!targetUserId) {
      return NextResponse.json({ error: 'Missing targetUserId' }, { status: 400 });
    }

    // Remove from following list
    await adminDb
      .collection('users')
      .doc(userId)
      .collection('following')
      .doc(targetUserId)
      .delete();

    // Remove from followers list
    await adminDb
      .collection('users')
      .doc(targetUserId)
      .collection('followers')
      .doc(userId)
      .delete();

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error unfollowing user:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to unfollow user' },
      { status: 500 }
    );
  }
}

export const runtime = 'nodejs';

