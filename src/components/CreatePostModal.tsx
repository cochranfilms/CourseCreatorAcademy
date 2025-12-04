"use client";
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { collection, addDoc, serverTimestamp, query, where, getDocs } from 'firebase/firestore';
import { db, firebaseReady } from '@/lib/firebaseClient';

type Project = {
  id: string;
  title: string;
  imageUrl?: string;
};

type CreatePostModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
};

export function CreatePostModal({ isOpen, onClose, onSuccess }: CreatePostModalProps) {
  const { user } = useAuth();
  const [content, setContent] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [projects, setProjects] = useState<Project[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && user && firebaseReady && db) {
      loadProjects();
    }
  }, [isOpen, user]);

  const loadProjects = async () => {
    if (!user || !firebaseReady || !db) return;
    
    setLoadingProjects(true);
    try {
      const projectsQuery = query(
        collection(db, 'projects'),
        where('creatorId', '==', user.uid)
      );
      const snapshot = await getDocs(projectsQuery);
      const projectsData = snapshot.docs.map((doc) => ({
        id: doc.id,
        title: doc.data().title,
        imageUrl: doc.data().imageUrl,
      }));
      setProjects(projectsData);
    } catch (error) {
      console.error('Error loading projects:', error);
    } finally {
      setLoadingProjects(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user || !firebaseReady || !db) {
      setError('Please sign in to create a post');
      return;
    }

    if (!content.trim()) {
      setError('Please enter some content for your post');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await addDoc(collection(db, 'messageBoardPosts'), {
        authorId: user.uid,
        content: content.trim(),
        projectId: selectedProjectId || null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // Reset form
      setContent('');
      setSelectedProjectId('');
      onSuccess();
    } catch (error: any) {
      console.error('Error creating post:', error);
      setError('Failed to create post. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-gradient-to-br from-neutral-900 to-neutral-950 border border-neutral-800 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="sticky top-0 bg-neutral-900/95 backdrop-blur-sm border-b border-neutral-800 px-6 py-4 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-white">Create New Post</h2>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-white transition p-2 hover:bg-neutral-800 rounded-lg"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          {/* Project Selection */}
          {projects.length > 0 && (
            <div>
              <label className="block text-sm font-semibold text-white mb-2">
                Link a Project (Optional)
              </label>
              <select
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                className="w-full px-4 py-2.5 bg-neutral-800 border border-neutral-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-ccaBlue focus:border-transparent"
              >
                <option value="">No project linked</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.title}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Content */}
          <div>
            <label className="block text-sm font-semibold text-white mb-2">
              What's on your mind?
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Share your project, discuss your onset experience, ask questions, or start a conversation..."
              rows={8}
              className="w-full px-4 py-3 bg-neutral-800 border border-neutral-700 rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-ccaBlue focus:border-transparent resize-none"
            />
            <div className="mt-2 text-sm text-neutral-400 text-right">
              {content.length} characters
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-neutral-800">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2.5 text-neutral-300 hover:text-white transition font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !content.trim()}
              className="px-6 py-2.5 bg-ccaBlue hover:bg-ccaBlue/90 text-white font-semibold rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {submitting ? (
                <>
                  <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Posting...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                  Post
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

