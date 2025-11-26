"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { collection, query, getDocs, orderBy } from 'firebase/firestore';
import { db, firebaseReady } from '@/lib/firebaseClient';

type AssetCategory = 'All Packs' | 'LUTs & Presets' | 'Overlays & Transitions' | 'SFX & Plugins' | 'Templates';
type SubCategory = 'Overlays' | 'Transitions' | 'SFX' | 'Plugins' | 'LUTs' | 'Presets' | null;

interface Asset {
  id: string;
  title: string;
  category: AssetCategory;
  thumbnailUrl?: string;
  storagePath?: string;
  muxPlaybackId?: string;
  fileType?: string;
  description?: string;
}

interface SoundEffect {
  id: string;
  assetId: string;
  assetTitle: string;
  fileName: string;
  storagePath: string;
  fileType: string;
  duration: number;
}

interface Overlay {
  id: string;
  assetId: string;
  assetTitle: string;
  fileName: string;
  storagePath: string;
  fileType: string;
}

const categories: AssetCategory[] = ['All Packs', 'LUTs & Presets', 'Overlays & Transitions', 'SFX & Plugins', 'Templates'];

/**
 * Gets subcategory from storage path
 */
function getSubCategory(asset: Asset): SubCategory {
  if (!asset.storagePath) return null;
  
  const path = asset.storagePath.toLowerCase();
  const title = asset.title.toLowerCase();
  
  // Check storage path first
  if (path.includes('/overlays/')) return 'Overlays';
  if (path.includes('/transitions/')) return 'Transitions';
  if (path.includes('/sfx/')) return 'SFX';
  if (path.includes('/plugins/')) return 'Plugins';
  if (path.includes('/luts/')) return 'LUTs';
  if (path.includes('/presets/')) return 'Presets';
  
  // Fallback to title keywords
  if (title.includes('overlay') || title.includes('flare') || title.includes('light leak')) return 'Overlays';
  if (title.includes('transition')) return 'Transitions';
  if (title.includes('sfx') || title.includes('sound') || title.includes('audio')) return 'SFX';
  if (title.includes('plugin')) return 'Plugins';
  if (title.includes('lut')) return 'LUTs';
  if (title.includes('preset')) return 'Presets';
  
  return null;
}

/**
 * Format duration in seconds to MM:SS
 */
