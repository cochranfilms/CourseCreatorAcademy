"use client";
import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, doc, getDoc, getDocs, where, limit as firestoreLimit } from 'firebase/firestore';
import { db, firebaseReady } from '@/lib/firebaseClient';
import Link from 'next/link';
import { MessageBoardPost } from '@/components/MessageBoardPost';
import { CreatePostModal } from '@/components/CreatePostModal';

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

export default function MessageBoardPage() {
  const { user } = useAuth();
  const [posts, setPosts] = useState<MessageBoardPostData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    if (!firebaseReady || !db || !user) {
      setLoading(false);
      return;
    }

    // Fetch all posts ordered by creation date
    const postsQuery = query(
      collection(db, 'messageBoardPosts'),
      orderBy('createdAt', 'desc'),
      firestoreLimit(50)
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
        ) : (
          <div className="space-y-4 sm:space-y-6">
            {posts.map((post) => (
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

