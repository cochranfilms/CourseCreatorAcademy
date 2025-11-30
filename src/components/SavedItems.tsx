"use client";

import { useEffect, useState, useRef } from 'react';
import { collection, getDocs, query, orderBy, where, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { createPortal } from 'react-dom';
import { toggleSaved, SavedType } from '@/lib/userData';
import Link from 'next/link';
import Image from 'next/image';

type SavedItem = {
  id: string;
  type: SavedType;
  targetId: string;
  title?: string;
  slug?: string;
  courseSlug?: string;
  moduleId?: string;
  lessonId?: string;
  price?: number;
  image?: string;
  images?: string[]; // Add images array for marketplace listings
  thumbnailUrl?: string;
  muxPlaybackId?: string;
  durationSec?: number;
  assetId?: string;
  beforeVideoPath?: string;
  afterVideoPath?: string;
  storagePath?: string;
  previewStoragePath?: string;
  previewVideoPath?: string; // Path to preview video in Firebase Storage (for Plugins)
  previewVideoUrl?: string; // Signed URL for preview video (for Plugins)
  fileType?: string;
  category?: string;
  subCategory?: string;
  previewId?: string;
  overlayId?: string;
  createdAt?: any;
  [key: string]: any;
};

type SavedItemsProps = {
  isOpen: boolean;
  onClose: () => void;
};

function getMuxThumbnailUrl(playbackId?: string, durationSec?: number) {
  if (!playbackId) return '';
  const time = durationSec && durationSec > 0 ? Math.floor(durationSec / 2) : 1;
  return `https://image.mux.com/${playbackId}/thumbnail.jpg?time=${time}&width=640&fit_mode=preserve`;
}

function getPublicStorageUrl(storagePath: string): string {
  const bucket = 'course-creator-academy-866d6.firebasestorage.app';
  const encodedPath = encodeURIComponent(storagePath);
  return `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodedPath}?alt=media`;
}

// Component for saved item card with video support
function SavedItemCard({ 
  item, 
  getItemHref, 
  getItemTitle, 
  getItemImage, 
  isVideoAsset, 
  getVideoUrl, 
  handleUnsave 
}: {
  item: SavedItem;
  getItemHref: (item: SavedItem) => string;
  getItemTitle: (item: SavedItem) => string;
  getItemImage: (item: SavedItem) => string | undefined;
  isVideoAsset: (item: SavedItem) => boolean;
  getVideoUrl: (item: SavedItem) => string | null;
  handleUnsave: (item: SavedItem) => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const videoUrl = getVideoUrl(item);
  const isVideo = isVideoAsset(item) && videoUrl;
  
  // Debug logging
  useEffect(() => {
    if (item.type === 'asset' && isVideo) {
      console.log('Video asset detected:', {
        title: item.title,
        previewVideoPath: item.previewVideoPath,
        previewVideoUrl: item.previewVideoUrl,
        previewStoragePath: item.previewStoragePath,
        beforeVideoPath: item.beforeVideoPath,
        storagePath: item.storagePath,
        fileType: item.fileType,
        videoUrl,
        isVideo
      });
    }
  }, [item, isVideo, videoUrl]);
  
  // Determine aspect ratio based on item type
  // Templates, Overlays, and Marketplace items use aspect-video (16:9)
  // Regular assets use aspect-square
  const isTemplate = item.type === 'asset' && item.category === 'Templates';
  const isOverlay = item.type === 'asset' && (item.subCategory === 'Overlays' || item.subCategory === 'Transitions' || item.previewStoragePath);
  const isMarketplace = item.type === 'market';
  const aspectClass = (isTemplate || isOverlay || isMarketplace) ? 'aspect-video' : 'aspect-square';

  // Intersection Observer for video playback
  useEffect(() => {
    if (!isVideo || !containerRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true);
            if (videoRef.current) {
              videoRef.current.play().catch(() => {});
            }
          } else {
            setIsVisible(false);
            if (videoRef.current) {
              videoRef.current.pause();
            }
          }
        });
      },
      {
        rootMargin: '50px',
        threshold: 0.01
      }
    );

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [isVideo]);

  // Setup video element
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !isVideo || !videoUrl) return;

    video.loop = true;
    video.muted = true;
    video.playsInline = true;
    video.preload = 'metadata';
    video.crossOrigin = 'anonymous';

    const handleCanPlay = () => {
      if (isVisible) {
        video.play().catch(() => {});
      }
    };

    video.addEventListener('canplay', handleCanPlay, { once: true });
    return () => {
      video.removeEventListener('canplay', handleCanPlay);
    };
  }, [isVideo, videoUrl, isVisible]);

  return (
    <div
      ref={containerRef}
      className="group border border-neutral-800 rounded-lg bg-neutral-950/60 overflow-hidden hover:border-neutral-700 hover:shadow-xl hover:shadow-black/20 transition-all transform hover:-translate-y-0.5"
    >
      <Link href={getItemHref(item) as any} className="block">
        <div className={`relative ${aspectClass} bg-gradient-to-br from-neutral-900 to-black overflow-hidden`}>
          {isVideo && videoUrl ? (
            <>
              {/* Video preview for video assets */}
              <video
                ref={videoRef}
                src={videoUrl}
                className="absolute inset-0 w-full h-full object-cover"
                playsInline
                muted
                loop
                preload="metadata"
                crossOrigin="anonymous"
                onError={(e) => {
                  // Fallback to thumbnail if video fails
                  const videoEl = e.target as HTMLVideoElement;
                  videoEl.style.display = 'none';
                  const fallback = videoEl.nextElementSibling as HTMLElement;
                  if (fallback) fallback.style.display = 'block';
                }}
              />
              {/* Fallback thumbnail if video fails */}
              {getItemImage(item) && (
                <img
                  src={getItemImage(item)!}
                  alt={getItemTitle(item)}
                  className="absolute inset-0 w-full h-full object-cover hidden"
                  loading="lazy"
                />
              )}
            </>
          ) : getItemImage(item) ? (
            <>
              {/* Static image thumbnail */}
              <img
                src={getItemImage(item)!}
                alt={getItemTitle(item)}
                className={`absolute inset-0 ${isTemplate ? 'max-w-full max-h-full object-contain' : 'w-full h-full object-cover group-hover:scale-105'} transition-transform duration-300`}
                loading="lazy"
                decoding="async"
                onError={(e) => {
                  // Fallback to placeholder if image fails
                  e.currentTarget.style.display = 'none';
                }}
              />
            </>
          ) : (
            <div className="w-full h-full flex items-center justify-center text-neutral-600">
              <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
            </div>
          )}
          {/* Hover overlay */}
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors" />
        </div>
        <div className="p-4 bg-black">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-white truncate text-sm leading-tight">{getItemTitle(item)}</h3>
              {item.price !== undefined && (
                <p className="text-sm text-ccaBlue mt-1.5 font-medium">${item.price.toFixed(2)}</p>
              )}
              <span className="inline-block mt-2 text-xs px-2 py-1 rounded-md bg-neutral-800/80 text-neutral-400 border border-neutral-700/50">
                {item.type}
              </span>
            </div>
            <button
              onClick={async (e) => {
                e.preventDefault();
                e.stopPropagation();
                await handleUnsave(item);
              }}
              className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-md transition opacity-0 group-hover:opacity-100 flex-shrink-0"
              aria-label="Unsave"
            >
              <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 6 4 4 6.5 4c1.74 0 3.41 1 4.13 2.44C11.09 5 12.76 4 14.5 4 17 4 19 6 19 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
              </svg>
            </button>
          </div>
        </div>
      </Link>
    </div>
  );
}

