"use client";
import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, doc, getDoc, getDocs, where, limit as firestoreLimit } from 'firebase/firestore';
import { db, firebaseReady } from '@/lib/firebaseClient';
import Link from 'next/link';
import { MessageBoardPost } from '@/components/MessageBoardPost';
import { CreatePostModal } from '@/components/CreatePostModal';
import { POST_CATEGORIES } from '@/lib/messageBoardUtils';
import { useSearchParams } from 'next/navigation';

type MediaItem = {
  url: string;
  type: 'image' | 'video';
};

type MessageBoardPostData = {
  id: string;
  authorId: string;
  content: string;
  projectId?: string;
  category?: string;
  hashtags?: string[] | null;
  mentions?: string[] | null;
  mediaEmbeds?: Array<{ type: 'youtube' | 'vimeo' | 'instagram' | 'url'; url: string; embedId?: string }> | null;
  attachedOpportunityId?: string | null;
  attachedListingId?: string | null;
  attachedOpportunity?: {
    id: string;
    title: string;
    company: string;
    location: string;
    type: string;
    amount?: number;
  };
  attachedListing?: {
    id: string;
    title: string;
    price: number;
    condition: string;
    images?: string[];
  };
  mediaUrls?: string[] | null; // Legacy support
  media?: MediaItem[] | null; // New format with types
  createdAt: any;
  updatedAt?: any;
  edited?: boolean;
  editHistory?: any[];
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

export default function MessageBoardPage() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const [posts, setPosts] = useState<MessageBoardPostData[]>([]);
  const [filteredPosts, setFilteredPosts] = useState<MessageBoardPostData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [sortBy, setSortBy] = useState<'newest' | 'most-reactions' | 'most-comments'>('newest');
  const [showFollowedOnly, setShowFollowedOnly] = useState(false);
  const [followedUserIds, setFollowedUserIds] = useState<Set<string>>(new Set());

  // Load followed users
  useEffect(() => {
    if (!user || !firebaseReady || !db) return;
    const loadFollowed = async () => {
      try {
        const followingSnapshot = await getDocs(collection(db, 'users', user.uid, 'following'));
        const followed = new Set(followingSnapshot.docs.map(doc => doc.id));
        setFollowedUserIds(followed);
      } catch (error) {
        console.error('Error loading followed users:', error);
      }
    };
    loadFollowed();
  }, [user]);

  // Get URL params
  useEffect(() => {
    const hashtag = searchParams?.get('hashtag');
    const mention = searchParams?.get('mention');
    if (hashtag) {
      setSearchQuery(`#${hashtag}`);
    }
    if (mention) {
      setSearchQuery(`@${mention}`);
    }
  }, [searchParams]);

  useEffect(() => {
    if (!firebaseReady || !db || !user) {
      setLoading(false);
      return;
    }

    // Fetch all posts ordered by creation date
    const postsQuery = query(
      collection(db, 'messageBoardPosts'),
      orderBy('createdAt', 'desc'),
      firestoreLimit(100)
    );

    const unsubscribe = onSnapshot(
      postsQuery,
      async (snapshot) => {
        const postsData: MessageBoardPostData[] = [];
        
        for (const postDoc of snapshot.docs) {
          const postData = postDoc.data();
          const post: MessageBoardPostData = {
            id: postDoc.id,
            authorId: postData.authorId,
            content: postData.content,
            projectId: postData.projectId,
            category: postData.category,
            hashtags: postData.hashtags || null,
            mentions: postData.mentions || null,
            mediaEmbeds: postData.mediaEmbeds || null,
            attachedOpportunityId: postData.attachedOpportunityId || null,
            attachedListingId: postData.attachedListingId || null,
            edited: postData.edited || false,
            editHistory: postData.editHistory || [],
            mediaUrls: postData.mediaUrls || null, // Legacy support
            media: postData.media || null, // New format
            createdAt: postData.createdAt,
            updatedAt: postData.updatedAt,
          };

          // Fetch author profile
          try {
            const authorDoc = await getDoc(doc(db, 'users', postData.authorId));
            if (authorDoc.exists()) {
              const authorData = authorDoc.data();
              post.authorProfile = {
                displayName: authorData.displayName,
                photoURL: authorData.photoURL,
                handle: authorData.handle,
              };
            }
          } catch (error) {
            console.error('Error fetching author profile:', error);
          }

          // Fetch project if linked
          if (postData.projectId) {
            try {
              const projectDoc = await getDoc(doc(db, 'projects', postData.projectId));
              if (projectDoc.exists()) {
                const projectData = projectDoc.data();
                post.project = {
                  id: projectDoc.id,
                  title: projectData.title,
                  imageUrl: projectData.imageUrl,
                  description: projectData.description,
                };
              }
            } catch (error) {
              console.error('Error fetching project:', error);
            }
          }

          // Fetch attached opportunity
          if (postData.attachedOpportunityId) {
            try {
              const oppDoc = await getDoc(doc(db, 'opportunities', postData.attachedOpportunityId));
              if (oppDoc.exists()) {
                const oppData = oppDoc.data();
                post.attachedOpportunity = {
                  id: oppDoc.id,
                  title: oppData.title,
                  company: oppData.company,
                  location: oppData.location,
                  type: oppData.type,
                  amount: oppData.amount,
                };
              }
            } catch (error) {
              console.error('Error fetching opportunity:', error);
            }
          }

          // Fetch attached listing
          if (postData.attachedListingId) {
            try {
              const listingDoc = await getDoc(doc(db, 'listings', postData.attachedListingId));
              if (listingDoc.exists()) {
                const listingData = listingDoc.data();
                post.attachedListing = {
                  id: listingDoc.id,
                  title: listingData.title,
                  price: listingData.price,
                  condition: listingData.condition,
                  images: listingData.images,
                };
              }
            } catch (error) {
              console.error('Error fetching listing:', error);
            }
          }

          postsData.push(post);
        }

        setPosts(postsData);
        setLoading(false);
      },
      (error) => {
        console.error('Error fetching posts:', error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user]);

  // Filter and sort posts
  useEffect(() => {
    let filtered = [...posts];

    // Filter by followed users
    if (showFollowedOnly) {
      filtered = filtered.filter(post => followedUserIds.has(post.authorId));
    }

    // Filter by category
    if (selectedCategory) {
      filtered = filtered.filter(post => post.category === selectedCategory);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(post => {
        const contentMatch = post.content.toLowerCase().includes(query);
        const authorMatch = post.authorProfile?.displayName?.toLowerCase().includes(query) ||
          post.authorProfile?.handle?.toLowerCase().includes(query);
        const hashtagMatch = post.hashtags?.some(tag => tag.includes(query.replace('#', '')));
        const mentionMatch = post.mentions?.some(mention => mention.includes(query.replace('@', '')));
        return contentMatch || authorMatch || hashtagMatch || mentionMatch;
      });
    }

    // Sort posts
    if (sortBy === 'most-reactions' || sortBy === 'most-comments') {
      // Note: This requires fetching reaction/comment counts, simplified here
      // In production, you'd want to store these counts on the post document
      filtered.sort((a, b) => {
        // For now, just sort by date
        const aDate = a.createdAt?.toDate?.() || new Date(a.createdAt);
        const bDate = b.createdAt?.toDate?.() || new Date(b.createdAt);
        return bDate.getTime() - aDate.getTime();
      });
    } else {
      // Sort by newest
      filtered.sort((a, b) => {
        const aDate = a.createdAt?.toDate?.() || new Date(a.createdAt);
        const bDate = b.createdAt?.toDate?.() || new Date(b.createdAt);
        return bDate.getTime() - aDate.getTime();
      });
    }

    setFilteredPosts(filtered);
  }, [posts, searchQuery, selectedCategory, sortBy, showFollowedOnly, followedUserIds]);

  return (
    <ProtectedRoute>
      <main className="min-h-screen max-w-5xl mx-auto px-3 sm:px-4 md:px-6 py-4 sm:py-6 md:py-8 w-full overflow-x-hidden">
        {/* Header */}
        <div className="mb-6 sm:mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-white mb-2">
                Message Board
              </h1>
              <p className="text-neutral-400 text-sm sm:text-base">
                Share your projects, discuss your experiences, and connect with the community
              </p>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 sm:px-6 py-2 sm:py-3 bg-ccaBlue hover:bg-ccaBlue/90 text-white font-semibold rounded-lg transition-all duration-200 flex items-center gap-2 shadow-lg shadow-ccaBlue/30 hover:shadow-ccaBlue/50 transform hover:scale-105"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span className="hidden sm:inline">New Post</span>
            </button>
          </div>

          {/* Search and Filters */}
          <div className="space-y-4 mt-6">
            {/* Search Bar */}
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search posts, authors, hashtags, mentions..."
                className="w-full px-4 py-3 pl-10 bg-neutral-800 border border-neutral-700 rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-ccaBlue focus:border-transparent"
              />
              <svg className="w-5 h-5 text-neutral-400 absolute left-3 top-1/2 transform -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Category Filter */}
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="px-4 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-ccaBlue"
              >
                <option value="">All Categories</option>
                {POST_CATEGORIES.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.icon} {cat.label}
                  </option>
                ))}
              </select>

              {/* Sort */}
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="px-4 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-ccaBlue"
              >
                <option value="newest">Newest First</option>
                <option value="most-reactions">Most Reactions</option>
                <option value="most-comments">Most Comments</option>
              </select>

              {/* Followed Only */}
              {user && (
                <label className="flex items-center gap-2 px-4 py-2 bg-neutral-800 border border-neutral-700 rounded-lg cursor-pointer hover:border-neutral-600 transition">
                  <input
                    type="checkbox"
                    checked={showFollowedOnly}
                    onChange={(e) => setShowFollowedOnly(e.target.checked)}
                    className="w-4 h-4 text-ccaBlue rounded focus:ring-ccaBlue"
                  />
                  <span className="text-white text-sm">Followed Only</span>
                </label>
              )}

              {/* Clear Filters */}
              {(searchQuery || selectedCategory || showFollowedOnly) && (
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedCategory('');
                    setShowFollowedOnly(false);
                  }}
                  className="px-4 py-2 text-neutral-400 hover:text-white transition text-sm"
                >
                  Clear Filters
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Posts List */}
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-neutral-900/50 border border-neutral-800 rounded-xl p-6 animate-pulse">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 rounded-full bg-neutral-800" />
                  <div className="flex-1">
                    <div className="h-4 bg-neutral-800 rounded w-1/3 mb-2" />
                    <div className="h-3 bg-neutral-800 rounded w-1/4" />
                  </div>
                </div>
                <div className="h-4 bg-neutral-800 rounded w-full mb-2" />
                <div className="h-4 bg-neutral-800 rounded w-3/4" />
              </div>
            ))}
          </div>
        ) : posts.length === 0 ? (
          <div className="bg-gradient-to-br from-neutral-900/50 to-neutral-950/50 border border-neutral-800 rounded-xl p-8 sm:p-12 text-center">
            <div className="text-6xl mb-4">💬</div>
            <h2 className="text-2xl font-bold text-white mb-2">No posts yet</h2>
            <p className="text-neutral-400 mb-6">Be the first to share something with the community!</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-6 py-3 bg-ccaBlue hover:bg-ccaBlue/90 text-white font-semibold rounded-lg transition-all duration-200 inline-flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Create First Post
            </button>
          </div>
        ) : filteredPosts.length === 0 ? (
          <div className="bg-gradient-to-br from-neutral-900/50 to-neutral-950/50 border border-neutral-800 rounded-xl p-8 sm:p-12 text-center">
            <div className="text-6xl mb-4">🔍</div>
            <h2 className="text-2xl font-bold text-white mb-2">No posts found</h2>
            <p className="text-neutral-400 mb-6">Try adjusting your filters or search query</p>
            {(searchQuery || selectedCategory || showFollowedOnly) && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSelectedCategory('');
                  setShowFollowedOnly(false);
                }}
                className="px-6 py-3 bg-ccaBlue hover:bg-ccaBlue/90 text-white font-semibold rounded-lg transition-all duration-200 inline-flex items-center gap-2"
              >
                Clear Filters
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4 sm:space-y-6">
            {filteredPosts.map((post) => (
              <MessageBoardPost key={post.id} post={post} />
            ))}
          </div>
        )}

        {/* Create Post Modal */}
        {showCreateModal && (
          <CreatePostModal
            isOpen={showCreateModal}
            onClose={() => setShowCreateModal(false)}
            onSuccess={() => setShowCreateModal(false)}
          />
        )}
      </main>
    </ProtectedRoute>
  );
}

