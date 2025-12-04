"use client";
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, doc, getDoc, deleteDoc, where, getDocs } from 'firebase/firestore';
import { db, firebaseReady } from '@/lib/firebaseClient';
import Link from 'next/link';
import { ReactionPicker } from './ReactionPicker';

type MediaItem = {
  url: string;
  type: 'image' | 'video';
};

type MessageBoardPostData = {
  id: string;
  authorId: string;
  content: string;
  projectId?: string;
  mediaUrls?: string[] | null; // Legacy support
  media?: MediaItem[] | null; // New format with types
  createdAt: any;
  updatedAt?: any;
  authorProfile?: {
    displayName?: string;
    photoURL?: string;
    handle?: string;
  };
  project?: {
    id: string;
    title: string;
    imageUrl?: string;
    description?: string;
  };
};

type Comment = {
  id: string;
  authorId: string;
  content: string;
  createdAt: any;
  parentCommentId?: string;
  authorProfile?: {
    displayName?: string;
    photoURL?: string;
    handle?: string;
  };
  replies?: Comment[];
};

type Reaction = {
  id: string;
  userId: string;
  emoji: string;
  createdAt: any;
  userProfile?: {
    displayName?: string;
    photoURL?: string;
  };
};

export function MessageBoardPost({ post }: { post: MessageBoardPostData }) {
  const { user } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [showComments, setShowComments] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [loadingComments, setLoadingComments] = useState(false);
  const [submittingComment, setSubmittingComment] = useState(false);
  const [userReactions, setUserReactions] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!firebaseReady || !db || !post.id) return;

    // Load comments
    const commentsQuery = query(
      collection(db, 'messageBoardPosts', post.id, 'comments'),
      orderBy('createdAt', 'asc')
    );

    const unsubscribeComments = onSnapshot(
      commentsQuery,
      async (snapshot) => {
        setLoadingComments(true);
        const commentsData: Comment[] = [];
        
        for (const commentDoc of snapshot.docs) {
          const commentData = commentDoc.data();
          const comment: Comment = {
            id: commentDoc.id,
            authorId: commentData.authorId,
            content: commentData.content,
            createdAt: commentData.createdAt,
            parentCommentId: commentData.parentCommentId,
          };

          // Fetch author profile
          try {
            const authorDoc = await getDoc(doc(db, 'users', commentData.authorId));
            if (authorDoc.exists()) {
              const authorData = authorDoc.data();
              comment.authorProfile = {
                displayName: authorData.displayName,
                photoURL: authorData.photoURL,
                handle: authorData.handle,
              };
            }
          } catch (error) {
            console.error('Error fetching comment author:', error);
          }

          commentsData.push(comment);
        }

        // Organize comments and replies
        const topLevelComments = commentsData.filter(c => !c.parentCommentId);
        const repliesMap = new Map<string, Comment[]>();
        
        commentsData.forEach(comment => {
          if (comment.parentCommentId) {
            if (!repliesMap.has(comment.parentCommentId)) {
              repliesMap.set(comment.parentCommentId, []);
            }
            repliesMap.get(comment.parentCommentId)!.push(comment);
          }
        });

        const organizedComments = topLevelComments.map(comment => ({
          ...comment,
          replies: repliesMap.get(comment.id) || [],
        }));

        setComments(organizedComments);
        setLoadingComments(false);
      },
      (error) => {
        console.error('Error loading comments:', error);
        setLoadingComments(false);
      }
    );

    // Load reactions
    const reactionsQuery = query(
      collection(db, 'messageBoardPosts', post.id, 'reactions'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribeReactions = onSnapshot(
      reactionsQuery,
      async (snapshot) => {
        const reactionsData: Reaction[] = [];
        
        for (const reactionDoc of snapshot.docs) {
          const reactionData = reactionDoc.data();
          const reaction: Reaction = {
            id: reactionDoc.id,
            userId: reactionData.userId,
            emoji: reactionData.emoji,
            createdAt: reactionData.createdAt,
          };

          // Fetch user profile
          try {
            const userDoc = await getDoc(doc(db, 'users', reactionData.userId));
            if (userDoc.exists()) {
              const userData = userDoc.data();
              reaction.userProfile = {
                displayName: userData.displayName,
                photoURL: userData.photoURL,
              };
            }
          } catch (error) {
            console.error('Error fetching reaction user:', error);
          }

          reactionsData.push(reaction);
        }

        setReactions(reactionsData);
        
        // Track user's reactions
        if (user) {
          const userReactionIds = new Set(
            reactionsData.filter(r => r.userId === user.uid).map(r => r.emoji)
          );
          setUserReactions(userReactionIds);
        }
      },
      (error) => {
        console.error('Error loading reactions:', error);
      }
    );

    return () => {
      unsubscribeComments();
      unsubscribeReactions();
    };
  }, [post.id, user]);

  const handleAddComment = async () => {
    if (!user || !firebaseReady || !db || !newComment.trim()) return;

    setSubmittingComment(true);
    try {
      await addDoc(collection(db, 'messageBoardPosts', post.id, 'comments'), {
        authorId: user.uid,
        content: newComment.trim(),
        createdAt: serverTimestamp(),
      });

      setNewComment('');
      setShowComments(true);
    } catch (error) {
      console.error('Error adding comment:', error);
      alert('Failed to add comment. Please try again.');
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleAddReply = async (parentCommentId: string) => {
    if (!user || !firebaseReady || !db || !replyContent.trim()) return;

    try {
      await addDoc(collection(db, 'messageBoardPosts', post.id, 'comments'), {
        authorId: user.uid,
        content: replyContent.trim(),
        parentCommentId,
        createdAt: serverTimestamp(),
      });

      setReplyContent('');
      setReplyingTo(null);
    } catch (error) {
      console.error('Error adding reply:', error);
      alert('Failed to add reply. Please try again.');
    }
  };

  const handleReaction = async (emoji: string) => {
    if (!user || !firebaseReady || !db) return;

    try {
      // Check if user already reacted with this emoji
      const existingReactionsQuery = query(
        collection(db, 'messageBoardPosts', post.id, 'reactions'),
        where('userId', '==', user.uid),
        where('emoji', '==', emoji)
      );
      const existingSnap = await getDocs(existingReactionsQuery);

      if (!existingSnap.empty) {
        // Remove reaction
        const reactionDoc = existingSnap.docs[0];
        await deleteDoc(reactionDoc.ref);
      } else {
        // Add reaction
        await addDoc(collection(db, 'messageBoardPosts', post.id, 'reactions'), {
          userId: user.uid,
          emoji,
          createdAt: serverTimestamp(),
        });
      }
    } catch (error) {
      console.error('Error toggling reaction:', error);
    }
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'Just now';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const getInitials = (name?: string, email?: string) => {
    if (name) return name.charAt(0).toUpperCase();
    if (email) return email.charAt(0).toUpperCase();
    return '?';
  };

  const authorDisplayName = post.authorProfile?.displayName || 'Unknown User';
  const authorPhotoURL = post.authorProfile?.photoURL;
  const authorHandle = post.authorProfile?.handle;

  // Group reactions by emoji
  const reactionsByEmoji = reactions.reduce((acc, reaction) => {
    if (!acc[reaction.emoji]) {
      acc[reaction.emoji] = [];
    }
    acc[reaction.emoji].push(reaction);
    return acc;
  }, {} as Record<string, Reaction[]>);

  return (
    <div className="bg-gradient-to-br from-neutral-900/50 to-neutral-950/50 border border-neutral-800 rounded-xl p-4 sm:p-6 hover:border-neutral-700 transition-all duration-200">
      {/* Post Header */}
      <div className="flex items-start gap-3 sm:gap-4 mb-4">
        <Link href={`/profile/${post.authorId}`} className="flex-shrink-0">
          {authorPhotoURL ? (
            <img
              src={authorPhotoURL}
              alt={authorDisplayName}
              className="w-12 h-12 rounded-full border-2 border-neutral-700 hover:border-ccaBlue transition"
            />
          ) : (
            <div className="w-12 h-12 rounded-full bg-ccaBlue flex items-center justify-center text-white font-semibold text-lg border-2 border-neutral-700 hover:border-ccaBlue transition">
              {getInitials(authorDisplayName)}
            </div>
          )}
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Link href={`/profile/${post.authorId}`} className="font-semibold text-white hover:text-ccaBlue transition">
              {authorDisplayName}
            </Link>
            {authorHandle && (
              <span className="text-neutral-400 text-sm">@{authorHandle}</span>
            )}
            <span className="text-neutral-500 text-sm">·</span>
            <span className="text-neutral-400 text-sm">{formatDate(post.createdAt)}</span>
          </div>
        </div>
      </div>

      {/* Project Link */}
      {post.project && (
        <Link href={`/profile/${post.authorId}?project=${post.project.id}`} className="block mb-4 p-4 bg-neutral-800/50 border border-neutral-700 rounded-lg hover:border-ccaBlue/50 transition group">
          <div className="flex items-center gap-4">
            {post.project.imageUrl && (
              <img
                src={post.project.imageUrl}
                alt={post.project.title}
                className="w-20 h-20 rounded-lg object-cover flex-shrink-0"
              />
            )}
            <div className="flex-1 min-w-0">
              <div className="text-xs text-ccaBlue font-semibold mb-1">Linked Project</div>
              <div className="text-white font-semibold group-hover:text-ccaBlue transition truncate">
                {post.project.title}
              </div>
              {post.project.description && (
                <div className="text-neutral-400 text-sm mt-1 line-clamp-2">
                  {post.project.description}
                </div>
              )}
            </div>
            <svg className="w-5 h-5 text-neutral-400 group-hover:text-ccaBlue transition" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </Link>
      )}

      {/* Post Content */}
      {post.content && (
        <div className="text-white mb-4 whitespace-pre-wrap break-words">
          {post.content}
        </div>
      )}

      {/* Media Display */}
      {((post.media && post.media.length > 0) || (post.mediaUrls && post.mediaUrls.length > 0)) && (
        <div className="mb-4">
          {(() => {
            // Use new format if available, otherwise fall back to legacy format
            const mediaItems: MediaItem[] = post.media || 
              (post.mediaUrls || []).map(url => {
                // Try to detect type from URL for legacy posts
                const urlLower = decodeURIComponent(url).toLowerCase();
                const hasImageExt = urlLower.match(/\.(jpg|jpeg|png|gif|webp|bmp|svg)$/);
                const hasVideoExt = urlLower.match(/\.(mp4|webm|mov|avi|mkv|flv|wmv|m4v)$/);
                return {
                  url,
                  type: hasVideoExt ? 'video' : hasImageExt ? 'image' : 'image' // Default to image if unclear
                } as MediaItem;
              });
            
            return (
              <div className={`grid gap-3 ${
                mediaItems.length === 1 ? 'grid-cols-1' :
                mediaItems.length === 2 ? 'grid-cols-2' :
                'grid-cols-2 sm:grid-cols-3'
              }`}>
                {mediaItems.map((item, index) => (
                  <div key={index} className="relative group">
                    {item.type === 'image' ? (
                      <div className="relative">
                        <img
                          src={item.url}
                          alt={`Post image ${index + 1}`}
                          className="w-full h-auto rounded-lg border border-neutral-700 cursor-pointer hover:opacity-90 transition max-h-96 object-contain bg-neutral-900"
                          onClick={() => window.open(item.url, '_blank')}
                          loading="lazy"
                          onError={(e) => {
                            // If image fails to load, try as video
                            console.error('Image failed to load, trying as video:', item.url);
                            const video = document.createElement('video');
                            video.src = item.url;
                            video.controls = true;
                            video.className = 'w-full h-auto rounded-lg border border-neutral-700 max-h-96';
                            e.currentTarget.parentElement?.replaceChild(video, e.currentTarget);
                          }}
                        />
                        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition">
                          <div className="bg-black/50 rounded px-2 py-1 text-white text-xs">
                            Click to view full size
                          </div>
                        </div>
                      </div>
                    ) : (
                      <video
                        src={item.url}
                        controls
                        className="w-full h-auto rounded-lg border border-neutral-700 max-h-96"
                        preload="metadata"
                      >
                        Your browser does not support the video tag.
                      </video>
                    )}
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      )}

      {/* Reactions */}
      {Object.keys(reactionsByEmoji).length > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-4 pb-4 border-b border-neutral-800">
          {Object.entries(reactionsByEmoji).map(([emoji, emojiReactions]) => (
            <button
              key={emoji}
              onClick={() => handleReaction(emoji)}
              className={`px-3 py-1.5 rounded-full border transition-all ${
                userReactions.has(emoji)
                  ? 'bg-ccaBlue/20 border-ccaBlue text-white'
                  : 'bg-neutral-800/50 border-neutral-700 text-neutral-300 hover:border-neutral-600'
              }`}
            >
              <span className="text-lg mr-1.5">{emoji}</span>
              <span className="text-sm font-medium">{emojiReactions.length}</span>
            </button>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-4 pt-4 border-t border-neutral-800">
        <ReactionPicker
          onSelect={(emoji) => handleReaction(emoji)}
          userReactions={userReactions}
        />
        <button
          onClick={() => setShowComments(!showComments)}
          className="flex items-center gap-2 text-neutral-400 hover:text-white transition"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          <span className="text-sm font-medium">
            {comments.length} {comments.length === 1 ? 'comment' : 'comments'}
          </span>
        </button>
      </div>

      {/* Comments Section */}
      {showComments && (
        <div className="mt-6 pt-6 border-t border-neutral-800">
          {/* Comment Input */}
          {user && (
            <div className="mb-6">
              <div className="flex items-start gap-3">
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt={user.displayName || 'You'}
                    className="w-10 h-10 rounded-full border border-neutral-700"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-ccaBlue flex items-center justify-center text-white font-semibold text-sm">
                    {getInitials(user.displayName || undefined, user.email || undefined)}
                  </div>
                )}
                <div className="flex-1">
                  <textarea
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Write a comment..."
                    rows={3}
                    className="w-full px-4 py-2.5 bg-neutral-800 border border-neutral-700 rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-ccaBlue focus:border-transparent resize-none"
                  />
                  <div className="flex items-center justify-end gap-2 mt-2">
                    <button
                      onClick={() => setNewComment('')}
                      className="px-4 py-1.5 text-neutral-400 hover:text-white transition text-sm"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleAddComment}
                      disabled={submittingComment || !newComment.trim()}
                      className="px-4 py-1.5 bg-ccaBlue hover:bg-ccaBlue/90 text-white rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                    >
                      {submittingComment ? 'Posting...' : 'Post'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Comments List */}
          {loadingComments ? (
            <div className="space-y-4">
              {[1, 2].map((i) => (
                <div key={i} className="flex gap-3 animate-pulse">
                  <div className="w-10 h-10 rounded-full bg-neutral-800" />
                  <div className="flex-1">
                    <div className="h-4 bg-neutral-800 rounded w-1/3 mb-2" />
                    <div className="h-4 bg-neutral-800 rounded w-full" />
                  </div>
                </div>
              ))}
            </div>
          ) : comments.length === 0 ? (
            <div className="text-center py-8 text-neutral-400">
              No comments yet. Be the first to comment!
            </div>
          ) : (
            <div className="space-y-4">
              {comments.map((comment) => (
                <CommentItem
                  key={comment.id}
                  comment={comment}
                  postId={post.id}
                  onReply={(commentId) => {
                    setReplyingTo(commentId);
                    setReplyContent('');
                  }}
                  onCancel={() => {
                    setReplyingTo(null);
                    setReplyContent('');
                  }}
                  replyingTo={replyingTo}
                  replyContent={replyContent}
                  onReplyChange={setReplyContent}
                  onReplySubmit={handleAddReply}
                  formatDate={formatDate}
                  getInitials={getInitials}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CommentItem({
  comment,
  postId,
  onReply,
  onCancel,
  replyingTo,
  replyContent,
  onReplyChange,
  onReplySubmit,
  formatDate,
  getInitials,
}: {
  comment: Comment;
  postId: string;
  onReply: (commentId: string) => void;
  onCancel: () => void;
  replyingTo: string | null;
  replyContent: string;
  onReplyChange: (content: string) => void;
  onReplySubmit: (parentCommentId: string) => void;
  formatDate: (timestamp: any) => string;
  getInitials: (name?: string, email?: string) => string;
}) {
  const { user } = useAuth();
  const authorDisplayName = comment.authorProfile?.displayName || 'Unknown User';
  const authorPhotoURL = comment.authorProfile?.photoURL;
  const authorHandle = comment.authorProfile?.handle;

  return (
    <div>
      <div className="flex items-start gap-3">
        <Link href={`/profile/${comment.authorId}`} className="flex-shrink-0">
          {authorPhotoURL ? (
            <img
              src={authorPhotoURL}
              alt={authorDisplayName}
              className="w-10 h-10 rounded-full border border-neutral-700 hover:border-ccaBlue transition"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-ccaBlue flex items-center justify-center text-white font-semibold text-sm border border-neutral-700 hover:border-ccaBlue transition">
              {getInitials(authorDisplayName)}
            </div>
          )}
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <Link href={`/profile/${comment.authorId}`} className="font-semibold text-white hover:text-ccaBlue transition text-sm">
              {authorDisplayName}
            </Link>
            {authorHandle && (
              <span className="text-neutral-400 text-xs">@{authorHandle}</span>
            )}
            <span className="text-neutral-500 text-xs">·</span>
            <span className="text-neutral-400 text-xs">{formatDate(comment.createdAt)}</span>
          </div>
          <div className="text-white text-sm whitespace-pre-wrap break-words mb-2">
            {comment.content}
          </div>
          {user && (
            <button
              onClick={() => onReply(comment.id)}
              className="text-xs text-neutral-400 hover:text-ccaBlue transition"
            >
              Reply
            </button>
          )}
        </div>
      </div>

      {/* Reply Input */}
      {replyingTo === comment.id && user && (
        <div className="ml-12 mt-3 flex items-start gap-3">
          {user.photoURL ? (
            <img
              src={user.photoURL}
              alt={user.displayName || 'You'}
              className="w-8 h-8 rounded-full border border-neutral-700"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-ccaBlue flex items-center justify-center text-white font-semibold text-xs">
              {getInitials(user.displayName || undefined, user.email || undefined)}
            </div>
          )}
          <div className="flex-1">
            <textarea
              value={replyContent}
              onChange={(e) => onReplyChange(e.target.value)}
              placeholder="Write a reply..."
              rows={2}
              className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-ccaBlue focus:border-transparent resize-none text-sm"
            />
            <div className="flex items-center justify-end gap-2 mt-2">
              <button
                onClick={onCancel}
                className="px-3 py-1 text-neutral-400 hover:text-white transition text-xs"
              >
                Cancel
              </button>
              <button
                onClick={() => onReplySubmit(comment.id)}
                disabled={!replyContent.trim()}
                className="px-3 py-1 bg-ccaBlue hover:bg-ccaBlue/90 text-white rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed text-xs font-medium"
              >
                Reply
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Replies */}
      {comment.replies && comment.replies.length > 0 && (
        <div className="ml-12 mt-3 space-y-3 border-l-2 border-neutral-800 pl-4">
          {comment.replies.map((reply) => (
            <div key={reply.id} className="flex items-start gap-3">
              <Link href={`/profile/${reply.authorId}`} className="flex-shrink-0">
                {reply.authorProfile?.photoURL ? (
                  <img
                    src={reply.authorProfile.photoURL}
                    alt={reply.authorProfile.displayName || 'Unknown'}
                    className="w-8 h-8 rounded-full border border-neutral-700 hover:border-ccaBlue transition"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-ccaBlue flex items-center justify-center text-white font-semibold text-xs border border-neutral-700 hover:border-ccaBlue transition">
                    {getInitials(reply.authorProfile?.displayName)}
                  </div>
                )}
              </Link>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <Link href={`/profile/${reply.authorId}`} className="font-semibold text-white hover:text-ccaBlue transition text-xs">
                    {reply.authorProfile?.displayName || 'Unknown User'}
                  </Link>
                  {reply.authorProfile?.handle && (
                    <span className="text-neutral-400 text-xs">@{reply.authorProfile.handle}</span>
                  )}
                  <span className="text-neutral-500 text-xs">·</span>
                  <span className="text-neutral-400 text-xs">{formatDate(reply.createdAt)}</span>
                </div>
                <div className="text-white text-xs whitespace-pre-wrap break-words">
                  {reply.content}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