function formatDuration(seconds: number): string {
  if (!seconds || seconds === 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Overlay Player Component - Shows looping video preview in 16:9 format
 */
function OverlayPlayer({ overlay }: { overlay: Overlay }) {
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [videoLoaded, setVideoLoaded] = useState(false);
  const [isVideo, setIsVideo] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    // Load public media URL from proxy endpoint
    const loadMediaUrl = async () => {
      try {
        const response = await fetch(`/api/assets/overlay-video-proxy?assetId=${overlay.assetId}&overlayId=${overlay.id}`);
        if (response.ok) {
          const data = await response.json();
          setMediaUrl(data.videoUrl);
          // Check if file is a video based on extension
          const fileType = data.fileType || overlay.fileType || '';
          const videoExtensions = ['mov', 'mp4', 'avi', 'mkv', 'webm', 'm4v'];
          setIsVideo(videoExtensions.includes(fileType.toLowerCase()));
        }
      } catch (error) {
        console.error('Error loading media URL:', error);
      }
    };
    loadMediaUrl();
  }, [overlay]);

  // Setup video element and auto-play when URL is loaded (only for videos)
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !mediaUrl || !isVideo) return;

    // Set video attributes
    video.loop = true;
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';

    // Handle video loaded event
    const handleLoadedData = () => {
      setVideoLoaded(true);
      video.play().catch(err => {
        console.error('Error auto-playing video:', err);
      });
    };

    // Handle video can play event
    const handleCanPlay = () => {
      video.play().catch(err => {
        console.error('Error auto-playing video:', err);
      });
    };

    video.addEventListener('loadeddata', handleLoadedData);
    video.addEventListener('canplay', handleCanPlay);

    // Try to play immediately if video is already loaded
    if (video.readyState >= 2) {
      video.play().catch(err => {
        console.error('Error auto-playing video:', err);
      });
    }

    return () => {
      video.removeEventListener('loadeddata', handleLoadedData);
      video.removeEventListener('canplay', handleCanPlay);
    };
  }, [mediaUrl, isVideo]);

  const handleDownload = async (e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }
    if (downloading) return;
    
    setDownloading(true);
    try {
      const response = await fetch(`/api/assets/overlay-download?assetId=${overlay.assetId}&overlayId=${overlay.id}`);
      if (!response.ok) throw new Error('Failed to get download URL');
      const data = await response.json();
      
      const link = document.createElement('a');
      link.href = data.downloadUrl;
      link.download = overlay.fileName;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Download error:', error);
      alert('Failed to download overlay. Please try again.');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div 
      className="border border-neutral-700 bg-black rounded-lg overflow-hidden hover:border-neutral-500 transition-colors cursor-pointer group"
      onClick={() => handleDownload()}
    >
      {/* 16:9 Media Preview */}
      <div className="aspect-video bg-gradient-to-br from-neutral-900 to-black relative overflow-hidden">
        {mediaUrl ? (
          isVideo ? (
            <video
              ref={videoRef}
              src={mediaUrl}
              className="w-full h-full object-cover"
              playsInline
              muted
              loop
              preload="auto"
              onError={(e) => {
                console.error('Video error:', e);
                const video = e.currentTarget;
                console.error('Video error details:', {
                  error: video.error,
                  networkState: video.networkState,
                  readyState: video.readyState,
                  src: video.src
                });
              }}
            />
          ) : (
            <img
              src={mediaUrl}
              alt={overlay.fileName}
              className="w-full h-full object-cover"
              onError={(e) => {
                console.error('Image error:', e);
              }}
            />
          )
        ) : (
          <div className="w-full h-full flex items-center justify-center text-ccaBlue/50">
            <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </div>
        )}
        {/* Overlay on hover */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
          {downloading ? (
            <div className="text-white text-sm">Downloading...</div>
          ) : (
            <div className="opacity-0 group-hover:opacity-100 transition-opacity text-white text-sm font-medium">
              Click to Download
            </div>
          )}
        </div>
      </div>
      
      {/* Info Section */}
      <div className="p-3 bg-black">
        <div className="font-semibold text-white text-sm truncate">{overlay.fileName.replace(/\.[^/.]+$/, '')}</div>
        <div className="text-xs text-neutral-400 mt-1 truncate">By {overlay.assetTitle}</div>
        
        {/* Action Buttons */}
        <div className="flex items-center justify-between mt-3">
          <span className="inline-block px-2 py-1 bg-neutral-900 text-neutral-400 text-xs rounded border border-neutral-800">
            overlay
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDownload(e);
              }}
              disabled={downloading}
              className="w-8 h-8 flex items-center justify-center text-neutral-400 hover:text-ccaBlue transition-colors"
              title="Download"
            >
              {downloading ? (
                <svg className="w-4 h-4 animate-spin text-ccaBlue" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
              )}
            </button>
            <span className="text-neutral-500 text-xs">1</span>
            <button
              className="w-8 h-8 flex items-center justify-center text-neutral-400 hover:text-pink-500 transition-colors"
              title="Favorite"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Sound Effect Player Component
 */
