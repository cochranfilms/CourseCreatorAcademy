"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { collection, query, getDocs, orderBy } from 'firebase/firestore';
import { db, firebaseReady } from '@/lib/firebaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { toggleSaved, isSaved } from '@/lib/userData';

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
  beforeVideoPath?: string; // Path to "before" video in Firebase Storage
  afterVideoPath?: string; // Path to "after" video in Firebase Storage
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
  previewStoragePath?: string; // Optional 720p version path
}

interface LUTPreview {
  id: string;
  assetId: string;
  assetTitle: string;
  lutName: string; // Name of the specific LUT (e.g., "Warm Ivory", "Elegant Taupe")
  beforeVideoPath: string; // Path to "before" video in Firebase Storage
  afterVideoPath: string; // Path to "after" video in Firebase Storage
  lutFilePath?: string; // Path to the .cube file in Firebase Storage (for individual downloads)
  fileName?: string; // Original filename of the .cube file
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
 * Generate direct public URL for Firebase Storage file
 * Since overlay files are public, we can use direct URLs without API calls
 * Uses Firebase Storage v0 API format for public files
 */
function getPublicStorageUrl(storagePath: string): string {
  const bucket = 'course-creator-academy-866d6.firebasestorage.app';
  // Encode the path properly - encodeURIComponent handles special chars, but we need to keep slashes
  const encodedPath = encodeURIComponent(storagePath);
  // Use Firebase Storage v0 API format for public files
  return `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodedPath}?alt=media`;
}

/**
 * Side-by-Side Video Slider Component for LUT previews
 * Shows before/after videos with a draggable slider
 */
function SideBySideVideoSlider({ asset, previewId, lutFilePath, fileName }: { asset: Asset; previewId?: string; lutFilePath?: string; fileName?: string }) {
  const { user } = useAuth();
  const [beforeVideoUrl, setBeforeVideoUrl] = useState<string | null>(null);
  const [afterVideoUrl, setAfterVideoUrl] = useState<string | null>(null);
  const [sliderPosition, setSliderPosition] = useState(50); // Percentage (0-100)
  const [isDragging, setIsDragging] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [isFavorited, setIsFavorited] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const beforeVideoRef = useRef<HTMLVideoElement | null>(null);
  const afterVideoRef = useRef<HTMLVideoElement | null>(null);
  const sliderRef = useRef<HTMLDivElement | null>(null);

  // Load favorite status
  useEffect(() => {
    if (!user) {
      setIsFavorited(false);
      return;
    }
    const checkFavorite = async () => {
      // For LUT previews, use previewId if available, otherwise use asset.id
      const targetId = previewId || asset.id;
      const saved = await isSaved(user.uid, 'asset', targetId);
      setIsFavorited(saved);
    };
    checkFavorite();
  }, [user, asset.id, previewId]);

  // Load video URLs
  useEffect(() => {
    if (asset.beforeVideoPath) {
      const url = getPublicStorageUrl(asset.beforeVideoPath);
      setBeforeVideoUrl(url);
    }
    if (asset.afterVideoPath) {
      const url = getPublicStorageUrl(asset.afterVideoPath);
      setAfterVideoUrl(url);
    }
  }, [asset]);

  // Intersection Observer for lazy loading and pausing videos out of viewport
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true);
            // Resume videos if they're loaded
            if (beforeVideoRef.current && beforeVideoUrl) {
              beforeVideoRef.current.play().catch(() => {});
            }
            if (afterVideoRef.current && afterVideoUrl) {
              afterVideoRef.current.play().catch(() => {});
            }
          } else {
            // Pause videos when out of viewport to save resources
            if (beforeVideoRef.current) {
              beforeVideoRef.current.pause();
            }
            if (afterVideoRef.current) {
              afterVideoRef.current.pause();
            }
          }
        });
      },
      {
        rootMargin: '200px',
        threshold: 0.01
      }
    );

    observer.observe(container);

    return () => {
      observer.disconnect();
    };
  }, [beforeVideoUrl, afterVideoUrl]);

  // Setup video elements
  useEffect(() => {
    const beforeVideo = beforeVideoRef.current;
    const afterVideo = afterVideoRef.current;

    if (beforeVideo && beforeVideoUrl) {
      beforeVideo.loop = true;
      beforeVideo.muted = true;
      beforeVideo.playsInline = true;
      beforeVideo.preload = 'metadata';
      beforeVideo.crossOrigin = 'anonymous';
      
      const handleCanPlay = () => {
        if (isVisible) {
          beforeVideo.play().catch(() => {});
        }
      };
      
      beforeVideo.addEventListener('canplay', handleCanPlay, { once: true });
      
      return () => {
        beforeVideo.removeEventListener('canplay', handleCanPlay);
      };
    }
  }, [beforeVideoUrl, isVisible]);

  useEffect(() => {
    const afterVideo = afterVideoRef.current;

    if (afterVideo && afterVideoUrl) {
      afterVideo.loop = true;
      afterVideo.muted = true;
      afterVideo.playsInline = true;
      afterVideo.preload = 'metadata';
      afterVideo.crossOrigin = 'anonymous';
      
      const handleCanPlay = () => {
        if (isVisible) {
          afterVideo.play().catch(() => {});
        }
      };
      
      afterVideo.addEventListener('canplay', handleCanPlay, { once: true });
      
      return () => {
        afterVideo.removeEventListener('canplay', handleCanPlay);
      };
    }
  }, [afterVideoUrl, isVisible]);

  // Sync video playback
  useEffect(() => {
    const beforeVideo = beforeVideoRef.current;
    const afterVideo = afterVideoRef.current;

    if (!beforeVideo || !afterVideo) return;

    const syncVideos = () => {
      if (beforeVideo.currentTime !== afterVideo.currentTime) {
        afterVideo.currentTime = beforeVideo.currentTime;
      }
    };

    beforeVideo.addEventListener('timeupdate', syncVideos);
    
    return () => {
      beforeVideo.removeEventListener('timeupdate', syncVideos);
    };
  }, [beforeVideoUrl, afterVideoUrl]);

  // Handle slider drag
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    setIsDragging(true);
    e.preventDefault();
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging || !containerRef.current) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
    setSliderPosition(percentage);
  }, [isDragging]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  // Handle touch events for mobile
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    setIsDragging(true);
    e.preventDefault();
  }, []);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!isDragging || !containerRef.current) return;
    
    const touch = e.touches[0];
    const rect = containerRef.current.getBoundingClientRect();
    const x = touch.clientX - rect.left;
    const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
    setSliderPosition(percentage);
  }, [isDragging]);

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('touchmove', handleTouchMove);
      document.addEventListener('touchend', handleTouchEnd);
      return () => {
        document.removeEventListener('touchmove', handleTouchMove);
        document.removeEventListener('touchend', handleTouchEnd);
      };
    }
  }, [isDragging, handleTouchMove, handleTouchEnd]);

  const handlePackDownload = async () => {
    const response = await fetch(`/api/assets/download?assetId=${asset.id}`);
    if (!response.ok) throw new Error('Failed to get download URL');
    const data = await response.json();
    
    const link = document.createElement('a');
    link.href = data.downloadUrl;
    link.download = asset.title.replace(/\s+/g, '_') + (asset.fileType ? `.${asset.fileType}` : '');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownload = async () => {
    if (downloading) return;
    
    setDownloading(true);
    try {
      // Debug logging
      console.log('[LUT Download] Checking download options:');
      console.log('  lutFilePath:', lutFilePath);
      console.log('  previewId:', previewId);
      console.log('  assetId:', asset.id);
      console.log('  fileName:', fileName);
      console.log('  lutFilePath type:', typeof lutFilePath);
      console.log('  previewId type:', typeof previewId);
      
      // If this is a LUT preview with individual file, use that endpoint
      if (lutFilePath && previewId) {
        console.log('[LUT Download] Using individual file download:', lutFilePath);
        const response = await fetch(`/api/assets/lut-download?assetId=${asset.id}&previewId=${previewId}`);
        
        if (!response.ok) {
          const error = await response.json();
          console.error('[LUT Download] API error:', error);
          if (error.fallback) {
            // Fallback to pack download
            console.log('[LUT Download] Falling back to pack download');
            await handlePackDownload();
            return;
          }
          throw new Error('Failed to get download URL');
        }
        const data = await response.json();
        console.log('[LUT Download] Got download URL:', data);
        
        const link = document.createElement('a');
        link.href = data.downloadUrl;
        link.download = data.fileName || fileName || asset.title.replace(/\s+/g, '_') + '.cube';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        // Fallback to pack download
        console.log('[LUT Download] No individual file, using pack download');
        console.log('[LUT Download] Missing lutFilePath:', !lutFilePath, 'value:', lutFilePath);
        console.log('[LUT Download] Missing previewId:', !previewId, 'value:', previewId);
        await handlePackDownload();
      }
    } catch (error) {
      console.error('Download error:', error);
      alert('Failed to download LUT. Please try again.');
    } finally {
      setDownloading(false);
    }
  };

  // If videos aren't available, fall back to thumbnail
  if (!beforeVideoUrl || !afterVideoUrl) {
    return (
      <div 
        className="border border-neutral-700 bg-black rounded-lg overflow-hidden hover:border-neutral-500 transition-colors cursor-pointer group"
        onClick={handleDownload}
      >
        <div className="aspect-video bg-gradient-to-br from-neutral-900 to-black relative overflow-hidden">
          {asset.thumbnailUrl && asset.thumbnailUrl.startsWith('https://') ? (
            <img 
              src={asset.thumbnailUrl} 
              alt={asset.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-ccaBlue/50">
              <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </div>
          )}
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
        <div className="p-3 bg-black">
          <div className="font-semibold text-white text-sm truncate">{asset.title}</div>
          <div className="text-xs text-neutral-400 mt-1 truncate">{asset.category}</div>
        </div>
      </div>
    );
  }

  return (
    <div 
      ref={containerRef}
      className="border border-neutral-700 bg-black rounded-lg overflow-hidden hover:border-neutral-500 transition-colors cursor-pointer group"
      onClick={(e) => {
        // Don't trigger download when clicking on slider
        if (e.target === sliderRef.current || sliderRef.current?.contains(e.target as Node)) {
          return;
        }
        handleDownload();
      }}
    >
      {/* Side-by-Side Video Preview */}
      <div className="aspect-video bg-gradient-to-br from-neutral-900 to-black relative overflow-hidden">
        {/* Before Video (Left Side) */}
        <div className="absolute inset-0" style={{ clipPath: `inset(0 ${100 - sliderPosition}% 0 0)` }}>
          <video
            ref={beforeVideoRef}
            src={beforeVideoUrl}
            className="w-full h-full object-cover"
            playsInline
            muted
            loop
            preload="metadata"
            crossOrigin="anonymous"
            style={{
              maxWidth: '1280px',
              maxHeight: '720px',
              width: '100%',
              height: 'auto'
            }}
          />
          {/* Before Label */}
          <div className="absolute top-2 left-2 px-2 py-1 bg-black/60 backdrop-blur-sm text-white text-xs font-medium rounded">
            Before
          </div>
        </div>

        {/* After Video (Right Side) */}
        <div className="absolute inset-0" style={{ clipPath: `inset(0 0 0 ${sliderPosition}%)` }}>
          <video
            ref={afterVideoRef}
            src={afterVideoUrl}
            className="w-full h-full object-cover"
            playsInline
            muted
            loop
            preload="metadata"
            crossOrigin="anonymous"
            style={{
              maxWidth: '1280px',
              maxHeight: '720px',
              width: '100%',
              height: 'auto'
            }}
          />
          {/* After Label */}
          <div className="absolute top-2 right-2 px-2 py-1 bg-black/60 backdrop-blur-sm text-white text-xs font-medium rounded">
            After
          </div>
        </div>

        {/* Slider Handle */}
        <div
          ref={sliderRef}
          className="absolute top-0 bottom-0 w-1 bg-white cursor-ew-resize z-10"
          style={{ left: `${sliderPosition}%` }}
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
        >
          {/* Slider Handle Circle */}
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-white rounded-full shadow-lg flex items-center justify-center">
            <svg className="w-4 h-4 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
          </div>
        </div>

        {/* Overlay on hover */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center pointer-events-none">
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
        <div className="font-semibold text-white text-sm truncate">{asset.title}</div>
        <div className="text-xs text-neutral-400 mt-1 truncate">{asset.category}</div>
        {asset.description && (
          <div className="text-xs text-neutral-500 mt-2 line-clamp-2">{asset.description}</div>
        )}
        
        {/* Action Buttons */}
        <div className="flex items-center justify-between mt-3">
          <span className="inline-block px-2 py-1 bg-neutral-900 text-neutral-400 text-xs rounded border border-neutral-800">
            LUT
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDownload();
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
            <button
              onClick={async (e) => {
                e.stopPropagation();
                if (!user) {
                  alert('Please sign in to favorite assets');
                  return;
                }
                const targetId = previewId || asset.id;
                // Generate thumbnail URL - prefer asset thumbnail, or generate from video paths for LUT previews
                let thumbnailUrl = asset.thumbnailUrl;
                if (!thumbnailUrl && asset.beforeVideoPath) {
                  // For LUT previews, use the before video as thumbnail
                  thumbnailUrl = getPublicStorageUrl(asset.beforeVideoPath);
                }
                const nowFavorited = await toggleSaved(user.uid, 'asset', targetId, {
                  assetId: asset.id,
                  title: asset.title,
                  category: asset.category,
                  previewId: previewId || undefined,
                  thumbnailUrl: thumbnailUrl || undefined,
                  beforeVideoPath: asset.beforeVideoPath || undefined,
                  afterVideoPath: asset.afterVideoPath || undefined,
                });
                setIsFavorited(nowFavorited);
              }}
              className={`w-8 h-8 flex items-center justify-center transition-colors ${
                isFavorited 
                  ? 'text-pink-500 hover:text-pink-400' 
                  : 'text-neutral-400 hover:text-pink-500'
              }`}
              title={isFavorited ? 'Unfavorite' : 'Favorite'}
            >
              <svg 
                className={`w-4 h-4 ${isFavorited ? 'fill-current' : ''}`} 
                fill={isFavorited ? 'currentColor' : 'none'} 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
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
 * Overlay Player Component - Shows looping video preview in 16:9 format
 */
function OverlayPlayer({ overlay }: { overlay: Overlay }) {
  const { user } = useAuth();
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [isVideo, setIsVideo] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [isFavorited, setIsFavorited] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Load favorite status
  useEffect(() => {
    if (!user) {
      setIsFavorited(false);
      return;
    }
    const checkFavorite = async () => {
      const saved = await isSaved(user.uid, 'asset', overlay.id);
      setIsFavorited(saved);
    };
    checkFavorite();
  }, [user, overlay.id]);

  // Generate media URL immediately from storage path (prefer 720p version for videos)
  useEffect(() => {
    if (overlay.storagePath) {
      // Check if file is a video based on extension
      const fileType = overlay.fileType || '';
      const videoExtensions = ['mov', 'mp4', 'avi', 'mkv', 'webm', 'm4v'];
      const isVideoFile = videoExtensions.includes(fileType.toLowerCase());
      
      // For videos, prefer 720p version if available, otherwise use original
      let storagePathToUse = overlay.storagePath;
      if (isVideoFile) {
        // Check if previewStoragePath exists (720p version)
        if (overlay.previewStoragePath) {
          storagePathToUse = overlay.previewStoragePath;
        }
      }
      
      const url = getPublicStorageUrl(storagePathToUse);
      setMediaUrl(url);
      setIsVideo(isVideoFile);
    }
  }, [overlay]);

  // Intersection Observer for lazy loading and pausing videos out of viewport
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true);
            // Resume video if it's loaded
            if (videoRef.current && isVideo && mediaUrl) {
              videoRef.current.play().catch(() => {
                // Ignore autoplay errors
              });
            }
          } else {
            // Pause video when out of viewport to save resources
            if (videoRef.current && isVideo) {
              videoRef.current.pause();
            }
          }
        });
      },
      {
        rootMargin: '200px', // Start loading 200px before entering viewport for faster preview
        threshold: 0.01
      }
    );

    observer.observe(container);

    return () => {
      observer.disconnect();
    };
  }, [isVideo, mediaUrl]);

  // Setup video element and auto-play when URL is loaded (only for videos)
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !mediaUrl || !isVideo) return;

    // Set video attributes for fast loading and 720p quality limit
    video.loop = true;
    video.muted = true;
    video.playsInline = true;
    // Use 'metadata' to reduce initial bandwidth - only load video metadata first
    video.preload = 'metadata';
    video.crossOrigin = 'anonymous';
    
    // Limit video quality by constraining dimensions
    // Browser will automatically select appropriate quality based on display size
    if (video.videoWidth > 1280 || video.videoHeight > 720) {
      // Video is larger than 720p, browser will scale down for display
      // This helps with rendering performance
    }

    // Handle video can play event (fires earlier than loadeddata)
    const handleCanPlay = () => {
      // Only autoplay if visible
      if (isVisible) {
        video.play().catch(() => {
          // Ignore autoplay errors (browser policy)
        });
      }
    };

    // Handle video loaded event
    const handleLoadedData = () => {
      // Only autoplay if still visible
      if (isVisible) {
        video.play().catch(() => {
          // Ignore autoplay errors
        });
      }
    };

    // Handle video errors - fallback to image if video fails
    const handleError = (e: Event) => {
      const videoEl = e.target as HTMLVideoElement;
      console.error('Video playback error:', {
        error: videoEl.error,
        networkState: videoEl.networkState,
        readyState: videoEl.readyState,
        src: videoEl.src
      });
      // If video fails to play (e.g., .mov not supported), try as image
      setIsVideo(false);
    };

    video.addEventListener('canplay', handleCanPlay, { once: true });
    video.addEventListener('loadeddata', handleLoadedData, { once: true });
    video.addEventListener('error', handleError);

    // Try to play immediately if video is already loaded and visible
    if (video.readyState >= 3 && isVisible) {
      video.play().catch(() => {
        // Ignore autoplay errors
      });
    }

    return () => {
      video.removeEventListener('canplay', handleCanPlay);
      video.removeEventListener('loadeddata', handleLoadedData);
      video.removeEventListener('error', handleError);
    };
  }, [mediaUrl, isVideo, isVisible]);

  const handleDownload = async (e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }
    if (downloading) return;
    
    setDownloading(true);
    try {
      // Include storagePath as fallback for finding the document
      const params = new URLSearchParams({
        assetId: overlay.assetId,
        overlayId: overlay.id,
      });
      if (overlay.storagePath) {
        params.append('storagePath', overlay.storagePath);
      }
      const response = await fetch(`/api/assets/overlay-download?${params.toString()}`);
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
      ref={containerRef}
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
              preload="metadata"
              crossOrigin="anonymous"
              style={{
                maxWidth: '1280px',
                maxHeight: '720px',
                width: '100%',
                height: 'auto'
              }}
              onError={(e) => {
                console.error('Video playback error:', {
                  error: (e.target as HTMLVideoElement).error,
                  code: (e.target as HTMLVideoElement).error?.code,
                  message: (e.target as HTMLVideoElement).error?.message,
                  src: (e.target as HTMLVideoElement).src
                });
                // If video fails to play (e.g., .mov not supported), show fallback
                setIsVideo(false);
              }}
            />
          ) : (
            <img
              src={mediaUrl}
              alt={overlay.fileName}
              className="w-full h-full object-cover"
              loading="eager"
              decoding="async"
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
              onClick={async (e) => {
                e.stopPropagation();
                if (!user) {
                  alert('Please sign in to favorite assets');
                  return;
                }
                // Generate thumbnail URL from overlay preview
                const overlayThumbnailUrl = overlay.previewStoragePath 
                  ? getPublicStorageUrl(overlay.previewStoragePath)
                  : overlay.storagePath 
                    ? getPublicStorageUrl(overlay.storagePath)
                    : undefined;
                const nowFavorited = await toggleSaved(user.uid, 'asset', overlay.id, {
                  assetId: overlay.assetId,
                  title: overlay.fileName,
                  overlayId: overlay.id,
                  fileName: overlay.fileName,
                  thumbnailUrl: overlayThumbnailUrl,
                  storagePath: overlay.storagePath,
                });
                setIsFavorited(nowFavorited);
              }}
              className={`w-8 h-8 flex items-center justify-center transition-colors ${
                isFavorited 
                  ? 'text-pink-500 hover:text-pink-400' 
                  : 'text-neutral-400 hover:text-pink-500'
              }`}
              title={isFavorited ? 'Unfavorite' : 'Favorite'}
            >
              <svg 
                className={`w-4 h-4 ${isFavorited ? 'fill-current' : ''}`} 
                fill={isFavorited ? 'currentColor' : 'none'} 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
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
  const { user } = useAuth();
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(soundEffect.duration || 0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [hoveredBarIndex, setHoveredBarIndex] = useState<number | null>(null);
  const [isFavorited, setIsFavorited] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const waveformRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | null>(null);

  // Load favorite status
  useEffect(() => {
    if (!user) {
      setIsFavorited(false);
      return;
    }
    const checkFavorite = async () => {
      const saved = await isSaved(user.uid, 'asset', soundEffect.id);
      setIsFavorited(saved);
    };
    checkFavorite();
  }, [user, soundEffect.id]);

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
    <div className="border border-neutral-700 bg-black rounded-lg p-4 hover:border-neutral-500 transition-all duration-200">
      <div className="flex items-center gap-4">
        {/* Play Button */}
        <button
          onClick={togglePlay}
          disabled={!audioUrl}
          className="w-12 h-12 rounded-full bg-ccaBlue hover:bg-ccaBlue/90 flex items-center justify-center flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 hover:scale-105"
        >
          {isPlaying ? (
            <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>
            </svg>
          ) : (
            <svg className="w-6 h-6 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z"/>
            </svg>
          )}
        </button>

        {/* Thumbnail */}
        <div className="w-14 h-14 rounded-lg bg-neutral-900 flex-shrink-0 overflow-hidden border border-neutral-800">
          {asset.thumbnailUrl && asset.thumbnailUrl.startsWith('https://') ? (
            <img 
              src={asset.thumbnailUrl} 
              alt={soundEffect.fileName}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-neutral-600 bg-neutral-900">
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
              </svg>
            </div>
          )}
        </div>

        {/* Info and Waveform */}
        <div className="flex-1 min-w-0">
          <div className="text-white text-sm font-semibold truncate">{soundEffect.fileName.replace(/\.[^/.]+$/, '')}</div>
          <div className="text-xs text-neutral-400 mt-0.5">Overlay</div>
          
          {/* Interactive Waveform */}
          <div 
            ref={waveformRef}
            onClick={handleWaveformClick}
            onMouseMove={handleWaveformMouseMove}
            onMouseLeave={() => setHoveredBarIndex(null)}
            className="mt-3 h-10 bg-neutral-900 rounded-lg relative overflow-hidden border border-neutral-800 cursor-pointer"
          >
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
                        ? 'bg-ccaBlue' 
                        : isHovered || isPastHover
                        ? 'bg-ccaBlue/40'
                        : 'bg-neutral-700'
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
                className="absolute top-0 bottom-0 w-0.5 bg-ccaBlue transition-all duration-75"
                style={{ left: `${progress}%` }}
              >
                <div className="absolute -top-1 -left-1 w-3 h-3 rounded-full bg-ccaBlue border-2 border-white"></div>
              </div>
            )}
          </div>
          
          {/* Duration */}
          <div className="text-xs text-neutral-400 mt-2 font-mono">
            {formatDuration(currentTime)}<span className="text-neutral-500">/</span>{formatDuration(duration)}
          </div>
        </div>

        {/* Download Button */}
        <button
          onClick={handleDownload}
          disabled={downloading}
          className="w-10 h-10 flex items-center justify-center text-neutral-400 hover:text-ccaBlue transition-colors flex-shrink-0 rounded-lg hover:bg-neutral-900"
          title="Download"
        >
          {downloading ? (
            <svg className="w-5 h-5 animate-spin text-ccaBlue" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
          )}
        </button>

        {/* Favorite Button */}
        <button
          onClick={async (e) => {
            e.stopPropagation();
            if (!user) {
              alert('Please sign in to favorite assets');
              return;
            }
            // Get asset thumbnail for sound effect
            const assetThumbnailUrl = asset.thumbnailUrl;
            const nowFavorited = await toggleSaved(user.uid, 'asset', soundEffect.id, {
              assetId: soundEffect.assetId,
              title: soundEffect.fileName,
              soundEffectId: soundEffect.id,
              fileName: soundEffect.fileName,
              thumbnailUrl: assetThumbnailUrl || undefined,
            });
            setIsFavorited(nowFavorited);
          }}
          className={`w-10 h-10 flex items-center justify-center transition-colors flex-shrink-0 rounded-lg hover:bg-neutral-900 ${
            isFavorited 
              ? 'text-pink-500 hover:text-pink-400' 
              : 'text-neutral-400 hover:text-pink-500'
          }`}
          title={isFavorited ? 'Unfavorite' : 'Favorite'}
        >
          <svg 
            className={`w-5 h-5 ${isFavorited ? 'fill-current' : ''}`} 
            fill={isFavorited ? 'currentColor' : 'none'} 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </svg>
        </button>
      </div>

      {/* Tag */}
      <div className="mt-3">
        <span className="inline-block px-2 py-1 bg-neutral-900 text-neutral-400 text-xs rounded border border-neutral-800">
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
  const { user } = useAuth();
  const [selectedCategory, setSelectedCategory] = useState<AssetCategory>('All Packs');
  const [selectedSubCategory, setSelectedSubCategory] = useState<SubCategory>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [soundEffects, setSoundEffects] = useState<{ [assetId: string]: SoundEffect[] }>({});
  const [overlays, setOverlays] = useState<Overlay[]>([]);
  const [lutPreviews, setLutPreviews] = useState<{ [assetId: string]: LUTPreview[] }>({});
  const [loadingLutPreviews, setLoadingLutPreviews] = useState(false);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [favoritedAssets, setFavoritedAssets] = useState<Set<string>>(new Set());
  
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

  // Load favorite status for all assets
  useEffect(() => {
    if (!user || assets.length === 0) {
      setFavoritedAssets(new Set());
      return;
    }

    const loadFavorites = async () => {
      const favorites = new Set<string>();
      await Promise.all(
        assets.map(async (asset) => {
          const saved = await isSaved(user.uid, 'asset', asset.id);
          if (saved) {
            favorites.add(asset.id);
          }
        })
      );
      setFavoritedAssets(favorites);
    };

    loadFavorites();
  }, [user, assets]);

  // Load sound effects for SFX assets when SFX & Plugins category is selected
  // Prefetch when category is selected, so SFX subcategory loads instantly
  useEffect(() => {
    // Load when SFX subcategory is selected OR when SFX & Plugins category is selected (for prefetching)
    const shouldLoad = selectedSubCategory === 'SFX' || 
                      (selectedCategory === 'SFX & Plugins' && selectedSubCategory === null);
    
    if (!shouldLoad) {
      // Clear sound effects when leaving SFX category
      if (selectedCategory !== 'SFX & Plugins') {
        setSoundEffects({});
      }
      return;
    }

    const loadSoundEffects = async () => {
      const sfxAssets = assets.filter(asset => getSubCategory(asset) === 'SFX');
      const effectsMap: { [assetId: string]: SoundEffect[] } = {};

      // Parallelize all API calls for instant loading
      const promises = sfxAssets.map(async (asset) => {
        try {
          const response = await fetch(`/api/assets/sound-effects?assetId=${asset.id}`);
          if (response.ok) {
            const data = await response.json();
            return { assetId: asset.id, soundEffects: data.soundEffects || [] };
          }
        } catch (error) {
          console.error(`Error loading sound effects for ${asset.id}:`, error);
        }
        return { assetId: asset.id, soundEffects: [] };
      });

      const results = await Promise.all(promises);
      results.forEach(({ assetId, soundEffects }) => {
        effectsMap[assetId] = soundEffects;
      });

      setSoundEffects(effectsMap);
    };

    if (assets.length > 0) {
      loadSoundEffects();
    }
  }, [selectedSubCategory, selectedCategory, assets]);

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

  // Load LUT previews for LUT assets when LUTs subcategory is selected
  useEffect(() => {
    if (selectedSubCategory !== 'LUTs') {
      setLutPreviews({});
      setLoadingLutPreviews(false);
      return;
    }

    const loadLUTPreviews = async () => {
      setLoadingLutPreviews(true);
      const lutAssets = assets.filter(asset => getSubCategory(asset) === 'LUTs');
      const previewsMap: { [assetId: string]: LUTPreview[] } = {};

      console.log(`[LUT Previews] Loading previews for ${lutAssets.length} LUT asset(s)`);

      for (const asset of lutAssets) {
        try {
          const response = await fetch(`/api/assets/lut-previews?assetId=${asset.id}`);
          if (response.ok) {
            const data = await response.json();
            const previews = data.lutPreviews || [];
            previewsMap[asset.id] = previews;
            console.log(`[LUT Previews] Loaded ${previews.length} preview(s) for "${asset.title}" (${asset.id})`);
            if (previews.length > 0) {
              previews.forEach((preview: LUTPreview) => {
                console.log(`  - ${preview.lutName}:`);
                console.log(`    beforeVideo: ${preview.beforeVideoPath || 'NOT SET'}`);
                console.log(`    afterVideo: ${preview.afterVideoPath || 'NOT SET'}`);
                console.log(`    lutFilePath: ${preview.lutFilePath || 'NOT SET'}`);
                console.log(`    fileName: ${preview.fileName || 'NOT SET'}`);
                console.log(`    previewId: ${preview.id || 'NOT SET'}`);
              });
            }
          } else {
            console.warn(`[LUT Previews] Failed to load previews for "${asset.title}" (${asset.id}): ${response.status}`);
          }
        } catch (error) {
          console.error(`[LUT Previews] Error loading LUT previews for ${asset.id}:`, error);
        }
      }

      const totalPreviews = Object.values(previewsMap).reduce((sum, arr) => sum + arr.length, 0);
      console.log(`[LUT Previews] Total previews loaded: ${totalPreviews}`);

      setLutPreviews(previewsMap);
      setLoadingLutPreviews(false);
    };

    if (assets.length > 0) {
      loadLUTPreviews();
    } else {
      setLoadingLutPreviews(false);
    }
  }, [selectedSubCategory, assets]);

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
      // Include storagePath as fallback for finding the document
      const params = new URLSearchParams({
        assetId: overlay.assetId,
        overlayId: overlay.id,
      });
      if (overlay.storagePath) {
        params.append('storagePath', overlay.storagePath);
      }
      const response = await fetch(`/api/assets/overlay-download?${params.toString()}`);
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
  const showLUTs = selectedSubCategory === 'LUTs';
  const allSoundEffects: Array<{ soundEffect: SoundEffect; asset: Asset }> = [];
  const allLUTPreviews: Array<{ preview: LUTPreview; asset: Asset }> = [];

  if (showSoundEffects) {
    filteredAssets.forEach(asset => {
      const effects = soundEffects[asset.id] || [];
      effects.forEach(effect => {
        allSoundEffects.push({ soundEffect: effect, asset });
      });
    });
  }

  // Collect all LUT previews for display
  if (showLUTs) {
    filteredAssets.forEach(asset => {
      const previews = lutPreviews[asset.id] || [];
      if (previews.length > 0) {
        previews.forEach(preview => {
          allLUTPreviews.push({ preview, asset });
        });
      }
      // If no previews exist for this asset but it has legacy video paths, add it as a preview
      else if (asset.beforeVideoPath && asset.afterVideoPath) {
        // Create a legacy preview object
        allLUTPreviews.push({
          preview: {
            id: `legacy-${asset.id}`,
            assetId: asset.id,
            assetTitle: asset.title,
            lutName: asset.title, // Use asset title as LUT name for legacy
            beforeVideoPath: asset.beforeVideoPath,
            afterVideoPath: asset.afterVideoPath,
          },
          asset,
        });
      }
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
        ) : showLUTs ? (
          loadingLutPreviews ? (
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
          ) : allLUTPreviews.length > 0 ? (
            <div className="mt-6 grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {allLUTPreviews.map(({ preview, asset }) => {
              // Create a temporary asset object with preview video paths for the slider component
              const previewAsset: Asset = {
                ...asset,
                beforeVideoPath: preview.beforeVideoPath,
                afterVideoPath: preview.afterVideoPath,
                title: preview.assetTitle || `${asset.title} - ${preview.lutName}`, // Use assetTitle from document, fallback to pack name + LUT name
              };
              
              return (
                <SideBySideVideoSlider 
                  key={preview.id} 
                  asset={previewAsset}
                  previewId={preview.id}
                  lutFilePath={preview.lutFilePath}
                  fileName={preview.fileName}
                />
              );
            })}
            </div>
          ) : (
            <div className="mt-6 text-neutral-400 text-center">
              <p>No LUT previews found.</p>
              <p className="text-sm text-neutral-500 mt-2">
                {filteredAssets.length > 0 
                  ? `${filteredAssets.length} LUT pack(s) found, but no preview videos are available yet.`
                  : 'No LUT assets found in this category.'}
              </p>
            </div>
          )
        ) : filteredAssets.length === 0 ? (
          <div className="mt-6 text-neutral-400 text-center">No assets found in this category.</div>
        ) : (
          <div className="mt-6 grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredAssets.map((asset) => {
              // Use side-by-side slider for LUTs with video previews (legacy support for direct asset videos)
              if (showLUTs && asset.beforeVideoPath && asset.afterVideoPath) {
                return <SideBySideVideoSlider key={asset.id} asset={asset} />;
              }
              
              // Default asset card
              return (
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
                    {/* Action Buttons */}
                    <div className="flex items-center justify-end mt-3">
                      <button
                        onClick={async (e) => {
                          e.stopPropagation();
                          if (!user) {
                            alert('Please sign in to favorite assets');
                            return;
                          }
                          const nowFavorited = await toggleSaved(user.uid, 'asset', asset.id, {
                            assetId: asset.id,
                            title: asset.title,
                            category: asset.category,
                            thumbnailUrl: asset.thumbnailUrl || undefined,
                          });
                          setFavoritedAssets(prev => {
                            const newSet = new Set(prev);
                            if (nowFavorited) {
                              newSet.add(asset.id);
                            } else {
                              newSet.delete(asset.id);
                            }
                            return newSet;
                          });
                        }}
                        className={`w-8 h-8 flex items-center justify-center transition-colors ${
                          favoritedAssets.has(asset.id)
                            ? 'text-pink-500 hover:text-pink-400' 
                            : 'text-neutral-400 hover:text-pink-500'
                        }`}
                        title={favoritedAssets.has(asset.id) ? 'Unfavorite' : 'Favorite'}
                      >
                        <svg 
                          className={`w-4 h-4 ${favoritedAssets.has(asset.id) ? 'fill-current' : ''}`} 
                          fill={favoritedAssets.has(asset.id) ? 'currentColor' : 'none'} 
                          stroke="currentColor" 
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
