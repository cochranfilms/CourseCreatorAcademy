"use client";
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { collection, addDoc, serverTimestamp, query, where, getDocs } from 'firebase/firestore';
import { db, firebaseReady, storage } from '@/lib/firebaseClient';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';

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

type MediaFile = {
  file: File;
  preview: string;
  type: 'image' | 'video';
  uploadProgress?: number;
  url?: string;
};

export function CreatePostModal({ isOpen, onClose, onSuccess }: CreatePostModalProps) {
  const { user } = useAuth();
  const [content, setContent] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [projects, setProjects] = useState<Project[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([]);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && user && firebaseReady && db) {
      loadProjects();
    } else if (!isOpen) {
      // Reset form when modal closes
      setContent('');
      setSelectedProjectId('');
      setMediaFiles([]);
      setError(null);
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

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    if (!user || !firebaseReady || !storage) {
      setError('Please sign in to upload media');
      return;
    }

    // Validate files
    const validFiles: MediaFile[] = [];
    for (const file of files) {
      const isImage = file.type.startsWith('image/');
      const isVideo = file.type.startsWith('video/');
      
      if (!isImage && !isVideo) {
        setError(`${file.name} is not an image or video file`);
        continue;
      }

      const maxSize = isImage ? 10 * 1024 * 1024 : 100 * 1024 * 1024; // 10MB for images, 100MB for videos
      if (file.size > maxSize) {
        setError(`${file.name} is too large (max ${isImage ? '10MB' : '100MB'})`);
        continue;
      }

      // Create preview
      const preview = isImage 
        ? URL.createObjectURL(file)
        : URL.createObjectURL(file);

      validFiles.push({
        file,
        preview,
        type: isImage ? 'image' : 'video',
      });
    }

    if (validFiles.length > 0) {
      setMediaFiles(prev => [...prev, ...validFiles]);
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeMedia = (index: number) => {
    const file = mediaFiles[index];
    if (file.preview && file.preview.startsWith('blob:')) {
      URL.revokeObjectURL(file.preview);
    }
    setMediaFiles(prev => prev.filter((_, i) => i !== index));
  };

  const uploadMediaFiles = async (): Promise<string[]> => {
    if (mediaFiles.length === 0) return [];

    if (!user || !firebaseReady || !storage) {
      throw new Error('Firebase is not configured');
    }

    setUploadingMedia(true);
    const uploadPromises = mediaFiles.map(async (mediaFile, index) => {
      // If already uploaded, return the URL
      if (mediaFile.url) return mediaFile.url;

      const fileId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const storagePath = `message-board-media/${user.uid}/${fileId}_${mediaFile.file.name.replace(/\s+/g, '_')}`;
      const storageRef = ref(storage, storagePath);

      return new Promise<string>((resolve, reject) => {
        const uploadTask = uploadBytesResumable(storageRef, mediaFile.file, {
          contentType: mediaFile.file.type,
        });

        uploadTask.on(
          'state_changed',
          (snapshot) => {
            const percent = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            setMediaFiles(prev => {
              const updated = [...prev];
              updated[index] = { ...updated[index], uploadProgress: percent };
              return updated;
            });
          },
          (error) => {
            console.error('Upload error:', error);
            reject(new Error(`Failed to upload ${mediaFile.file.name}`));
          },
          async () => {
            try {
              const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
              setMediaFiles(prev => {
                const updated = [...prev];
                updated[index] = { ...updated[index], url: downloadURL };
                return updated;
              });
              resolve(downloadURL);
            } catch (error) {
              reject(error);
            }
          }
        );
      });
    });

    try {
      const urls = await Promise.all(uploadPromises);
      setUploadingMedia(false);
      return urls;
    } catch (error) {
      setUploadingMedia(false);
      throw error;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user || !firebaseReady || !db) {
      setError('Please sign in to create a post');
      return;
    }

    if (!content.trim() && mediaFiles.length === 0) {
      setError('Please enter some content or upload media for your post');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      // Upload media files first
      let mediaUrls: string[] = [];
      if (mediaFiles.length > 0) {
        mediaUrls = await uploadMediaFiles();
      }

      await addDoc(collection(db, 'messageBoardPosts'), {
        authorId: user.uid,
        content: content.trim() || '',
        projectId: selectedProjectId || null,
        mediaUrls: mediaUrls.length > 0 ? mediaUrls : null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // Clean up preview URLs
      mediaFiles.forEach(file => {
        if (file.preview && file.preview.startsWith('blob:')) {
          URL.revokeObjectURL(file.preview);
        }
      });

      // Reset form
      setContent('');
      setSelectedProjectId('');
      setMediaFiles([]);
      onSuccess();
    } catch (error: any) {
      console.error('Error creating post:', error);
      setError(error.message || 'Failed to create post. Please try again.');
    } finally {
      setSubmitting(false);
      setUploadingMedia(false);
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

          {/* Media Upload */}
          <div>
            <label className="block text-sm font-semibold text-white mb-2">
              Add Photos or Videos (Optional)
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*"
              multiple
              onChange={handleFileSelect}
              className="hidden"
              id="media-upload"
            />
            <label
              htmlFor="media-upload"
              className="block w-full px-4 py-3 bg-neutral-800 border border-neutral-700 rounded-lg text-white hover:bg-neutral-700 cursor-pointer transition text-center"
            >
              <svg className="w-6 h-6 mx-auto mb-2 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span className="text-sm">Click to upload photos or videos</span>
              <span className="text-xs text-neutral-500 block mt-1">Images: max 10MB • Videos: max 100MB</span>
            </label>

            {/* Media Previews */}
            {mediaFiles.length > 0 && (
              <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
                {mediaFiles.map((mediaFile, index) => (
                  <div key={index} className="relative group">
                    {mediaFile.type === 'image' ? (
                      <img
                        src={mediaFile.preview}
                        alt={`Preview ${index + 1}`}
                        className="w-full h-32 object-cover rounded-lg border border-neutral-700"
                      />
                    ) : (
                      <video
                        src={mediaFile.preview}
                        className="w-full h-32 object-cover rounded-lg border border-neutral-700"
                        controls={false}
                      />
                    )}
                    {mediaFile.uploadProgress !== undefined && mediaFile.uploadProgress < 100 && (
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-lg">
                        <div className="text-white text-xs font-semibold">
                          {Math.round(mediaFile.uploadProgress)}%
                        </div>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => removeMedia(index)}
                      className="absolute top-2 right-2 w-6 h-6 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

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
              disabled={submitting || uploadingMedia || (!content.trim() && mediaFiles.length === 0)}
              className="px-6 py-2.5 bg-ccaBlue hover:bg-ccaBlue/90 text-white font-semibold rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {submitting || uploadingMedia ? (
                <>
                  <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  {uploadingMedia ? 'Uploading...' : 'Posting...'}
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