function SoundEffectPlayer({ soundEffect, asset }: { soundEffect: SoundEffect; asset: Asset }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(soundEffect.duration || 0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [hoveredBarIndex, setHoveredBarIndex] = useState<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const waveformRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    // Load audio URL when component mounts
    const loadAudioUrl = async () => {
      try {
        const response = await fetch(`/api/assets/sound-effect-download?assetId=${soundEffect.assetId}&soundEffectId=${soundEffect.id}`);
        if (response.ok) {
          const data = await response.json();
          setAudioUrl(data.downloadUrl);
        }
      } catch (error) {
        console.error('Error loading audio URL:', error);
      }
    };
    loadAudioUrl();
  }, [soundEffect]);

  // Smooth time update using requestAnimationFrame
  useEffect(() => {
    if (!audioRef.current || !audioUrl || isDragging) return;

    const audio = audioRef.current;
    
    const updateTime = () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
      rafRef.current = requestAnimationFrame(() => {
        setCurrentTime(audio.currentTime);
      });
    };
    
    const updateDuration = () => setDuration(audio.duration || soundEffect.duration || 0);
    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener('timeupdate', updateTime);
    audio.addEventListener('loadedmetadata', updateDuration);
    audio.addEventListener('ended', handleEnded);

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
      audio.removeEventListener('timeupdate', updateTime);
      audio.removeEventListener('loadedmetadata', updateDuration);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [audioUrl, soundEffect.duration, isDragging]);

  const togglePlay = useCallback(() => {
    if (!audioRef.current || !audioUrl) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
    }
  }, [isPlaying, audioUrl]);

  // Waveform scrubbing
  const handleWaveformClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current || !duration || !waveformRef.current) return;
    
    const rect = waveformRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, x / rect.width));
    const newTime = percentage * duration;
    
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  }, [duration]);

  const handleWaveformMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!waveformRef.current || !duration) return;
    const rect = waveformRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, x / rect.width));
    const barIndex = Math.floor(percentage * 50);
    setHoveredBarIndex(barIndex);
  }, [duration]);

  // Generate waveform bars with memoization
  const waveformBars = useMemo(() => {
    return Array.from({ length: 50 }).map((_, i) => {
      // Use a seeded random based on the sound effect ID for consistent waveform
      const seed = soundEffect.id.charCodeAt(0) + i;
      const random = Math.sin(seed) * 0.5 + 0.5;
      const barHeight = 30 + (random * 70); // Between 30% and 100%
      return { index: i, height: barHeight };
    });
  }, [soundEffect.id]);

  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (downloading) return;
    
    setDownloading(true);
    try {
      // Use proxy endpoint that streams file with Content-Disposition header
      const response = await fetch(`/api/assets/sound-effect-download-proxy?assetId=${soundEffect.assetId}&soundEffectId=${soundEffect.id}`);
      if (!response.ok) throw new Error('Failed to download file');
      
      // Get the blob from response
      const blob = await response.blob();
      
      // Create blob URL and trigger download
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = soundEffect.fileName;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Clean up blob URL after a short delay
      setTimeout(() => URL.revokeObjectURL(blobUrl), 100);
    } catch (error) {
      console.error('Download error:', error);
      alert('Failed to download sound effect. Please try again.');
    } finally {
      setDownloading(false);
    }
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="border border-ccaBlue/30 bg-black/80 backdrop-blur-sm rounded-lg p-4 hover:border-ccaBlue/60 hover:bg-black/90 transition-all duration-300 shadow-lg shadow-ccaBlue/10 hover:shadow-ccaBlue/20">
      <div className="flex items-center gap-4">
        {/* Futuristic Play Button */}
        <button
          onClick={togglePlay}
          disabled={!audioUrl}
          className="relative w-12 h-12 rounded-full bg-gradient-to-br from-ccaBlue via-purple-600 to-pink-600 hover:from-ccaBlue/90 hover:via-purple-500 hover:to-pink-500 flex items-center justify-center flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 shadow-lg shadow-ccaBlue/50 hover:shadow-ccaBlue/70 hover:scale-110 group"
        >
          <div className="absolute inset-0 rounded-full bg-gradient-to-br from-ccaBlue via-purple-600 to-pink-600 opacity-75 blur-md group-hover:opacity-100 transition-opacity"></div>
          {isPlaying ? (
            <svg className="w-6 h-6 text-white relative z-10" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>
            </svg>
          ) : (
            <svg className="w-6 h-6 text-white ml-0.5 relative z-10" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z"/>
            </svg>
          )}
        </button>

        {/* Futuristic Thumbnail */}
        <div className="w-14 h-14 rounded-lg bg-gradient-to-br from-neutral-900 via-neutral-800 to-black flex-shrink-0 overflow-hidden border border-ccaBlue/20 shadow-lg shadow-black/50">
          {asset.thumbnailUrl && asset.thumbnailUrl.startsWith('https://') ? (
            <img 
              src={asset.thumbnailUrl} 
              alt={soundEffect.fileName}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-ccaBlue/50 bg-gradient-to-br from-neutral-900 to-black">
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
              </svg>
            </div>
          )}
        </div>

        {/* Info and Waveform */}
        <div className="flex-1 min-w-0">
          <div className="text-white text-sm font-semibold truncate drop-shadow-lg">{soundEffect.fileName.replace(/\.[^/.]+$/, '')}</div>
          <div className="text-xs text-ccaBlue/70 mt-0.5 font-medium">Overlay</div>
          
          {/* Futuristic Interactive Waveform */}
          <div 
            ref={waveformRef}
            onClick={handleWaveformClick}
            onMouseMove={handleWaveformMouseMove}
            onMouseLeave={() => setHoveredBarIndex(null)}
            className="mt-3 h-10 bg-gradient-to-b from-neutral-900/90 via-black/80 to-neutral-900/90 rounded-lg relative overflow-hidden border border-ccaBlue/20 cursor-pointer group/waveform backdrop-blur-sm"
          >
            {/* Animated background gradient */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-ccaBlue/5 to-transparent animate-pulse"></div>
            
            {/* Waveform bars */}
            <div className="absolute inset-0 flex items-center gap-[2px] px-1.5">
              {waveformBars.map((bar) => {
                const isActive = progress > 0 && (bar.index / 50) * 100 < progress;
                const isHovered = hoveredBarIndex === bar.index;
                const isPastHover = hoveredBarIndex !== null && bar.index <= hoveredBarIndex;
                
                return (
                  <div
                    key={bar.index}
                    className={`flex-1 rounded-sm transition-all duration-75 ${
                      isActive 
                        ? 'bg-gradient-to-t from-ccaBlue via-purple-500 to-pink-500 shadow-lg shadow-ccaBlue/50' 
                        : isHovered || isPastHover
                        ? 'bg-gradient-to-t from-ccaBlue/40 via-purple-500/40 to-pink-500/40'
                        : 'bg-neutral-600/50'
                    } ${isHovered ? 'scale-y-110' : ''}`}
                    style={{ 
                      height: `${bar.height}%`,
                      transition: 'all 0.1s cubic-bezier(0.4, 0, 0.2, 1)'
                    }}
                  />
                );
              })}
            </div>
            
            {/* Progress indicator line */}
            {progress > 0 && (
              <div 
                className="absolute top-0 bottom-0 w-0.5 bg-gradient-to-b from-ccaBlue via-purple-500 to-pink-500 shadow-lg shadow-ccaBlue/70 transition-all duration-75"
                style={{ left: `${progress}%` }}
              >
                <div className="absolute -top-1 -left-1 w-3 h-3 rounded-full bg-ccaBlue shadow-lg shadow-ccaBlue/70 border-2 border-white/50"></div>
              </div>
            )}
          </div>
          
          {/* Duration with futuristic styling */}
          <div className="text-xs text-ccaBlue/80 mt-2 font-mono font-semibold tracking-wider">
            {formatDuration(currentTime)}<span className="text-neutral-500">/</span>{formatDuration(duration)}
          </div>
        </div>

        {/* Futuristic Download Button */}
        <button
          onClick={handleDownload}
          disabled={downloading}
          className="w-10 h-10 flex items-center justify-center text-neutral-400 hover:text-ccaBlue transition-all duration-300 flex-shrink-0 rounded-lg hover:bg-ccaBlue/10 hover:border hover:border-ccaBlue/30 group"
          title="Download"
        >
          {downloading ? (
            <svg className="w-5 h-5 animate-spin text-ccaBlue" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          ) : (
            <svg className="w-5 h-5 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
          )}
        </button>

        {/* Futuristic Favorite Button */}
        <button
          className="w-10 h-10 flex items-center justify-center text-neutral-400 hover:text-pink-500 transition-all duration-300 flex-shrink-0 rounded-lg hover:bg-pink-500/10 hover:border hover:border-pink-500/30 group"
          title="Favorite"
        >
          <svg className="w-5 h-5 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </svg>
        </button>
      </div>

      {/* Futuristic Tag */}
      <div className="mt-3">
        <span className="inline-block px-3 py-1 bg-gradient-to-r from-neutral-900/80 to-black/80 backdrop-blur-sm text-ccaBlue/80 text-xs rounded-md border border-ccaBlue/20 font-medium shadow-lg shadow-black/30">
          sound effects
        </span>
      </div>

      {/* Hidden Audio Element */}
      {audioUrl && (
        <audio ref={audioRef} src={audioUrl} preload="metadata" />
      )}
    </div>
  );
}

