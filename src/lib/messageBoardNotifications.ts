// Notification helpers for message board features
import { createNotification } from './notifications';

export type MessageBoardNotificationType = 
  | 'post_comment'
  | 'post_reply'
  | 'post_reaction'
  | 'post_mention'
  | 'user_followed';

/**
 * Create notification for post comment
 */
export async function notifyPostComment(
  postAuthorId: string,
  commentAuthorName: string,
  postId: string,
  commentId: string
): Promise<string | null> {
  if (postAuthorId === commentAuthorName) return null; // Don't notify self
  
  return createNotification(postAuthorId, {
    type: 'message_received', // Reusing existing type
    title: 'New Comment',
    message: `${commentAuthorName} commented on your post`,
    actionUrl: `/message-board#post-${postId}`,
    actionLabel: 'View Post',
    metadata: { postId, commentId, type: 'post_comment' },
  });
}

/**
 * Create notification for comment reply
 */
export async function notifyCommentReply(
  commentAuthorId: string,
  replyAuthorName: string,
  postId: string,
  commentId: string,
  replyId: string
): Promise<string | null> {
  if (commentAuthorId === replyAuthorName) return null;
  
  return createNotification(commentAuthorId, {
    type: 'message_received',
    title: 'New Reply',
    message: `${replyAuthorName} replied to your comment`,
    actionUrl: `/message-board#post-${postId}`,
    actionLabel: 'View Reply',
    metadata: { postId, commentId, replyId, type: 'post_reply' },
  });
}

/**
 * Create notification for post mention
 */
export async function notifyPostMention(
  mentionedUserId: string,
  mentionerName: string,
  postId: string
): Promise<string | null> {
  return createNotification(mentionedUserId, {
    type: 'message_received',
    title: 'You were mentioned',
    message: `${mentionerName} mentioned you in a post`,
    actionUrl: `/message-board#post-${postId}`,
    actionLabel: 'View Post',
    metadata: { postId, type: 'post_mention' },
  });
}

/**
 * Create notification for user follow
 */
export async function notifyUserFollowed(
  followedUserId: string,
  followerName: string,
  followerId: string
): Promise<string | null> {
  return createNotification(followedUserId, {
    type: 'message_received',
    title: 'New Follower',
    message: `${followerName} started following you`,
    actionUrl: `/profile/${followerId}`,
    actionLabel: 'View Profile',
    metadata: { followerId, type: 'user_followed' },
  });
}

