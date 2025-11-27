"use client";
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { db, firebaseReady, storage } from '@/lib/firebaseClient';
import { collection, getDocs, query, orderBy, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { ref as storageRef, uploadBytesResumable, getDownloadURL } from 'firebase/storage';

type Video = {
  id: string;
  title?: string;
  description?: string;
  muxPlaybackId?: string | null;
  muxAnimatedGifUrl?: string | null;
  isSample?: boolean;
  createdAt?: any;
  durationSec?: number;
};

type Props = {
  creatorId: string;
  featuredPlaybackId?: string;
  featuredTitle?: string;
  featuredDescription?: string;
  onFeaturedChange: (playbackId: string, title: string, description: string, durationSec?: number) => void;
};

export function VideoManager({ creatorId, featuredPlaybackId, featuredTitle, featuredDescription, onFeaturedChange }: Props) {
  const { user } = useAuth();
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadDescription, setUploadDescription] = useState('');
  const [uploadIsSample, setUploadIsSample] = useState(true);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [editingVideo, setEditingVideo] = useState<Video | null>(null);
  const [showUploadForm, setShowUploadForm] = useState(false);

  // Load videos
  useEffect(() => {
    const loadVideos = async () => {
      if (!firebaseReady || !db) return;
      setLoading(true);
      try {
        let canonicalId = creatorId;
        try {
          const res = await fetch(`/api/legacy/creators/${encodeURIComponent(creatorId)}?soft=1`, { cache: 'no-store' });
          const json = await res.json().catch(() => ({}));
          const creator = json?.creator;
          canonicalId = creator?.id || creator?.kitSlug || creatorId;
        } catch {}

        const vref = collection(db, `legacy_creators/${canonicalId}/videos`);
        const q = query(vref, orderBy('createdAt', 'desc'));
        const snap = await getDocs(q);
        const list = snap.docs.map((d) => {
          const data = d.data() as any;
          return {
            id: d.id,
            title: data?.title || 'Untitled',
            description: data?.description || '',
            muxPlaybackId: data?.muxPlaybackId || null,
            muxAnimatedGifUrl: data?.muxAnimatedGifUrl || null,
            isSample: Boolean(data?.isSample),
            createdAt: data?.createdAt || null,
            durationSec: data?.durationSec || 0,
          };
        });
        setVideos(list);
      } catch (error) {
        console.error('Error loading videos:', error);
      } finally {
        setLoading(false);
      }
    };
    loadVideos();
  }, [creatorId]);

  const handleUpload = async () => {
    if (!user || !uploadFile || !firebaseReady || !storage) return;

    setUploading(true);
    setUploadProgress(0);
    try {
      const path = `legacy-uploads/${user.uid}/${Date.now()}_${uploadFile.name.replace(/\s+/g, '_')}`;
      const sref = storageRef(storage, path);
      const task = uploadBytesResumable(sref, uploadFile, { contentType: uploadFile.type || 'video/mp4' });

      await new Promise<void>((resolve, reject) => {
        task.on(
          'state_changed',
          (snap) => {
            const p = (snap.bytesTransferred / snap.totalBytes) * 100;
            setUploadProgress(p);
          },
          reject,
          resolve
        );
      });

      const downloadURL = await getDownloadURL(task.snapshot.ref);

      const res = await fetch('/api/legacy/upload-from-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creatorId: user.uid,
          title: uploadTitle || 'Untitled Video',
          description: uploadDescription,
          isSample: uploadIsSample,
          fileUrl: downloadURL,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Upload failed');

      // Reload videos
      const vref = collection(db, `legacy_creators/${creatorId}/videos`);
      const q = query(vref, orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      const list = snap.docs.map((d) => {
        const data = d.data() as any;
        return {
          id: d.id,
          title: data?.title || 'Untitled',
          description: data?.description || '',
          muxPlaybackId: data?.muxPlaybackId || null,
          muxAnimatedGifUrl: data?.muxAnimatedGifUrl || null,
          isSample: Boolean(data?.isSample),
          createdAt: data?.createdAt || null,
          durationSec: data?.durationSec || 0,
        };
      });
      setVideos(list);

      setUploadFile(null);
      setUploadTitle('');
      setUploadDescription('');
      setShowUploadForm(false);
    } catch (error: any) {
      alert(error?.message || 'Upload failed');
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleDelete = async (videoId: string) => {
    if (!confirm('Delete this video? This will remove it from your profile.')) return;
    if (!user || !firebaseReady || !db) return;

    try {
      const idt = await user.getIdToken();
      const res = await fetch(`/api/legacy/videos/${encodeURIComponent(videoId)}?deleteMux=1`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${idt}` },
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Delete failed');
      setVideos((prev) => prev.filter((v) => v.id !== videoId));
    } catch (error: any) {
      alert(error?.message || 'Failed to delete');
    }
  };

  const handleSetFeatured = (video: Video) => {
    if (video.muxPlaybackId) {
      onFeaturedChange(
        video.muxPlaybackId,
        video.title || 'Featured Video',
        video.description || '',
        video.durationSec
      );
    }
  };

  const handleUpdateVideo = async (videoId: string, updates: { title?: string; description?: string; isSample?: boolean }) => {
    if (!firebaseReady || !db) return;
    try {
      let canonicalId = creatorId;
      try {
        const res = await fetch(`/api/legacy/creators/${encodeURIComponent(creatorId)}?soft=1`, { cache: 'no-store' });
        const json = await res.json().catch(() => ({}));
        const creator = json?.creator;
        canonicalId = creator?.id || creator?.kitSlug || creatorId;
      } catch {}

      const videoRef = doc(db, `legacy_creators/${canonicalId}/videos`, videoId);
      await updateDoc(videoRef, updates);
      setVideos((prev) =>
        prev.map((v) => (v.id === videoId ? { ...v, ...updates } : v))
      );
      setEditingVideo(null);
    } catch (error) {
      alert('Failed to update video');
    }
  };

  if (loading) {
    return <div className="text-neutral-400">Loading videos...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold text-white">Video Management</h2>
        <button
          onClick={() => setShowUploadForm(!showUploadForm)}
          className="px-4 py-2 bg-white text-black border-2 border-ccaBlue hover:bg-neutral-100 rounded-lg font-medium"
        >
          {showUploadForm ? 'Cancel' : '+ Upload Video'}
        </button>
      </div>

      {/* Featured Video Section */}
      <div className="border border-neutral-800 rounded-lg p-4 bg-neutral-900/50">
        <h3 className="text-lg font-medium text-white mb-3">Featured Video</h3>
        {featuredPlaybackId ? (
          <div className="flex items-center gap-4">
            <div className="w-32 h-20 bg-neutral-800 rounded overflow-hidden">
              <img
                src={`https://image.mux.com/${featuredPlaybackId}/thumbnail.jpg?time=1&width=320`}
                alt={featuredTitle || 'Featured'}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="flex-1">
              <div className="text-white font-medium">{featuredTitle || 'Featured Video'}</div>
              <div className="text-sm text-neutral-400">{featuredDescription || 'No description'}</div>
            </div>
          </div>
        ) : (
          <p className="text-neutral-400 text-sm">No featured video selected. Select a video below to feature it.</p>
        )}
      </div>

      {/* Upload Form */}
      {showUploadForm && (
        <div className="border border-neutral-800 rounded-lg p-4 bg-neutral-900/50">
          <h3 className="text-lg font-medium text-white mb-4">Upload New Video</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-neutral-300 mb-1">Title</label>
              <input
                type="text"
                value={uploadTitle}
                onChange={(e) => setUploadTitle(e.target.value)}
                className="w-full bg-neutral-900 border border-neutral-800 px-3 py-2 rounded text-white"
                placeholder="Video Title"
              />
            </div>
            <div>
              <label className="block text-sm text-neutral-300 mb-1">Description</label>
              <textarea
                value={uploadDescription}
                onChange={(e) => setUploadDescription(e.target.value)}
                className="w-full bg-neutral-900 border border-neutral-800 px-3 py-2 rounded text-white"
                rows={3}
                placeholder="Video description"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                id="uploadIsSample"
                type="checkbox"
                checked={uploadIsSample}
                onChange={(e) => setUploadIsSample(e.target.checked)}
              />
              <label htmlFor="uploadIsSample" className="text-sm text-neutral-300">
                Public (visible to everyone)
              </label>
            </div>
            <div>
              <label className="block text-sm text-neutral-300 mb-1">Video File</label>
              <input
                type="file"
                accept="video/*"
                onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                className="w-full text-sm text-neutral-300"
              />
            </div>
            <button
              onClick={handleUpload}
              disabled={!uploadFile || uploading}
              className="px-4 py-2 bg-white text-black border-2 border-ccaBlue hover:bg-neutral-100 rounded-lg font-medium disabled:opacity-50"
            >
              {uploading ? `Uploading... ${Math.round(uploadProgress)}%` : 'Upload Video'}
            </button>
            {uploadProgress > 0 && uploadProgress < 100 && (
              <div className="h-2 bg-neutral-900 rounded-full overflow-hidden">
                <div className="h-full bg-ccaBlue transition-all" style={{ width: `${uploadProgress}%` }} />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Video List */}
      <div>
        <h3 className="text-lg font-medium text-white mb-4">Your Videos</h3>
        {videos.length === 0 ? (
          <div className="text-neutral-400 text-center py-8">No videos uploaded yet.</div>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {videos.map((video) => (
              <div
                key={video.id}
                className="border border-neutral-800 rounded-lg p-4 bg-neutral-900/50"
              >
                <div className="flex gap-4">
                  <div className="w-32 h-20 bg-neutral-800 rounded overflow-hidden flex-shrink-0">
                    {video.muxAnimatedGifUrl ? (
                      <img src={video.muxAnimatedGifUrl} alt={video.title} className="w-full h-full object-cover" />
                    ) : video.muxPlaybackId ? (
                      <img
                        src={`https://image.mux.com/${video.muxPlaybackId}/thumbnail.jpg?time=1&width=320`}
                        alt={video.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-neutral-600">
                        <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                        </svg>
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    {editingVideo?.id === video.id ? (
                      <div className="space-y-2">
                        <input
                          type="text"
                          value={editingVideo.title || ''}
                          onChange={(e) => setEditingVideo({ ...editingVideo, title: e.target.value })}
                          className="w-full bg-neutral-900 border border-neutral-800 px-2 py-1 rounded text-white text-sm"
                          placeholder="Title"
                        />
                        <textarea
                          value={editingVideo.description || ''}
                          onChange={(e) => setEditingVideo({ ...editingVideo, description: e.target.value })}
                          className="w-full bg-neutral-900 border border-neutral-800 px-2 py-1 rounded text-white text-sm"
                          rows={2}
                          placeholder="Description"
                        />
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={editingVideo.isSample || false}
                            onChange={(e) => setEditingVideo({ ...editingVideo, isSample: e.target.checked })}
                          />
                          <label className="text-xs text-neutral-300">Public</label>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleUpdateVideo(video.id, {
                              title: editingVideo.title,
                              description: editingVideo.description,
                              isSample: editingVideo.isSample,
                            })}
                            className="px-2 py-1 bg-ccaBlue text-white text-xs rounded"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setEditingVideo(null)}
                            className="px-2 py-1 bg-neutral-800 text-neutral-300 text-xs rounded"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="text-white font-medium truncate">{video.title}</div>
                        <div className="text-xs text-neutral-400 mb-2">
                          {video.isSample ? 'Public' : 'Exclusive (Legacy+)'}
                        </div>
                        <div className="flex gap-2 flex-wrap">
                          {video.muxPlaybackId && video.muxPlaybackId !== featuredPlaybackId && (
                            <button
                              onClick={() => handleSetFeatured(video)}
                              className="px-2 py-1 bg-ccaBlue/20 text-ccaBlue text-xs rounded border border-ccaBlue/30"
                            >
                              Set Featured
                            </button>
                          )}
                          {video.muxPlaybackId === featuredPlaybackId && (
                            <span className="px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded border border-green-500/30">
                              Featured
                            </span>
                          )}
                          <button
                            onClick={() => setEditingVideo(video)}
                            className="px-2 py-1 bg-neutral-800 text-neutral-300 text-xs rounded"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(video.id)}
                            className="px-2 py-1 bg-red-500/20 text-red-400 text-xs rounded border border-red-500/30"
                          >
                            Delete
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

