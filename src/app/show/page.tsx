"use client";

import { useEffect, useState, useRef } from 'react';
import MuxPlayer from '@mux/mux-player-react';
import { doc, getDoc } from 'firebase/firestore';
import { db, firebaseReady } from '@/lib/firebaseClient';
import { getMuxAnimatedGifUrl } from '@/lib/muxThumbnails';

interface EpisodeData {
  assetId: string;
  playbackId: string | null;
  title: string;
  description?: string;
  durationSec: number;
  durationFormatted: string;
  dateFormatted: string;
  createdAt: string;
  status: string;
  passthrough: any;
}

export default function ShowPage() {
  const [episode, setEpisode] = useState<EpisodeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [videoPlaying, setVideoPlaying] = useState(false);
  const showPlayerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    async function fetchEpisode() {
      try {
        let assetId = '';

        // First, try to get assetId from Firestore (allows updates without redeploying)
        if (firebaseReady && db) {
          try {
            const configDoc = await getDoc(doc(db, 'config', 'show'));
            if (configDoc.exists()) {
              const configData = configDoc.data();
              assetId = configData.muxAssetId || '';
            }
          } catch (firestoreError) {
            console.log('Could not fetch from Firestore, falling back to env var');
          }
        }

        // Fall back to environment variable if Firestore doesn't have it
        if (!assetId) {
          assetId = process.env.NEXT_PUBLIC_SHOW_ASSET_ID || '';
        }
        
        if (!assetId) {
          setError('Show asset ID not configured. Please set it in Firestore (config/show.muxAssetId) or NEXT_PUBLIC_SHOW_ASSET_ID environment variable.');
          setLoading(false);
          return;
        }

        const response = await fetch(`/api/show/episode?assetId=${encodeURIComponent(assetId)}`);
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || 'Failed to fetch episode');
        }

        const data = await response.json();
        console.log('Received episode data:', {
          title: data.title,
          description: data.description,
          hasTitle: !!data.title,
          hasDescription: !!data.description,
          fullData: data
        });
        setEpisode(data);
      } catch (err: any) {
        console.error('Error fetching episode:', err);
        setError(err.message || 'Failed to load episode');
      } finally {
        setLoading(false);
      }
    }

    fetchEpisode();
  }, []);

  // Control video element opacity to show/hide it while keeping controls visible
  useEffect(() => {
    if (!showPlayerRef.current || !episode?.playbackId) return;
    
    const updateVideoOpacity = () => {
      const video = showPlayerRef.current?.querySelector('video') as HTMLVideoElement;
      if (video) {
        video.style.opacity = videoPlaying ? '1' : '0';
        video.style.transition = 'opacity 0.3s';
      }
    };
    
    // Try immediately
    updateVideoOpacity();
    
    // Also try after a short delay in case MuxPlayer hasn't rendered yet
    const timeout = setTimeout(updateVideoOpacity, 100);
    
    return () => clearTimeout(timeout);
  }, [videoPlaying, episode?.playbackId]);

  return (
    <main className="min-h-screen max-w-7xl mx-auto px-6 py-8">
      <h1 className="text-3xl md:text-4xl font-bold">CCA Show</h1>
      <p className="text-neutral-400 mt-2">Insights, interviews and inspiration for creators.</p>

      {loading ? (
        <div className="mt-8 rounded-2xl overflow-hidden border border-neutral-800 bg-neutral-950 p-4">
          <div className="aspect-video bg-neutral-800 rounded-xl flex items-center justify-center">
            <div className="text-neutral-400">Loading episode...</div>
          </div>
        </div>
      ) : error ? (
        <div className="mt-8 rounded-2xl overflow-hidden border border-red-500/50 bg-neutral-950 p-4">
          <div className="aspect-video bg-neutral-800 rounded-xl flex items-center justify-center">
              <div className="text-red-400 text-center px-4">
              {error}
              <div className="text-sm text-neutral-500 mt-2">
                To configure, create a document in Firestore: <code className="bg-neutral-900 px-2 py-1 rounded">config/show</code> with field <code className="bg-neutral-900 px-2 py-1 rounded">muxAssetId</code>, or set NEXT_PUBLIC_SHOW_ASSET_ID environment variable.
              </div>
            </div>
          </div>
        </div>
      ) : episode && episode.playbackId ? (
        <div className="mt-8 max-w-4xl mx-auto rounded-2xl overflow-hidden border border-neutral-800 bg-neutral-950 p-4">
          <div className="aspect-video bg-neutral-800 rounded-xl overflow-hidden relative">
            {/* Animated GIF preview - always visible until video plays */}
            <div className="absolute inset-0 z-0">
              <img
                src={getMuxAnimatedGifUrl(episode.playbackId, 640, 10, 13, 15)}
                alt={`${episode.title} preview`}
                className={`w-full h-full object-cover transition-opacity ${videoPlaying ? 'opacity-0' : 'opacity-100'}`}
                style={{ pointerEvents: 'none' }}
              />
            </div>
            <div ref={showPlayerRef} className="relative z-10 w-full h-full">
              <MuxPlayer
                playbackId={episode.playbackId}
                streamType="on-demand"
                primaryColor="#3B82F6"
                className="w-full h-full"
                playsInline
                preload="metadata"
                onPlay={() => setVideoPlaying(true)}
                // @ts-ignore
                preferMse
                // @ts-ignore
                maxResolution="540p"
                // @ts-ignore
                disablePictureInPicture
                // @ts-ignore
                autoPictureInPicture={false}
              />
            </div>
          </div>
          <div className="mt-4 text-xl font-semibold">{episode.title}</div>
          <div className="text-neutral-400 text-sm">
            {episode.durationFormatted} • {episode.dateFormatted}
          </div>
          {episode.description && (
            <div className="mt-4 text-neutral-300 text-sm leading-relaxed">
              {episode.description}
            </div>
          )}
        </div>
      ) : (
        <div className="mt-8 rounded-2xl overflow-hidden border border-neutral-800 bg-neutral-950 p-4">
          <div className="aspect-video bg-neutral-800 rounded-xl flex items-center justify-center">
            <div className="text-neutral-400">Video not available</div>
          </div>
        </div>
      )}
    </main>
  );
}


