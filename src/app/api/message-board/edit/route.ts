import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { getUserIdFromAuthHeader } from '@/lib/api/auth';
import { extractHashtags, extractMentions, detectMediaEmbeds } from '@/lib/messageBoardUtils';

export async function POST(req: NextRequest) {
  try {
    if (!adminDb) {
      return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
    }

    const userId = await getUserIdFromAuthHeader(req);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { postId, content } = await req.json();
    if (!postId || !content) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Get post
    const postDoc = await adminDb.collection('messageBoardPosts').doc(postId).get();
    if (!postDoc.exists) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    const postData = postDoc.data();
    if (postData.authorId !== userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Check if post is within 24 hours (editing time limit)
    const createdAt = postData.createdAt?.toDate();
    if (createdAt) {
      const hoursSinceCreation = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60);
      if (hoursSinceCreation > 24) {
        return NextResponse.json({ error: 'Post can only be edited within 24 hours' }, { status: 400 });
      }
    }

    // Extract hashtags, mentions, and media embeds
    const hashtags = extractHashtags(content);
    const mentions = extractMentions(content);
    const mediaEmbeds = detectMediaEmbeds(content);

    // Get current edit history
    const editHistory = postData.editHistory || [];
    
    // Add current version to history (use Timestamp.now() instead of FieldValue.serverTimestamp() for arrays)
    editHistory.push({
      content: postData.content,
      hashtags: postData.hashtags || null,
      mentions: postData.mentions || null,
      editedAt: Timestamp.now(),
    });

    // Update post
    await adminDb.collection('messageBoardPosts').doc(postId).update({
      content: content.trim(),
      hashtags: hashtags.length > 0 ? hashtags : null,
      mentions: mentions.length > 0 ? mentions : null,
      mediaEmbeds: mediaEmbeds.length > 0 ? mediaEmbeds : null,
      editHistory,
      updatedAt: FieldValue.serverTimestamp(),
      edited: true,
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error editing post:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to edit post' },
      { status: 500 }
    );
  }
}

export const runtime = 'nodejs';