export default function AssetsPage() {
  const [selectedCategory, setSelectedCategory] = useState<AssetCategory>('All Packs');
  const [selectedSubCategory, setSelectedSubCategory] = useState<SubCategory>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [soundEffects, setSoundEffects] = useState<{ [assetId: string]: SoundEffect[] }>({});
  const [overlays, setOverlays] = useState<Overlay[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState<string | null>(null);
  
  // Reset subcategory when main category changes
  useEffect(() => {
    setSelectedSubCategory(null);
  }, [selectedCategory]);

  useEffect(() => {
    const loadAssets = async () => {
      if (!firebaseReady || !db) {
        setLoading(false);
        return;
      }

      try {
        const q = query(collection(db, 'assets'), orderBy('createdAt', 'desc'));
        const snapshot = await getDocs(q);
        const loadedAssets: Asset[] = [];
        snapshot.forEach((doc) => {
          loadedAssets.push({
            id: doc.id,
            ...doc.data()
          } as Asset);
        });
        setAssets(loadedAssets);
      } catch (error) {
        console.error('Error loading assets:', error);
      } finally {
        setLoading(false);
      }
    };

    loadAssets();
  }, []);

  // Load sound effects for SFX assets when SFX subcategory is selected
  useEffect(() => {
    if (selectedSubCategory !== 'SFX') return;

    const loadSoundEffects = async () => {
      const sfxAssets = assets.filter(asset => getSubCategory(asset) === 'SFX');
      const effectsMap: { [assetId: string]: SoundEffect[] } = {};

      for (const asset of sfxAssets) {
        try {
          const response = await fetch(`/api/assets/sound-effects?assetId=${asset.id}`);
          if (response.ok) {
            const data = await response.json();
            effectsMap[asset.id] = data.soundEffects || [];
          }
        } catch (error) {
          console.error(`Error loading sound effects for ${asset.id}:`, error);
        }
      }

      setSoundEffects(effectsMap);
    };

    if (assets.length > 0) {
      loadSoundEffects();
    }
  }, [selectedSubCategory, assets]);

  // Load overlays when "Overlays & Transitions" category is selected
  useEffect(() => {
    if (selectedCategory !== 'Overlays & Transitions') {
      setOverlays([]);
      return;
    }

    const loadOverlays = async () => {
      try {
        const response = await fetch('/api/assets/overlays');
        if (response.ok) {
          const data = await response.json();
          setOverlays(data.overlays || []);
        }
      } catch (error) {
        console.error('Error loading overlays:', error);
      }
    };

    loadOverlays();
  }, [selectedCategory]);

  // Get subcategories for the current category
  const getSubCategories = (category: AssetCategory): SubCategory[] => {
    // Removed 'Overlays & Transitions' subcategories - show all overlays directly
    if (category === 'SFX & Plugins') return ['SFX', 'Plugins'];
    if (category === 'LUTs & Presets') return ['LUTs', 'Presets'];
    return [];
  };

  const subCategories = getSubCategories(selectedCategory);
  const showSubTabs = subCategories.length > 0;

  const filteredAssets = selectedCategory === 'All Packs' 
    ? assets 
    : assets.filter(asset => {
        if (asset.category !== selectedCategory) return false;
        
        // If subcategory is selected, filter by it
        if (selectedSubCategory) {
          return getSubCategory(asset) === selectedSubCategory;
        }
        
        return true;
      });

  const handleDownload = async (asset: Asset) => {
    if (downloading === asset.id) return;
    
    setDownloading(asset.id);
    try {
      if (asset.storagePath) {
        // File asset - get signed URL from API
        const response = await fetch(`/api/assets/download?assetId=${asset.id}`);
        if (!response.ok) throw new Error('Failed to get download URL');
        const data = await response.json();
        
        // Trigger download
        const link = document.createElement('a');
        link.href = data.downloadUrl;
        link.download = asset.title.replace(/\s+/g, '_') + (asset.fileType ? `.${asset.fileType}` : '');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else if (asset.muxPlaybackId) {
        // Video asset - handle MUX playback (for now, just show message)
        alert('Video assets will open in player');
      }
    } catch (error) {
      console.error('Download error:', error);
      alert('Failed to download asset. Please try again.');
    } finally {
      setDownloading(null);
    }
  };

  const handleOverlayDownload = async (overlay: Overlay) => {
    if (downloading === overlay.id) return;
    
    setDownloading(overlay.id);
    try {
      const response = await fetch(`/api/assets/overlay-download?assetId=${overlay.assetId}&overlayId=${overlay.id}`);
      if (!response.ok) throw new Error('Failed to get download URL');
      const data = await response.json();
      
      const link = document.createElement('a');
      link.href = data.downloadUrl;
      link.download = overlay.fileName;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Download error:', error);
      alert('Failed to download overlay. Please try again.');
    } finally {
      setDownloading(null);
    }
  };

  // Show individual sound effects for SFX subcategory
  const showSoundEffects = selectedSubCategory === 'SFX';
  const showOverlays = selectedCategory === 'Overlays & Transitions';
  const allSoundEffects: Array<{ soundEffect: SoundEffect; asset: Asset }> = [];

  if (showSoundEffects) {
    filteredAssets.forEach(asset => {
      const effects = soundEffects[asset.id] || [];
      effects.forEach(effect => {
        allSoundEffects.push({ soundEffect: effect, asset });
      });
    });
  }

  return (
    <main className="min-h-screen">
      <div className="max-w-7xl mx-auto px-6 py-8">
        <h1 className="text-3xl md:text-4xl font-bold text-center text-white">Assets</h1>
        <p className="text-neutral-400 text-center mt-2">Thousands of premium assets & templates.</p>

        <div className="mt-6 flex flex-wrap gap-2 justify-center">
          {categories.map((category) => (
            <button 
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`px-4 py-2 rounded-full text-sm transition-colors ${
                selectedCategory === category
                  ? 'bg-ccaBlue text-white'
                  : 'bg-neutral-900 border border-neutral-800 text-neutral-300 hover:bg-neutral-800'
              }`}
            >
              {category}
            </button>
          ))}
        </div>

        {/* Sub-category tabs for combined categories - Made smaller */}
        {showSubTabs && (
          <div className="mt-4 flex justify-center gap-2">
            <button
              onClick={() => setSelectedSubCategory(null)}
              className={`px-4 py-1 rounded-lg text-sm font-medium transition-colors ${
                selectedSubCategory === null
                  ? 'bg-ccaBlue text-white'
                  : 'bg-neutral-900 border border-neutral-800 text-neutral-300 hover:bg-neutral-800'
              }`}
            >
              All
            </button>
            {subCategories.map((subCat) => (
              <button
                key={subCat}
                onClick={() => setSelectedSubCategory(subCat)}
                className={`px-4 py-1 rounded-lg text-sm font-medium transition-colors ${
                  selectedSubCategory === subCat
                    ? 'bg-ccaBlue text-white'
                    : 'bg-neutral-900 border border-neutral-800 text-neutral-300 hover:bg-neutral-800'
                }`}
              >
                {subCat}
              </button>
            ))}
          </div>
        )}

        {loading ? (
          <div className="mt-6 grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="rounded-lg overflow-hidden border border-neutral-700 bg-black">
                <div className="aspect-square bg-neutral-900 animate-pulse"></div>
                <div className="p-3">
                  <div className="h-4 bg-neutral-900 rounded w-3/4 mb-2 animate-pulse"></div>
                  <div className="h-3 bg-neutral-900 rounded w-1/2 animate-pulse"></div>
                </div>
              </div>
            ))}
          </div>
        ) : showOverlays && overlays.length > 0 ? (
          <div className="mt-6 grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {overlays.map((overlay) => (
              <OverlayPlayer key={overlay.id} overlay={overlay} />
            ))}
          </div>
        ) : showSoundEffects && allSoundEffects.length > 0 ? (
          <div className="mt-6 space-y-2">
            {allSoundEffects.map(({ soundEffect, asset }) => (
              <SoundEffectPlayer key={soundEffect.id} soundEffect={soundEffect} asset={asset} />
            ))}
          </div>
        ) : filteredAssets.length === 0 ? (
          <div className="mt-6 text-neutral-400 text-center">No assets found in this category.</div>
        ) : (
          <div className="mt-6 grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredAssets.map((asset) => (
              <div 
                key={asset.id} 
                className="rounded-lg overflow-hidden border border-neutral-700 bg-black hover:border-neutral-500 transition-colors cursor-pointer group"
                onClick={() => handleDownload(asset)}
              >
                <div className="aspect-square bg-neutral-900 relative overflow-hidden">
                  {asset.thumbnailUrl && 
                   asset.thumbnailUrl.startsWith('https://') && 
                   !asset.thumbnailUrl.includes('via.placeholder.com') &&
                   (asset.thumbnailUrl.includes('firebasestorage.googleapis.com') || 
                    asset.thumbnailUrl.includes('firebasestorage.app')) ? (
                    <img 
                      src={asset.thumbnailUrl} 
                      alt={asset.title}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        console.error('Failed to load thumbnail:', asset.title, asset.thumbnailUrl);
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  ) : null}
                  <div className="w-full h-full flex items-center justify-center text-neutral-600 bg-gradient-to-br from-neutral-900 to-black">
                    <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                  </div>
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                    {downloading === asset.id ? (
                      <div className="text-white text-sm">Downloading...</div>
                    ) : (
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity text-white text-sm font-medium">
                        Click to Download
                      </div>
                    )}
                  </div>
                </div>
                <div className="p-3 bg-black">
                  <div className="font-semibold text-white text-sm">{asset.title}</div>
                  <div className="text-xs text-neutral-400 mt-1">{asset.category}</div>
                  {asset.description && (
                    <div className="text-xs text-neutral-500 mt-2 line-clamp-2">{asset.description}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
