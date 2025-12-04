import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';
import { getUserIdFromAuthHeader } from '@/lib/api/auth';

export async function POST(req: NextRequest) {
  try {
    if (!adminDb) {
      return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
    }

    const userId = await getUserIdFromAuthHeader(req);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { postId } = await req.json();
    if (!postId) {
      return NextResponse.json({ error: 'Missing postId' }, { status: 400 });
    }

    // Check if already bookmarked
    const bookmarkDoc = await adminDb
      .collection('users')
      .doc(userId)
      .collection('bookmarkedPosts')
      .doc(postId)
      .get();

    if (bookmarkDoc.exists) {
      return NextResponse.json({ error: 'Already bookmarked' }, { status: 400 });
    }

    // Add bookmark
    await adminDb
      .collection('users')
      .doc(userId)
      .collection('bookmarkedPosts')
      .doc(postId)
      .set({
        bookmarkedAt: FieldValue.serverTimestamp(),
      });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error bookmarking post:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to bookmark post' },
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
    const postId = searchParams.get('postId');
    if (!postId) {
      return NextResponse.json({ error: 'Missing postId' }, { status: 400 });
    }

    // Remove bookmark
    await adminDb
      .collection('users')
      .doc(userId)
      .collection('bookmarkedPosts')
      .doc(postId)
      .delete();

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error removing bookmark:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to remove bookmark' },
      { status: 500 }
    );
  }
}

export const runtime = 'nodejs';

