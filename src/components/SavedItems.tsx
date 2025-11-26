"use client";

import { useEffect, useState } from 'react';
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
  thumbnailUrl?: string;
  muxPlaybackId?: string;
  durationSec?: number;
  assetId?: string;
  beforeVideoPath?: string;
  afterVideoPath?: string;
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

export function SavedItems({ isOpen, onClose }: SavedItemsProps) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'all' | 'market' | 'video' | 'job' | 'asset'>('all');
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
          
          // If it's an asset and missing thumbnailUrl, try to fetch from asset document
          if (item.type === 'asset' && !item.thumbnailUrl && item.assetId) {
            try {
              const assetRef = doc(currentDb, `assets/${item.assetId}`);
              const assetSnap = await getDoc(assetRef);
              if (assetSnap.exists()) {
                const assetData = assetSnap.data();
                // Use saved thumbnailUrl, or generate from beforeVideoPath if available
                if (assetData.thumbnailUrl) {
                  item.thumbnailUrl = assetData.thumbnailUrl;
                } else if (item.beforeVideoPath) {
                  // Generate public URL from storage path
                  const bucket = 'course-creator-academy-866d6.firebasestorage.app';
                  const encodedPath = encodeURIComponent(item.beforeVideoPath);
                  item.thumbnailUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodedPath}?alt=media`;
                } else if (assetData.beforeVideoPath) {
                  const bucket = 'course-creator-academy-866d6.firebasestorage.app';
                  const encodedPath = encodeURIComponent(assetData.beforeVideoPath);
                  item.thumbnailUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodedPath}?alt=media`;
                }
              }
            } catch (err) {
              console.warn('Failed to fetch asset thumbnail data:', err);
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
      case 'asset':
        return `/assets`;
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
    // For market listings, use image field
    if (item.type === 'market' && item.image) return item.image;
    
    // For assets, use thumbnailUrl (photo or video thumbnail)
    if (item.type === 'asset' && item.thumbnailUrl) return item.thumbnailUrl;
    
    // For videos/lessons, use Mux thumbnail
    if ((item.type === 'video' || item.type === 'lesson') && item.muxPlaybackId) {
      return getMuxThumbnailUrl(item.muxPlaybackId, item.durationSec);
    }
    
    // Fallback to image field for other types
    return item.image;
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
          className="bg-neutral-900 border border-neutral-800 rounded-lg shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col pointer-events-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-neutral-800">
            <h2 className="text-2xl font-bold">Saved Items</h2>
            <button
              onClick={onClose}
              className="text-neutral-400 hover:text-white transition"
              aria-label="Close"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-1 px-6 pt-4 border-b border-neutral-800 overflow-x-auto">
            {(['all', 'market', 'video', 'job', 'asset'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 text-sm font-medium transition whitespace-nowrap ${
                  activeTab === tab
                    ? 'text-white border-b-2 border-ccaBlue'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {loading ? (
              <div className="text-center text-neutral-400 py-12">
                <p>Loading saved items...</p>
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="text-center text-neutral-400 py-12">
                <svg className="w-16 h-16 mx-auto mb-4 text-neutral-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
                <p className="text-lg">No saved items yet</p>
                <p className="text-sm mt-2">Start saving items to see them here</p>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 gap-4">
                {filteredItems.map((item) => (
                  <div
                    key={item.id}
                    className="border border-neutral-800 rounded-lg bg-neutral-950/60 overflow-hidden hover:border-neutral-700 transition group"
                  >
                    <Link href={getItemHref(item) as any} className="block">
                      <div className="relative h-40 bg-neutral-800 overflow-hidden">
                        {getItemImage(item) ? (
                          <>
                            {/* Use img tag for better video file support (Firebase Storage URLs) */}
                            <img
                              src={getItemImage(item)!}
                              alt={getItemTitle(item)}
                              className="w-full h-full object-cover"
                              loading="lazy"
                              onError={(e) => {
                                // Fallback to placeholder if image/video fails
                                e.currentTarget.style.display = 'none';
                              }}
                            />
                            {/* Play icon overlay for video thumbnails (LUT previews) */}
                            {item.type === 'asset' && (item.beforeVideoPath || item.afterVideoPath) && (
                              <div className="absolute inset-0 flex items-center justify-center bg-black/20 pointer-events-none">
                                <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center">
                                  <svg className="w-6 h-6 text-black ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M8 5v14l11-7z"/>
                                  </svg>
                                </div>
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-neutral-600">
                            <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                            </svg>
                          </div>
                        )}
                      </div>
                      <div className="p-4">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold truncate">{getItemTitle(item)}</h3>
                            {item.price !== undefined && (
                              <p className="text-sm text-ccaBlue mt-1">${item.price.toFixed(2)}</p>
                            )}
                            <span className="inline-block mt-2 text-xs px-2 py-1 rounded bg-neutral-800 text-neutral-400">
                              {item.type}
                            </span>
                          </div>
                          <button
                            onClick={async (e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              await handleUnsave(item);
                            }}
                            className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded transition opacity-0 group-hover:opacity-100"
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

