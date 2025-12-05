import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import { getUserIdFromAuthHeader } from '@/lib/api/auth';
import { FieldValue } from 'firebase-admin/firestore';

// POST /api/users/[id]/block
// Block a user
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const blockerId = await getUserIdFromAuthHeader(req);
    if (!blockerId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: blockedUserId } = await params;
    if (!blockedUserId || blockedUserId === blockerId) {
      return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 });
    }

    if (!adminDb) {
      return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
    }

    // Add to blocked subcollection
    await adminDb
      .collection('users')
      .doc(blockerId)
      .collection('blocked')
      .doc(blockedUserId)
      .set({
        blockedAt: FieldValue.serverTimestamp(),
      });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error blocking user:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to block user' },
      { status: 500 }
    );
  }
}

// DELETE /api/users/[id]/block
// Unblock a user
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const blockerId = await getUserIdFromAuthHeader(req);
    if (!blockerId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: blockedUserId } = await params;
    if (!blockedUserId) {
      return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 });
    }

    if (!adminDb) {
      return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
    }

    // Remove from blocked subcollection
    await adminDb
      .collection('users')
      .doc(blockerId)
      .collection('blocked')
      .doc(blockedUserId)
      .delete();

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error unblocking user:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to unblock user' },
      { status: 500 }
    );
  }
}