export function SavedItems({ isOpen, onClose }: SavedItemsProps) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'all' | 'market' | 'video' | 'job' | 'asset' | 'course'>('all');
  const [savedItems, setSavedItems] = useState<SavedItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isOpen || !user || !db) return;

    // Capture user and db values to ensure they're not null
    const currentUser = user;
    const currentDb = db;
    
    async function fetchSavedItems() {
      setLoading(true);
      try {
        const savedRef = collection(currentDb, `users/${currentUser.uid}/saved`);
        const snapshot = await getDocs(query(savedRef, orderBy('createdAt', 'desc')));
        
        const items: SavedItem[] = [];
        for (const docSnap of snapshot.docs) {
          const data = docSnap.data();
          // Skip removed items
          if (data.removedAt) continue;
          
          const item: SavedItem = {
            id: docSnap.id,
            type: data.type as SavedType,
            targetId: data.targetId,
            ...data,
          };
          
          // If it's a lesson/video and missing muxPlaybackId, try to fetch from lesson document
          if ((item.type === 'lesson' || item.type === 'video') && !item.muxPlaybackId && item.courseSlug && item.moduleId && item.lessonId) {
            try {
              // Find course by slug
              const coursesRef = collection(currentDb, 'courses');
              const coursesSnapshot = await getDocs(coursesRef);
              let courseId: string | null = null;
              
              coursesSnapshot.forEach((courseDoc) => {
                const courseData = courseDoc.data();
                if (courseData.slug === item.courseSlug || courseDoc.id === item.courseSlug) {
                  courseId = courseDoc.id;
                }
              });
              
              if (courseId) {
                const lessonRef = doc(currentDb, `courses/${courseId}/modules/${item.moduleId}/lessons/${item.lessonId}`);
                const lessonSnap = await getDoc(lessonRef);
                if (lessonSnap.exists()) {
                  const lessonData = lessonSnap.data();
                  item.muxPlaybackId = lessonData.muxPlaybackId;
                  item.durationSec = lessonData.durationSec;
                }
              }
            } catch (err) {
              console.warn('Failed to fetch lesson thumbnail data:', err);
            }
          }
          
          // If it's a marketplace listing, fetch images from listing document
          if (item.type === 'market') {
            try {
              const listingRef = doc(currentDb, `listings/${item.targetId}`);
              const listingSnap = await getDoc(listingRef);
              if (listingSnap.exists()) {
                const listingData = listingSnap.data();
                // Use images array from listing document
                if (listingData.images && Array.isArray(listingData.images) && listingData.images.length > 0) {
                  item.images = listingData.images;
                }
                // Fill in missing title and price if not already set
                if (!item.title && listingData.title) {
                  item.title = listingData.title;
                }
                if (item.price === undefined && listingData.price !== undefined) {
                  item.price = listingData.price;
                }
              }
            } catch (err) {
              console.warn('Failed to fetch marketplace listing data:', err);
            }
          }
          
          // If it's an asset, fetch missing data from asset document or overlay document
          if (item.type === 'asset') {
            try {
              // Try to fetch from asset document first
              if (item.assetId) {
                const assetRef = doc(currentDb, `assets/${item.assetId}`);
                const assetSnap = await getDoc(assetRef);
                if (assetSnap.exists()) {
                  const assetData = assetSnap.data();
                  // Fill in missing thumbnailUrl
                  if (!item.thumbnailUrl && assetData.thumbnailUrl) {
                    item.thumbnailUrl = assetData.thumbnailUrl;
                  }
                  // Fill in missing beforeVideoPath/afterVideoPath for LUT previews
                  if (!item.beforeVideoPath && assetData.beforeVideoPath) {
                    item.beforeVideoPath = assetData.beforeVideoPath;
                  }
                  if (!item.afterVideoPath && assetData.afterVideoPath) {
                    item.afterVideoPath = assetData.afterVideoPath;
                  }
                  // Fill in missing previewVideoPath/previewVideoUrl for Plugins
                  if (!item.previewVideoPath && assetData.previewVideoPath) {
                    item.previewVideoPath = assetData.previewVideoPath;
                  }
                  if (!item.previewVideoUrl && assetData.previewVideoUrl) {
                    item.previewVideoUrl = assetData.previewVideoUrl;
                  }
                  // Fill in missing storagePath/fileType
                  if (!item.storagePath && assetData.storagePath) {
                    item.storagePath = assetData.storagePath;
                  }
                  if (!item.fileType && assetData.fileType) {
                    item.fileType = assetData.fileType;
                  }
                  // Fill in missing category/subcategory
                  if (!item.category && assetData.category) {
                    item.category = assetData.category;
                  }
                  if (!item.subCategory && assetData.subCategory) {
                    item.subCategory = assetData.subCategory;
                  }
                }
              }
              
              // For overlays, try to fetch from overlay document
              if (item.overlayId && item.assetId) {
                try {
                  const overlayRef = doc(currentDb, `assets/${item.assetId}/overlays/${item.overlayId}`);
                  const overlaySnap = await getDoc(overlayRef);
                  if (overlaySnap.exists()) {
                    const overlayData = overlaySnap.data();
                    if (!item.storagePath && overlayData.storagePath) {
                      item.storagePath = overlayData.storagePath;
                    }
                    if (!item.previewStoragePath && overlayData.previewStoragePath) {
                      item.previewStoragePath = overlayData.previewStoragePath;
                    }
                    if (!item.fileType && overlayData.fileType) {
                      item.fileType = overlayData.fileType;
                    }
                    if (!item.subCategory) {
                      // Determine subcategory from storage path
                      const pathLower = (overlayData.storagePath || '').toLowerCase();
                      if (pathLower.includes('/overlays/')) {
                        item.subCategory = 'Overlays';
                      } else if (pathLower.includes('/transitions/')) {
                        item.subCategory = 'Transitions';
                      }
                    }
                  }
                } catch (overlayErr) {
                  // Overlay document might not exist, that's okay
                }
              }
              
              // Generate thumbnailUrl from video paths if missing
              if (!item.thumbnailUrl) {
                if (item.beforeVideoPath) {
                  item.thumbnailUrl = getPublicStorageUrl(item.beforeVideoPath);
                } else if (item.previewStoragePath) {
                  item.thumbnailUrl = getPublicStorageUrl(item.previewStoragePath);
                } else if (item.storagePath) {
                  const fileType = (item.fileType || '').toLowerCase();
                  const videoExtensions = ['mov', 'mp4', 'avi', 'mkv', 'webm', 'm4v'];
                  if (videoExtensions.includes(fileType)) {
                    item.thumbnailUrl = getPublicStorageUrl(item.storagePath);
                  }
                }
              }
            } catch (err) {
              console.warn('Failed to fetch asset data:', err);
            }
          }
          
          items.push(item);
        }
        
        setSavedItems(items);
      } catch (error) {
        console.error('Error fetching saved items:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchSavedItems();
  }, [isOpen, user]);

  const filteredItems = activeTab === 'all' 
    ? savedItems
    : savedItems.filter(item => item.type === activeTab);

  const handleUnsave = async (item: SavedItem) => {
    if (!user) return;
    await toggleSaved(user.uid, item.type, item.targetId);
    setSavedItems(prev => prev.filter(i => i.id !== item.id));
  };

  const getItemHref = (item: SavedItem): string => {
    switch (item.type) {
      case 'course':
        return `/learn/${item.slug || item.targetId}`;
      case 'lesson':
        return `/learn/${item.courseSlug}/module/${item.moduleId}/lesson/${item.lessonId}`;
      case 'market':
        return `/marketplace`;
      case 'job':
        return `/opportunities`;
      case 'asset': {
        // Navigate to the correct category/subcategory using URL hash or query params
        // We'll use a hash to preserve the category state
        let href = '/assets';
        if (item.category) {
          // Map category to URL-friendly format
          const categoryMap: Record<string, string> = {
            'Overlays & Transitions': 'overlays-transitions',
            'LUTs & Presets': 'luts-presets',
            'SFX & Plugins': 'sfx-plugins',
            'Templates': 'templates',
            'All Packs': 'all',
          };
          const categoryHash = categoryMap[item.category] || '';
          if (categoryHash) {
            href = `/assets#${categoryHash}`;
            // Add subcategory if available
            if (item.subCategory) {
              const subCategoryMap: Record<string, string> = {
                'Overlays': 'overlays',
                'Transitions': 'transitions',
                'SFX': 'sfx',
                'Plugins': 'plugins',
                'LUTs': 'luts',
                'Presets': 'presets',
              };
              const subHash = subCategoryMap[item.subCategory] || '';
              if (subHash) {
                href = `/assets#${categoryHash}-${subHash}`;
              }
            }
          }
        }
        return href;
      }
      case 'video':
        return item.courseSlug 
          ? `/learn/${item.courseSlug}/module/${item.moduleId}/lesson/${item.lessonId}`
          : '/learn';
      default:
        return '/';
    }
  };

  const getItemTitle = (item: SavedItem): string => {
    return item.title || item.targetId || 'Untitled';
  };

  const getItemImage = (item: SavedItem): string | undefined => {
    // For market listings, use first image from images array
    if (item.type === 'market') {
      if (item.images && Array.isArray(item.images) && item.images.length > 0) {
        return item.images[0];
      }
      // Fallback to single image field
      if (item.image) return item.image;
    }
    
    // For assets, use thumbnailUrl (photo or video thumbnail)
    if (item.type === 'asset' && item.thumbnailUrl) return item.thumbnailUrl;
    
    // For videos/lessons, use Mux thumbnail
    if ((item.type === 'video' || item.type === 'lesson') && item.muxPlaybackId) {
      return getMuxThumbnailUrl(item.muxPlaybackId, item.durationSec);
    }
    
    // Fallback to image field for other types
    return item.image;
  };

  const isVideoAsset = (item: SavedItem): boolean => {
    if (item.type !== 'asset') return false;
    // Check if it has video paths or video file type
    // Plugins with preview videos
    if (item.previewVideoPath || item.previewVideoUrl) return true;
    // LUT previews
    if (item.beforeVideoPath || item.afterVideoPath) return true;
    // Overlays/transitions with video files
    if (item.previewStoragePath || item.storagePath) {
      const path = (item.previewStoragePath || item.storagePath || '').toLowerCase();
      const fileType = (item.fileType || '').toLowerCase();
      const videoExtensions = ['mov', 'mp4', 'avi', 'mkv', 'webm', 'm4v'];
      return videoExtensions.some(ext => path.includes(`.${ext}`) || fileType === ext);
    }
    return false;
  };

  const getVideoUrl = (item: SavedItem): string | null => {
    if (item.type !== 'asset') return null;
    // Plugins: prefer previewVideoPath (always generate fresh URL) over potentially expired previewVideoUrl
    if (item.previewVideoPath) {
      return getPublicStorageUrl(item.previewVideoPath);
    }
    if (item.previewVideoUrl) {
      return item.previewVideoUrl;
    }
    // Overlays: prefer previewStoragePath (720p version)
    if (item.previewStoragePath) {
      return getPublicStorageUrl(item.previewStoragePath);
    }
    // LUTs: use beforeVideoPath
    if (item.beforeVideoPath) {
      return getPublicStorageUrl(item.beforeVideoPath);
    }
    // Fallback: check storagePath for video files
    if (item.storagePath) {
      const fileType = (item.fileType || '').toLowerCase();
      const videoExtensions = ['mov', 'mp4', 'avi', 'mkv', 'webm', 'm4v'];
      if (videoExtensions.includes(fileType)) {
        return getPublicStorageUrl(item.storagePath);
      }
    }
    return null;
  };

  if (!isOpen) return null;

  return typeof window !== 'undefined' && createPortal(
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[150]"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="fixed inset-0 z-[160] flex items-center justify-center p-4 pointer-events-none">
        <div 
          className="bg-neutral-900 border border-neutral-800 rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col pointer-events-auto overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-neutral-800 bg-gradient-to-r from-neutral-900 to-neutral-800/50">
            <h2 className="text-2xl font-bold text-white">Saved Items</h2>
            <button
              onClick={onClose}
              className="text-neutral-400 hover:text-white transition-colors p-1 rounded-md hover:bg-neutral-800"
              aria-label="Close"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-1 px-6 pt-4 border-b border-neutral-800 bg-neutral-900/50 overflow-x-auto">
            {(['all', 'market', 'video', 'job', 'asset', 'course'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2.5 text-sm font-medium transition whitespace-nowrap relative ${
                  activeTab === tab
                    ? 'text-white'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
                {activeTab === tab && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-ccaBlue" />
                )}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6 bg-neutral-950/30">
            {loading ? (
              <div className="text-center text-neutral-400 py-16">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-ccaBlue mb-4"></div>
                <p className="text-sm">Loading saved items...</p>
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="text-center text-neutral-400 py-16">
                <svg className="w-20 h-20 mx-auto mb-4 text-neutral-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
                <p className="text-lg font-medium text-white mb-2">No saved items yet</p>
                <p className="text-sm text-neutral-500">Start saving items to see them here</p>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredItems.map((item) => (
                  <SavedItemCard
                    key={item.id}
                    item={item}
                    getItemHref={getItemHref}
                    getItemTitle={getItemTitle}
                    getItemImage={getItemImage}
                    isVideoAsset={isVideoAsset}
                    getVideoUrl={getVideoUrl}
                    handleUnsave={handleUnsave}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}

