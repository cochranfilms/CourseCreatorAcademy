"use client";
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';

interface OverlayFile {
  id: string;
  assetId: string;
  assetTitle: string;
  fileName: string;
  storagePath: string;
  previewStoragePath?: string;
  fileType?: string;
}

type SubCategory = 'Overlays' | 'Transitions' | 'SFX' | 'Plugins' | null;

/**
 * Gets subcategory from storage path
 */
function getSubCategory(storagePath: string): SubCategory {
  if (!storagePath) return null;
  
  const path = storagePath.toLowerCase();
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
  const [overlayFiles, setOverlayFiles] = useState<OverlayFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [draggedFile, setDraggedFile] = useState<OverlayFile | null>(null);
  const [dragOverCategory, setDragOverCategory] = useState<SubCategory | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);

  // Group overlay files by subcategory
  const groupedFiles = {
    Overlays: overlayFiles.filter(f => getSubCategory(f.storagePath) === 'Overlays'),
    Transitions: overlayFiles.filter(f => getSubCategory(f.storagePath) === 'Transitions'),
    SFX: overlayFiles.filter(f => getSubCategory(f.storagePath) === 'SFX'),
    Plugins: overlayFiles.filter(f => getSubCategory(f.storagePath) === 'Plugins'),
  };

  // Load individual overlay/transition files via API
  useEffect(() => {
    const loadOverlayFiles = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        const idToken = await user.getIdToken();
        const response = await fetch('/api/admin/assets/overlay-files', {
          headers: {
            'Authorization': `Bearer ${idToken}`,
          },
        });

        if (!response.ok) {
          throw new Error('Failed to fetch overlay files');
        }

        const data = await response.json();
        setOverlayFiles(data.files || []);
      } catch (error) {
        console.error('Error loading overlay files:', error);
      } finally {
        setLoading(false);
      }
    };

    loadOverlayFiles();
  }, [user]);

  const handleDragStart = useCallback((e: React.DragEvent, file: OverlayFile) => {
    setDraggedFile(file);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', file.id);
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

    if (!draggedFile || !user) return;

    const currentCategory = getSubCategory(draggedFile.storagePath);
    if (currentCategory === targetCategory) {
      setDraggedFile(null);
      return;
    }

    // Only allow moving between Overlays and Transitions
    if (targetCategory !== 'Overlays' && targetCategory !== 'Transitions') {
      setDraggedFile(null);
      return;
    }

    if (currentCategory !== 'Overlays' && currentCategory !== 'Transitions') {
      setDraggedFile(null);
      return;
    }

    setUpdating(draggedFile.id);

    try {
      const idToken = await user.getIdToken();
      const response = await fetch('/api/admin/assets/update-overlay-category', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          assetId: draggedFile.assetId,
          overlayId: draggedFile.id,
          targetCategory,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update category');
      }

      // Reload overlay files via API
      const reloadResponse = await fetch('/api/admin/assets/overlay-files', {
        headers: {
          'Authorization': `Bearer ${idToken}`,
        },
      });

      if (reloadResponse.ok) {
        const reloadData = await reloadResponse.json();
        setOverlayFiles(reloadData.files || []);
      }

      if (onCategoryChange) {
        onCategoryChange();
      }
    } catch (error: unknown) {
      console.error('Error updating category:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to update category';
      alert(`Failed to update category: ${errorMessage}`);
    } finally {
      setUpdating(null);
      setDraggedFile(null);
    }
  }, [draggedFile, user, onCategoryChange]);

  const handleDragEnd = useCallback(() => {
    setDraggedFile(null);
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
  ];

  return (
    <div className="mt-8 space-y-6">
      <h2 className="text-2xl font-bold mb-4">Individual Overlay/Transition File Manager</h2>
      <p className="text-neutral-400 mb-6">
        Drag and drop individual overlay/transition files between categories. This moves the actual files in Firebase Storage and updates their Firestore documents.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {categories.map(({ name, label }) => {
          const categoryFiles = groupedFiles[name as keyof typeof groupedFiles] || [];
          const isDragOver = dragOverCategory === name;
          const isUpdating = updating !== null && categoryFiles.some(f => f.id === updating);

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
                  ({categoryFiles.length} files)
                </span>
              </h3>

              {isUpdating && (
                <div className="mb-3 text-sm text-ccaBlue flex items-center gap-2">
                  <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-ccaBlue"></div>
                  Updating...
                </div>
              )}

              <div className="space-y-2 max-h-[600px] overflow-y-auto">
                {categoryFiles.length === 0 ? (
                  <p className="text-neutral-500 text-sm py-8 text-center">
                    No files in this category
                  </p>
                ) : (
                  categoryFiles.map((file) => (
                    <div
                      key={file.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, file)}
                      onDragEnd={handleDragEnd}
                      className={`
                        p-3 rounded-lg border cursor-move transition-all
                        ${draggedFile?.id === file.id
                          ? 'opacity-50 border-ccaBlue bg-ccaBlue/10'
                          : 'border-neutral-700 bg-neutral-800 hover:border-neutral-600'
                        }
                        ${updating === file.id ? 'opacity-50 pointer-events-none' : ''}
                      `}
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{file.fileName}</p>
                          <p className="text-xs text-neutral-400 truncate mt-1">
                            From: {file.assetTitle}
                          </p>
                          {file.storagePath && (
                            <p className="text-xs text-neutral-500 truncate mt-1">
                              {file.storagePath}
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
