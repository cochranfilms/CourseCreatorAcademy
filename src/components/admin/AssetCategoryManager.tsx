"use client";
import { useState, useEffect, useCallback } from 'react';
import { collection, query, getDocs, orderBy } from 'firebase/firestore';
import { db, firebaseReady } from '@/lib/firebaseClient';
import { useAuth } from '@/contexts/AuthContext';

interface Asset {
  id: string;
  title: string;
  category: string;
  storagePath?: string;
  thumbnailUrl?: string;
}

type SubCategory = 'Overlays' | 'Transitions' | 'SFX' | 'Plugins' | null;

/**
 * Gets subcategory from storage path
 */
function getSubCategory(asset: Asset): SubCategory {
  if (!asset.storagePath) return null;
  
  const path = asset.storagePath.toLowerCase();
  if (path.includes('/overlays/')) return 'Overlays';
  if (path.includes('/transitions/')) return 'Transitions';
  if (path.includes('/sfx/')) return 'SFX';
  if (path.includes('/plugins/')) return 'Plugins';
  
  return null;
}

interface AssetCategoryManagerProps {
  onCategoryChange?: () => void;
}

export function AssetCategoryManager({ onCategoryChange }: AssetCategoryManagerProps) {
  const { user } = useAuth();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [draggedAsset, setDraggedAsset] = useState<Asset | null>(null);
  const [dragOverCategory, setDragOverCategory] = useState<SubCategory | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);

  // Group assets by subcategory
  const groupedAssets = {
    Overlays: assets.filter(a => getSubCategory(a) === 'Overlays'),
    Transitions: assets.filter(a => getSubCategory(a) === 'Transitions'),
    SFX: assets.filter(a => getSubCategory(a) === 'SFX'),
    Plugins: assets.filter(a => getSubCategory(a) === 'Plugins'),
  };

  // Load assets
  useEffect(() => {
    const loadAssets = async () => {
      if (!firebaseReady || !db) {
        setLoading(false);
        return;
      }

      try {
        // Only load assets from relevant categories
        const q = query(
          collection(db, 'assets'),
          orderBy('createdAt', 'desc')
        );
        const snapshot = await getDocs(q);
        const loadedAssets: Asset[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          // Only include assets that can be categorized
          if (data.category === 'Overlays & Transitions' || data.category === 'SFX & Plugins') {
            loadedAssets.push({
              id: doc.id,
              ...data
            } as Asset);
          }
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

  const handleDragStart = useCallback((e: React.DragEvent, asset: Asset) => {
    setDraggedAsset(asset);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', asset.id);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, category: SubCategory) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverCategory(category);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOverCategory(null);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent, targetCategory: SubCategory) => {
    e.preventDefault();
    setDragOverCategory(null);

    if (!draggedAsset || !user) return;

    const currentCategory = getSubCategory(draggedAsset);
    if (currentCategory === targetCategory) {
      setDraggedAsset(null);
      return;
    }

    // Determine the new storage path
    const oldPath = draggedAsset.storagePath || '';
    let newPath = oldPath;

    if (targetCategory === 'Overlays') {
      newPath = oldPath.replace(/\/transitions\//g, '/overlays/');
    } else if (targetCategory === 'Transitions') {
      newPath = oldPath.replace(/\/overlays\//g, '/transitions/');
    } else if (targetCategory === 'SFX') {
      newPath = oldPath.replace(/\/plugins\//g, '/sfx/');
    } else if (targetCategory === 'Plugins') {
      newPath = oldPath.replace(/\/sfx\//g, '/plugins/');
    }

    if (newPath === oldPath) {
      setDraggedAsset(null);
      return;
    }

    setUpdating(draggedAsset.id);

    try {
      const idToken = await user.getIdToken();
      const response = await fetch('/api/admin/assets/update-category', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          assetId: draggedAsset.id,
          newStoragePath: newPath,
          targetCategory,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update category');
      }

      // Reload assets
      const q = query(collection(db, 'assets'), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      const loadedAssets: Asset[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        if (data.category === 'Overlays & Transitions' || data.category === 'SFX & Plugins') {
          loadedAssets.push({
            id: doc.id,
            ...data
          } as Asset);
        }
      });
      setAssets(loadedAssets);

      if (onCategoryChange) {
        onCategoryChange();
      }
    } catch (error: any) {
      console.error('Error updating category:', error);
      alert(`Failed to update category: ${error.message}`);
    } finally {
      setUpdating(null);
      setDraggedAsset(null);
    }
  }, [draggedAsset, user, onCategoryChange]);

  const handleDragEnd = useCallback(() => {
    setDraggedAsset(null);
    setDragOverCategory(null);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-ccaBlue"></div>
      </div>
    );
  }

  const categories: { name: SubCategory; label: string }[] = [
    { name: 'Overlays', label: 'Overlays' },
    { name: 'Transitions', label: 'Transitions' },
    { name: 'SFX', label: 'SFX' },
    { name: 'Plugins', label: 'Plugins' },
  ];

  return (
    <div className="mt-8 space-y-6">
      <h2 className="text-2xl font-bold mb-4">Asset Category Manager</h2>
      <p className="text-neutral-400 mb-6">
        Drag and drop assets between categories to reorganize them. Changes will update the storage paths and Firestore documents.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {categories.map(({ name, label }) => {
          const categoryAssets = groupedAssets[name as keyof typeof groupedAssets] || [];
          const isDragOver = dragOverCategory === name;
          const isUpdating = updating !== null && categoryAssets.some(a => a.id === updating);

          return (
            <div
              key={name}
              onDragOver={(e) => handleDragOver(e, name)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, name)}
              className={`
                border-2 rounded-lg p-4 min-h-[300px] transition-colors
                ${isDragOver 
                  ? 'border-ccaBlue bg-ccaBlue/10' 
                  : 'border-neutral-800 bg-neutral-900/50'
                }
              `}
            >
              <h3 className="text-lg font-semibold mb-3 flex items-center justify-between">
                <span>{label}</span>
                <span className="text-sm text-neutral-400 font-normal">
                  ({categoryAssets.length} assets)
                </span>
              </h3>

              {isUpdating && (
                <div className="mb-3 text-sm text-ccaBlue flex items-center gap-2">
                  <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-ccaBlue"></div>
                  Updating...
                </div>
              )}

              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {categoryAssets.length === 0 ? (
                  <p className="text-neutral-500 text-sm py-8 text-center">
                    No assets in this category
                  </p>
                ) : (
                  categoryAssets.map((asset) => (
                    <div
                      key={asset.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, asset)}
                      onDragEnd={handleDragEnd}
                      className={`
                        p-3 rounded-lg border cursor-move transition-all
                        ${draggedAsset?.id === asset.id
                          ? 'opacity-50 border-ccaBlue bg-ccaBlue/10'
                          : 'border-neutral-700 bg-neutral-800 hover:border-neutral-600'
                        }
                        ${updating === asset.id ? 'opacity-50 pointer-events-none' : ''}
                      `}
                    >
                      <div className="flex items-center gap-3">
                        {asset.thumbnailUrl && (
                          <img
                            src={asset.thumbnailUrl}
                            alt={asset.title}
                            className="w-12 h-12 object-cover rounded"
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{asset.title}</p>
                          {asset.storagePath && (
                            <p className="text-xs text-neutral-500 truncate">
                              {asset.storagePath}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

