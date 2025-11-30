"use client";
import { useState, useEffect, useCallback, useRef } from 'react';
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

interface LUTFile {
  id: string;
  assetId: string;
  assetTitle: string;
  lutName: string;
  beforeVideoPath?: string;
  afterVideoPath?: string;
  lutFilePath?: string;
  fileName?: string;
  isPlaceholder?: boolean; // True if this is a placeholder for an asset without previews
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
  const [lutFiles, setLutFiles] = useState<LUTFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [lutLoading, setLutLoading] = useState(true);
  const [draggedFile, setDraggedFile] = useState<OverlayFile | null>(null);
  const [dragOverCategory, setDragOverCategory] = useState<SubCategory | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);
  const [uploadingLUT, setUploadingLUT] = useState<string | null>(null);
  const [expandedLUT, setExpandedLUT] = useState<string | null>(null);
  const [editingLutName, setEditingLutName] = useState<{ [key: string]: string }>({});
  
  const beforeVideoInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});
  const afterVideoInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});

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

  // Load LUT files via API
  useEffect(() => {
    const loadLUTFiles = async () => {
      if (!user) {
        setLutLoading(false);
        return;
      }

      try {
        const idToken = await user.getIdToken();
        const response = await fetch('/api/admin/assets/lut-files', {
          headers: {
            'Authorization': `Bearer ${idToken}`,
          },
        });

        if (!response.ok) {
          throw new Error('Failed to fetch LUT files');
        }

        const data = await response.json();
        setLutFiles(data.luts || []);
      } catch (error) {
        console.error('Error loading LUT files:', error);
      } finally {
        setLutLoading(false);
      }
    };

    loadLUTFiles();
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

  const handleLUTVideoUpload = useCallback(async (
    lut: LUTFile,
    videoType: 'before' | 'after',
    file: File
  ) => {
    if (!user) return;

    setUploadingLUT(`${lut.id}-${videoType}`);

    try {
      const idToken = await user.getIdToken();
      
      // Step 1: Upload video file
      const formData = new FormData();
      formData.append('file', file);
      formData.append('assetId', lut.assetId);
      formData.append('lutPreviewId', lut.id);
      formData.append('videoType', videoType);

      const uploadResponse = await fetch('/api/admin/assets/update-lut-videos', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${idToken}`,
        },
        body: formData,
      });

      if (!uploadResponse.ok) {
        const error = await uploadResponse.json();
        throw new Error(error.error || 'Failed to upload video');
      }

      const { storagePath } = await uploadResponse.json();

      // Step 2: Update or create LUT preview document
      const isPlaceholder = lut.isPlaceholder || lut.id.startsWith('placeholder-');
      const lutName = isPlaceholder 
        ? (editingLutName[lut.id] || lut.lutName)
        : undefined;

      const updateResponse = await fetch('/api/admin/assets/update-lut-videos', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          assetId: lut.assetId,
          lutPreviewId: lut.id,
          ...(lutName ? { lutName } : {}),
          [videoType === 'before' ? 'beforeVideoPath' : 'afterVideoPath']: storagePath,
        }),
      });

      if (!updateResponse.ok) {
        const error = await updateResponse.json();
        throw new Error(error.error || 'Failed to update LUT preview');
      }

      const updateData = await updateResponse.json();
      
      // If a new preview was created, update the local state
      if (isPlaceholder && updateData.lutPreviewId) {
        // Clear editing state for this LUT
        setEditingLutName(prev => {
          const newState = { ...prev };
          delete newState[lut.id];
          return newState;
        });
      }

      // Reload LUT files
      const reloadResponse = await fetch('/api/admin/assets/lut-files', {
        headers: {
          'Authorization': `Bearer ${idToken}`,
        },
      });

      if (reloadResponse.ok) {
        const reloadData = await reloadResponse.json();
        setLutFiles(reloadData.luts || []);
      }

      if (onCategoryChange) {
        onCategoryChange();
      }
    } catch (error: unknown) {
      console.error('Error uploading LUT video:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to upload video';
      alert(`Failed to upload video: ${errorMessage}`);
    } finally {
      setUploadingLUT(null);
    }
  }, [user, onCategoryChange, editingLutName]);

  const handleVideoFileSelect = useCallback((
    lut: LUTFile,
    videoType: 'before' | 'after',
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('video/')) {
      // For placeholders, ensure LUT name is set
      if (lut.isPlaceholder && !editingLutName[lut.id] && !lut.lutName) {
        alert('Please enter a LUT name first');
        e.target.value = '';
        return;
      }
      handleLUTVideoUpload(lut, videoType, file);
    } else {
      alert('Please select a video file');
    }
    // Reset input
    e.target.value = '';
  }, [handleLUTVideoUpload, editingLutName]);

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

      {/* LUTs File Manager Section */}
      <div className="mt-12">
        <h2 className="text-2xl font-bold mb-4">LUTs File Manager</h2>
        <p className="text-neutral-400 mb-6">
          Upload before and after video previews for each LUT. These videos will be used in the side-by-side slider on the assets page.
        </p>

        {lutLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-ccaBlue"></div>
          </div>
        ) : (
          <div className="space-y-4 max-h-[800px] overflow-y-auto">
            {lutFiles.length === 0 ? (
              <p className="text-neutral-500 text-sm py-8 text-center">
                No LUT previews found
              </p>
            ) : (
              lutFiles.map((lut) => {
                const isExpanded = expandedLUT === lut.id;
                const isUploadingBefore = uploadingLUT === `${lut.id}-before`;
                const isUploadingAfter = uploadingLUT === `${lut.id}-after`;

                return (
                  <div
                    key={lut.id}
                    className="border border-neutral-700 bg-neutral-800 rounded-lg p-4"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-lg font-semibold truncate">{lut.lutName}</h3>
                        <p className="text-sm text-neutral-400 truncate mt-1">
                          From: {lut.assetTitle}
                        </p>
                        <div className="flex gap-4 mt-2 text-xs text-neutral-500">
                          <span>
                            Before: {lut.beforeVideoPath ? '✓ Set' : '✗ Not set'}
                          </span>
                          <span>
                            After: {lut.afterVideoPath ? '✓ Set' : '✗ Not set'}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => setExpandedLUT(isExpanded ? null : lut.id)}
                        className="ml-4 px-4 py-2 bg-ccaBlue hover:bg-ccaBlue/80 text-white rounded text-sm transition-colors"
                      >
                        {isExpanded ? 'Collapse' : 'Edit Videos'}
                      </button>
                    </div>

                    {isExpanded && (
                      <div className="mt-4 pt-4 border-t border-neutral-700 space-y-4">
                        {/* LUT Name Input for Placeholders */}
                        {lut.isPlaceholder && (
                          <div>
                            <label className="block text-sm font-medium mb-2">
                              LUT Name *
                            </label>
                            <input
                              type="text"
                              value={editingLutName[lut.id] || lut.lutName}
                              onChange={(e) => setEditingLutName(prev => ({
                                ...prev,
                                [lut.id]: e.target.value
                              }))}
                              placeholder="Enter LUT name"
                              className="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 rounded text-white"
                            />
                            <p className="text-xs text-neutral-400 mt-1">
                              This will be the name displayed for this LUT preview
                            </p>
                          </div>
                        )}

                        {/* Before Video Upload */}
                        <div>
                          <label className="block text-sm font-medium mb-2">
                            Before Video {lut.beforeVideoPath && '(✓ Uploaded)'}
                          </label>
                          {lut.beforeVideoPath && (
                            <p className="text-xs text-neutral-400 mb-2 truncate">
                              {lut.beforeVideoPath}
                            </p>
                          )}
                          <input
                            ref={(el) => {
                              beforeVideoInputRefs.current[`${lut.id}-before`] = el;
                            }}
                            type="file"
                            accept="video/*"
                            onChange={(e) => handleVideoFileSelect(lut, 'before', e)}
                            disabled={isUploadingBefore}
                            className="hidden"
                            id={`before-${lut.id}`}
                          />
                          <label
                            htmlFor={`before-${lut.id}`}
                            className={`
                              inline-block px-4 py-2 rounded cursor-pointer transition-colors
                              ${isUploadingBefore
                                ? 'bg-neutral-600 text-neutral-400 cursor-not-allowed'
                                : 'bg-neutral-700 hover:bg-neutral-600 text-white'
                              }
                            `}
                          >
                            {isUploadingBefore ? 'Uploading...' : lut.beforeVideoPath ? 'Replace Before Video' : 'Upload Before Video'}
                          </label>
                        </div>

                        {/* After Video Upload */}
                        <div>
                          <label className="block text-sm font-medium mb-2">
                            After Video {lut.afterVideoPath && '(✓ Uploaded)'}
                          </label>
                          {lut.afterVideoPath && (
                            <p className="text-xs text-neutral-400 mb-2 truncate">
                              {lut.afterVideoPath}
                            </p>
                          )}
                          <input
                            ref={(el) => {
                              afterVideoInputRefs.current[`${lut.id}-after`] = el;
                            }}
                            type="file"
                            accept="video/*"
                            onChange={(e) => handleVideoFileSelect(lut, 'after', e)}
                            disabled={isUploadingAfter}
                            className="hidden"
                            id={`after-${lut.id}`}
                          />
                          <label
                            htmlFor={`after-${lut.id}`}
                            className={`
                              inline-block px-4 py-2 rounded cursor-pointer transition-colors
                              ${isUploadingAfter
                                ? 'bg-neutral-600 text-neutral-400 cursor-not-allowed'
                                : 'bg-neutral-700 hover:bg-neutral-600 text-white'
                              }
                            `}
                          >
                            {isUploadingAfter ? 'Uploading...' : lut.afterVideoPath ? 'Replace After Video' : 'Upload After Video'}
                          </label>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}
