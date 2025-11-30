"use client";
import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';

interface PresetFile {
  id: string;
  assetId: string;
  assetTitle: string;
  fileName: string;
  storagePath: string;
  fileType?: string;
  relativePath?: string;
  beforeImagePath?: string;
  beforeImageUrl?: string;
  afterImagePath?: string;
  afterImageUrl?: string;
}

interface PresetFileManagerProps {
  onCategoryChange?: () => void;
}

export function PresetFileManager({ onCategoryChange }: PresetFileManagerProps) {
  const { user } = useAuth();
  const [presetFiles, setPresetFiles] = useState<PresetFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadingImage, setUploadingImage] = useState<string | null>(null);
  const [expandedAsset, setExpandedAsset] = useState<string | null>(null);
  const [editingFileName, setEditingFileName] = useState<{ [key: string]: string }>({});
  const [updatingFileName, setUpdatingFileName] = useState<string | null>(null);
  
  const beforeImageInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});
  const afterImageInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});

  // Load preset files via API
  useEffect(() => {
    const loadPresetFiles = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        const idToken = await user.getIdToken();
        const response = await fetch('/api/admin/assets/preset-files', {
          headers: {
            'Authorization': `Bearer ${idToken}`,
          },
        });

        if (!response.ok) {
          throw new Error('Failed to fetch preset files');
        }

        const data = await response.json();
        setPresetFiles(data.files || []);
      } catch (error) {
        console.error('Error loading preset files:', error);
      } finally {
        setLoading(false);
      }
    };

    loadPresetFiles();
  }, [user]);

  // Group presets by asset
  const presetsByAsset = presetFiles.reduce((acc, preset) => {
    if (!acc[preset.assetId]) {
      acc[preset.assetId] = {
        assetId: preset.assetId,
        assetTitle: preset.assetTitle,
        presets: [],
      };
    }
    acc[preset.assetId].presets.push(preset);
    return acc;
  }, {} as Record<string, { assetId: string; assetTitle: string; presets: PresetFile[] }>);

  const handleImageUpload = useCallback(async (
    preset: PresetFile,
    imageType: 'before' | 'after',
    file: File
  ) => {
    if (!user) return;

    setUploadingImage(`${preset.id}-${imageType}`);

    try {
      const idToken = await user.getIdToken();
      
      // Upload image file
      const formData = new FormData();
      formData.append('file', file);
      formData.append('assetId', preset.assetId);
      formData.append('presetId', preset.id);
      formData.append('imageType', imageType);

      const uploadResponse = await fetch('/api/admin/assets/update-preset-images', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${idToken}`,
        },
        body: formData,
      });

      if (!uploadResponse.ok) {
        const error = await uploadResponse.json();
        throw new Error(error.error || 'Failed to upload image');
      }

      // Reload preset files
      const reloadResponse = await fetch('/api/admin/assets/preset-files', {
        headers: {
          'Authorization': `Bearer ${idToken}`,
        },
      });

      if (reloadResponse.ok) {
        const reloadData = await reloadResponse.json();
        setPresetFiles(reloadData.files || []);
      }

      if (onCategoryChange) {
        onCategoryChange();
      }
    } catch (error: unknown) {
      console.error('Error uploading preset image:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to upload image';
      alert(`Failed to upload image: ${errorMessage}`);
    } finally {
      setUploadingImage(null);
    }
  }, [user, onCategoryChange]);

  const handleImageFileSelect = useCallback((
    preset: PresetFile,
    imageType: 'before' | 'after',
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (file) {
      if (/\.(jpg|jpeg|png|webp)$/i.test(file.name)) {
        handleImageUpload(preset, imageType, file);
      } else {
        alert('Please upload a valid image file (JPG, PNG, or WebP)');
      }
    }
    // Reset input
    e.target.value = '';
  }, [handleImageUpload]);

  const handleFileNameUpdate = useCallback(async (preset: PresetFile, newFileName: string) => {
    if (!user || !newFileName.trim() || newFileName.trim() === preset.fileName) {
      return;
    }

    setUpdatingFileName(preset.id);
    try {
      const idToken = await user.getIdToken();
      const response = await fetch('/api/admin/assets/update-preset-filename', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          assetId: preset.assetId,
          presetId: preset.id,
          fileName: newFileName.trim(),
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update fileName');
      }

      // Reload preset files
      const reloadResponse = await fetch('/api/admin/assets/preset-files', {
        headers: {
          'Authorization': `Bearer ${idToken}`,
        },
      });

      if (reloadResponse.ok) {
        const reloadData = await reloadResponse.json();
        setPresetFiles(reloadData.files || []);
      }

      if (onCategoryChange) {
        onCategoryChange();
      }
    } catch (error: unknown) {
      console.error('Error updating preset fileName:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to update fileName';
      alert(`Failed to update fileName: ${errorMessage}`);
    } finally {
      setUpdatingFileName(null);
      setEditingFileName(prev => {
        const newState = { ...prev };
        delete newState[preset.id];
        return newState;
      });
    }
  }, [user, onCategoryChange]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-ccaBlue"></div>
      </div>
    );
  }

  if (presetFiles.length === 0) {
    return (
      <div className="mt-8 p-6 bg-neutral-900/50 border border-neutral-800 rounded-lg">
        <p className="text-neutral-400 text-center">
          No preset files found. Upload a preset ZIP file first.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-8 space-y-6">
      <h2 className="text-2xl font-bold mb-4">Preset File Manager</h2>
      <p className="text-neutral-400 mb-6">
        Upload before/after preview images for individual preset files. These images will be used in the preset preview slider.
      </p>

      <div className="space-y-6">
        {Object.values(presetsByAsset).map(({ assetId, assetTitle, presets }) => (
          <div key={assetId} className="bg-neutral-900/50 border border-neutral-800 rounded-lg overflow-hidden">
            <button
              onClick={() => setExpandedAsset(expandedAsset === assetId ? null : assetId)}
              className="w-full px-6 py-4 flex items-center justify-between hover:bg-neutral-800/50 transition-colors"
            >
              <div className="text-left">
                <h3 className="text-lg font-semibold text-white">{assetTitle}</h3>
                <p className="text-sm text-neutral-400">{presets.length} preset file{presets.length !== 1 ? 's' : ''}</p>
              </div>
              <svg
                className={`w-5 h-5 text-neutral-400 transition-transform ${expandedAsset === assetId ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {expandedAsset === assetId && (
              <div className="px-6 py-4 border-t border-neutral-800 space-y-4">
                {presets.map((preset) => {
                  const isEditing = editingFileName[preset.id] !== undefined;
                  const isUpdating = updatingFileName === preset.id;
                  
                  return (
                    <div key={preset.id} className="bg-neutral-950 border border-neutral-800 rounded-lg p-4">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1 min-w-0">
                          {isEditing ? (
                            <div className="flex items-center gap-2">
                              <input
                                type="text"
                                value={editingFileName[preset.id] || preset.fileName}
                                onChange={(e) => setEditingFileName(prev => ({
                                  ...prev,
                                  [preset.id]: e.target.value
                                }))}
                                onBlur={() => {
                                  const newFileName = editingFileName[preset.id];
                                  if (newFileName && newFileName.trim() && newFileName.trim() !== preset.fileName) {
                                    handleFileNameUpdate(preset, newFileName.trim());
                                  } else {
                                    setEditingFileName(prev => {
                                      const newState = { ...prev };
                                      delete newState[preset.id];
                                      return newState;
                                    });
                                  }
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.currentTarget.blur();
                                  } else if (e.key === 'Escape') {
                                    setEditingFileName(prev => {
                                      const newState = { ...prev };
                                      delete newState[preset.id];
                                      return newState;
                                    });
                                  }
                                }}
                                autoFocus
                                disabled={isUpdating}
                                className="flex-1 px-2 py-1 bg-neutral-900 border border-neutral-700 rounded text-white text-sm font-medium"
                              />
                              {isUpdating && (
                                <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-ccaBlue"></div>
                              )}
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <h4 className="text-sm font-medium text-white mb-1 truncate">{preset.fileName}</h4>
                              <button
                                onClick={() => {
                                  setEditingFileName(prev => ({
                                    ...prev,
                                    [preset.id]: preset.fileName
                                  }));
                                }}
                                className="p-1 text-neutral-400 hover:text-white transition-colors"
                                title="Edit file name"
                              >
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                              </button>
                            </div>
                          )}
                          {preset.relativePath && (
                            <p className="text-xs text-neutral-500 truncate">{preset.relativePath}</p>
                          )}
                        </div>
                      </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Before Image */}
                      <div>
                        <label className="block text-xs font-medium text-neutral-300 mb-2">
                          Before Image
                        </label>
                        <div className="space-y-2">
                          {preset.beforeImageUrl ? (
                            <div className="relative">
                              <img
                                src={preset.beforeImageUrl}
                                alt="Before preview"
                                className="w-full h-32 object-cover rounded-lg border border-neutral-800"
                              />
                              <button
                                onClick={() => beforeImageInputRefs.current[`${preset.id}-before`]?.click()}
                                disabled={uploadingImage === `${preset.id}-before`}
                                className="absolute top-2 right-2 px-2 py-1 bg-ccaBlue hover:bg-ccaBlue/80 text-white text-xs rounded disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {uploadingImage === `${preset.id}-before` ? 'Uploading...' : 'Change'}
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => beforeImageInputRefs.current[`${preset.id}-before`]?.click()}
                              disabled={uploadingImage === `${preset.id}-before`}
                              className="w-full px-4 py-8 bg-neutral-900 border-2 border-dashed border-neutral-800 rounded-lg text-neutral-400 hover:border-ccaBlue hover:text-ccaBlue transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {uploadingImage === `${preset.id}-before` ? 'Uploading...' : 'Upload Before Image'}
                            </button>
                          )}
                          <input
                            ref={(el) => {
                              beforeImageInputRefs.current[`${preset.id}-before`] = el;
                            }}
                            type="file"
                            accept="image/jpeg,image/jpg,image/png,image/webp"
                            onChange={(e) => handleImageFileSelect(preset, 'before', e)}
                            className="hidden"
                            disabled={uploadingImage === `${preset.id}-before`}
                          />
                        </div>
                      </div>

                      {/* After Image */}
                      <div>
                        <label className="block text-xs font-medium text-neutral-300 mb-2">
                          After Image
                        </label>
                        <div className="space-y-2">
                          {preset.afterImageUrl ? (
                            <div className="relative">
                              <img
                                src={preset.afterImageUrl}
                                alt="After preview"
                                className="w-full h-32 object-cover rounded-lg border border-neutral-800"
                              />
                              <button
                                onClick={() => afterImageInputRefs.current[`${preset.id}-after`]?.click()}
                                disabled={uploadingImage === `${preset.id}-after`}
                                className="absolute top-2 right-2 px-2 py-1 bg-ccaBlue hover:bg-ccaBlue/80 text-white text-xs rounded disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {uploadingImage === `${preset.id}-after` ? 'Uploading...' : 'Change'}
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => afterImageInputRefs.current[`${preset.id}-after`]?.click()}
                              disabled={uploadingImage === `${preset.id}-after`}
                              className="w-full px-4 py-8 bg-neutral-900 border-2 border-dashed border-neutral-800 rounded-lg text-neutral-400 hover:border-ccaBlue hover:text-ccaBlue transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {uploadingImage === `${preset.id}-after` ? 'Uploading...' : 'Upload After Image'}
                            </button>
                          )}
                          <input
                            ref={(el) => {
                              afterImageInputRefs.current[`${preset.id}-after`] = el;
                            }}
                            type="file"
                            accept="image/jpeg,image/jpg,image/png,image/webp"
                            onChange={(e) => handleImageFileSelect(preset, 'after', e)}
                            className="hidden"
                            disabled={uploadingImage === `${preset.id}-after`}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

