"use client";

import { useEffect, useState } from 'react';
import { collection, getDocs, query, orderBy, where } from 'firebase/firestore';
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
  muxPlaybackId?: string;
  durationSec?: number;
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
        for (const doc of snapshot.docs) {
          const data = doc.data();
          // Skip removed items
          if (data.removedAt) continue;
          
          items.push({
            id: doc.id,
            type: data.type as SavedType,
            targetId: data.targetId,
            ...data,
          });
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
    if (item.image) return item.image;
    if (item.type === 'video' || item.type === 'lesson') {
      return item.muxPlaybackId 
        ? getMuxThumbnailUrl(item.muxPlaybackId, item.durationSec)
        : undefined;
    }
    return undefined;
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
                      <div className="relative h-40 bg-neutral-800">
                        {getItemImage(item) ? (
                          <Image
                            src={getItemImage(item)!}
                            alt={getItemTitle(item)}
                            fill
                            sizes="(max-width: 640px) 100vw, 50vw"
                            className="object-cover"
                          />
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

