"use client";
import { useState, useCallback, useRef } from 'react';

type Category = 'Overlays & Transitions' | 'SFX & Plugins' | 'LUTs & Presets' | 'Templates';
type SubCategory = 'Overlays' | 'Transitions' | 'SFX' | 'Plugins' | 'LUTs' | 'Presets' | null;

interface AssetUploadZoneProps {
  onFileSelect: (file: File, category: Category, thumbnail?: File, subCategory?: SubCategory, previewVideo?: File, description?: string, beforeImage?: File, afterImage?: File) => void;
  disabled?: boolean;
}

export function AssetUploadZone({ onFileSelect, disabled }: AssetUploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<Category>('Overlays & Transitions');
  const [selectedSubCategory, setSelectedSubCategory] = useState<SubCategory>('Overlays');
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null);
  const [previewVideoFile, setPreviewVideoFile] = useState<File | null>(null);
  const [beforeImageFile, setBeforeImageFile] = useState<File | null>(null);
  const [beforeImagePreview, setBeforeImagePreview] = useState<string | null>(null);
  const [afterImageFile, setAfterImageFile] = useState<File | null>(null);
  const [afterImagePreview, setAfterImagePreview] = useState<string | null>(null);
  const [description, setDescription] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const thumbnailInputRef = useRef<HTMLInputElement>(null);
  const previewVideoInputRef = useRef<HTMLInputElement>(null);
  const beforeImageInputRef = useRef<HTMLInputElement>(null);
  const afterImageInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) {
      setIsDragging(true);
    }
  }, [disabled]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    if (disabled) return;

    const files = Array.from(e.dataTransfer.files);
    const zipFile = files.find(f => f.name.endsWith('.zip'));
    const imageFile = files.find(f => /\.(jpg|jpeg|png|webp)$/i.test(f.name));
    const videoFile = files.find(f => /\.(mp4)$/i.test(f.name));

    if (zipFile) {
      const subCategory = (selectedCategory === 'Overlays & Transitions' || selectedCategory === 'SFX & Plugins' || selectedCategory === 'LUTs & Presets') ? selectedSubCategory : undefined;
      const beforeImg = files.find(f => /\.(jpg|jpeg|png|webp)$/i.test(f.name) && (f.name.toLowerCase().includes('before') || f.name.toLowerCase().includes('original')));
      const afterImg = files.find(f => /\.(jpg|jpeg|png|webp)$/i.test(f.name) && (f.name.toLowerCase().includes('after') || f.name.toLowerCase().includes('applied')));
      onFileSelect(
        zipFile, 
        selectedCategory, 
        imageFile || thumbnailFile || undefined, 
        subCategory, 
        videoFile || previewVideoFile || undefined, 
        description || undefined,
        beforeImg || beforeImageFile || undefined,
        afterImg || afterImageFile || undefined
      );
    } else {
      alert('Please upload a ZIP file');
    }
  }, [disabled, selectedCategory, selectedSubCategory, onFileSelect, thumbnailFile, previewVideoFile, beforeImageFile, afterImageFile, description]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.name.endsWith('.zip')) {
      const subCategory = (selectedCategory === 'Overlays & Transitions' || selectedCategory === 'SFX & Plugins' || selectedCategory === 'LUTs & Presets') ? selectedSubCategory : undefined;
      onFileSelect(
        file, 
        selectedCategory, 
        thumbnailFile || undefined, 
        subCategory, 
        previewVideoFile || undefined, 
        description || undefined,
        beforeImageFile || undefined,
        afterImageFile || undefined
      );
    } else {
      alert('Please upload a ZIP file');
    }
  }, [selectedCategory, selectedSubCategory, onFileSelect, thumbnailFile, previewVideoFile, beforeImageFile, afterImageFile, description]);

  const handleThumbnailInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (/\.(jpg|jpeg|png|webp)$/i.test(file.name)) {
        setThumbnailFile(file);
        // Create preview
        const reader = new FileReader();
        reader.onloadend = () => {
          setThumbnailPreview(reader.result as string);
        };
        reader.readAsDataURL(file);
      } else {
        alert('Please upload a valid image file (JPG, PNG, or WebP)');
      }
    }
  }, []);

  const handleRemoveThumbnail = useCallback(() => {
    setThumbnailFile(null);
    setThumbnailPreview(null);
    if (thumbnailInputRef.current) {
      thumbnailInputRef.current.value = '';
    }
  }, []);

  const handlePreviewVideoInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (/\.(mp4)$/i.test(file.name)) {
        setPreviewVideoFile(file);
      } else {
        alert('Please upload a valid MP4 video file');
      }
    }
  }, []);

  const handleRemovePreviewVideo = useCallback(() => {
    setPreviewVideoFile(null);
    if (previewVideoInputRef.current) {
      previewVideoInputRef.current.value = '';
    }
  }, []);

  const handleBeforeImageInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (/\.(jpg|jpeg|png|webp)$/i.test(file.name)) {
        setBeforeImageFile(file);
        // Create preview
        const reader = new FileReader();
        reader.onloadend = () => {
          setBeforeImagePreview(reader.result as string);
        };
        reader.readAsDataURL(file);
      } else {
        alert('Please upload a valid image file (JPG, PNG, or WebP)');
      }
    }
  }, []);

  const handleRemoveBeforeImage = useCallback(() => {
    setBeforeImageFile(null);
    setBeforeImagePreview(null);
    if (beforeImageInputRef.current) {
      beforeImageInputRef.current.value = '';
    }
  }, []);

  const handleAfterImageInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (/\.(jpg|jpeg|png|webp)$/i.test(file.name)) {
        setAfterImageFile(file);
        // Create preview
        const reader = new FileReader();
        reader.onloadend = () => {
          setAfterImagePreview(reader.result as string);
        };
        reader.readAsDataURL(file);
      } else {
        alert('Please upload a valid image file (JPG, PNG, or WebP)');
      }
    }
  }, []);

  const handleRemoveAfterImage = useCallback(() => {
    setAfterImageFile(null);
    setAfterImagePreview(null);
    if (afterImageInputRef.current) {
      afterImageInputRef.current.value = '';
    }
  }, []);

  const handleClick = useCallback(() => {
    if (!disabled) {
      fileInputRef.current?.click();
    }
  }, [disabled]);

  return (
    <div className="space-y-4">
      {/* Category Selector */}
      <div>
        <label className="block text-sm font-medium text-neutral-300 mb-2">
          Category
        </label>
        <select
          value={selectedCategory}
          onChange={(e) => {
            const newCategory = e.target.value as Category;
            setSelectedCategory(newCategory);
            // Reset subcategory when category changes
            if (newCategory === 'Overlays & Transitions') {
              setSelectedSubCategory('Overlays');
            } else if (newCategory === 'SFX & Plugins') {
              setSelectedSubCategory('SFX');
            } else if (newCategory === 'LUTs & Presets') {
              setSelectedSubCategory('LUTs');
            } else {
              setSelectedSubCategory(null);
            }
          }}
          disabled={disabled}
          className="w-full px-4 py-2 bg-neutral-900 border border-neutral-800 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-ccaBlue disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <option value="Overlays & Transitions">Overlays & Transitions</option>
          <option value="SFX & Plugins">SFX & Plugins</option>
          <option value="LUTs & Presets">LUTs & Presets</option>
          <option value="Templates">Templates</option>
        </select>
      </div>

      {/* Subcategory Selector for Overlays & Transitions */}
      {selectedCategory === 'Overlays & Transitions' && (
        <div>
          <label className="block text-sm font-medium text-neutral-300 mb-2">
            Subcategory
          </label>
          <select
            value={selectedSubCategory || ''}
            onChange={(e) => setSelectedSubCategory(e.target.value as SubCategory)}
            disabled={disabled}
            className="w-full px-4 py-2 bg-neutral-900 border border-neutral-800 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-ccaBlue disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <option value="Overlays">Overlays</option>
            <option value="Transitions">Transitions</option>
          </select>
        </div>
      )}

      {/* Subcategory Selector for SFX & Plugins */}
      {selectedCategory === 'SFX & Plugins' && (
        <div>
          <label className="block text-sm font-medium text-neutral-300 mb-2">
            Subcategory
          </label>
          <select
            value={selectedSubCategory || ''}
            onChange={(e) => setSelectedSubCategory(e.target.value as SubCategory)}
            disabled={disabled}
            className="w-full px-4 py-2 bg-neutral-900 border border-neutral-800 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-ccaBlue disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <option value="SFX">SFX</option>
            <option value="Plugins">Plugins</option>
          </select>
        </div>
      )}

      {/* Subcategory Selector for LUTs & Presets */}
      {selectedCategory === 'LUTs & Presets' && (
        <div>
          <label className="block text-sm font-medium text-neutral-300 mb-2">
            Subcategory
          </label>
          <select
            value={selectedSubCategory || ''}
            onChange={(e) => setSelectedSubCategory(e.target.value as SubCategory)}
            disabled={disabled}
            className="w-full px-4 py-2 bg-neutral-900 border border-neutral-800 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-ccaBlue disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <option value="LUTs">LUTs</option>
            <option value="Presets">Presets</option>
          </select>
        </div>
      )}

      {/* Thumbnail Upload */}
      <div>
        <label className="block text-sm font-medium text-neutral-300 mb-2">
          Thumbnail Image (Optional)
        </label>
        <div className="flex items-center gap-4">
          {thumbnailPreview ? (
            <div className="relative">
              <img
                src={thumbnailPreview}
                alt="Thumbnail preview"
                className="w-32 h-32 object-cover rounded-lg border border-neutral-800"
              />
              <button
                type="button"
                onClick={handleRemoveThumbnail}
                disabled={disabled}
                className="absolute -top-2 -right-2 w-6 h-6 bg-red-600 hover:bg-red-700 text-white rounded-full flex items-center justify-center text-xs disabled:opacity-50 disabled:cursor-not-allowed"
              >
                ×
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => !disabled && thumbnailInputRef.current?.click()}
              disabled={disabled}
              className="px-4 py-2 bg-neutral-900 border border-neutral-800 rounded-lg text-neutral-300 hover:bg-neutral-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Select Thumbnail
            </button>
          )}
          <input
            ref={thumbnailInputRef}
            type="file"
            accept="image/jpeg,image/jpg,image/png,image/webp"
            onChange={handleThumbnailInput}
            className="hidden"
            disabled={disabled}
          />
          {thumbnailFile && (
            <span className="text-sm text-neutral-400">
              {thumbnailFile.name}
            </span>
          )}
        </div>
        <p className="text-xs text-neutral-500 mt-1">
          Upload a custom thumbnail image for the "All" category (JPG, PNG, or WebP)
        </p>
      </div>

      {/* Preview Video Upload for Plugins */}
      {selectedCategory === 'SFX & Plugins' && selectedSubCategory === 'Plugins' && (
        <div>
          <label className="block text-sm font-medium text-neutral-300 mb-2">
            Preview Video (Optional)
          </label>
          <div className="flex items-center gap-4">
            {previewVideoFile ? (
              <div className="flex items-center gap-2">
                <span className="text-sm text-neutral-400">
                  {previewVideoFile.name}
                </span>
                <button
                  type="button"
                  onClick={handleRemovePreviewVideo}
                  disabled={disabled}
                  className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Remove
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => !disabled && previewVideoInputRef.current?.click()}
                disabled={disabled}
                className="px-4 py-2 bg-neutral-900 border border-neutral-800 rounded-lg text-neutral-300 hover:bg-neutral-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Select Preview Video
              </button>
            )}
            <input
              ref={previewVideoInputRef}
              type="file"
              accept="video/mp4"
              onChange={handlePreviewVideoInput}
              className="hidden"
              disabled={disabled}
            />
          </div>
          <p className="text-xs text-neutral-500 mt-1">
            Upload an MP4 preview video that will play on hover in the Plugins tab
          </p>
        </div>
      )}

      {/* Before/After Image Upload for Presets */}
      {selectedCategory === 'LUTs & Presets' && selectedSubCategory === 'Presets' && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-2">
              Before Image (Optional)
            </label>
            <div className="flex items-center gap-4">
              {beforeImagePreview ? (
                <div className="relative">
                  <img
                    src={beforeImagePreview}
                    alt="Before preview"
                    className="w-32 h-32 object-cover rounded-lg border border-neutral-800"
                  />
                  <button
                    type="button"
                    onClick={handleRemoveBeforeImage}
                    disabled={disabled}
                    className="absolute -top-2 -right-2 w-6 h-6 bg-red-600 hover:bg-red-700 text-white rounded-full flex items-center justify-center text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    ×
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => !disabled && beforeImageInputRef.current?.click()}
                  disabled={disabled}
                  className="px-4 py-2 bg-neutral-900 border border-neutral-800 rounded-lg text-neutral-300 hover:bg-neutral-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Select Before Image
                </button>
              )}
              <input
                ref={beforeImageInputRef}
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/webp"
                onChange={handleBeforeImageInput}
                className="hidden"
                disabled={disabled}
              />
              {beforeImageFile && (
                <span className="text-sm text-neutral-400">
                  {beforeImageFile.name}
                </span>
              )}
            </div>
            <p className="text-xs text-neutral-500 mt-1">
              Upload the "before" image for the preset preview slider (JPG, PNG, or WebP)
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-2">
              After Image (Optional)
            </label>
            <div className="flex items-center gap-4">
              {afterImagePreview ? (
                <div className="relative">
                  <img
                    src={afterImagePreview}
                    alt="After preview"
                    className="w-32 h-32 object-cover rounded-lg border border-neutral-800"
                  />
                  <button
                    type="button"
                    onClick={handleRemoveAfterImage}
                    disabled={disabled}
                    className="absolute -top-2 -right-2 w-6 h-6 bg-red-600 hover:bg-red-700 text-white rounded-full flex items-center justify-center text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    ×
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => !disabled && afterImageInputRef.current?.click()}
                  disabled={disabled}
                  className="px-4 py-2 bg-neutral-900 border border-neutral-800 rounded-lg text-neutral-300 hover:bg-neutral-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Select After Image
                </button>
              )}
              <input
                ref={afterImageInputRef}
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/webp"
                onChange={handleAfterImageInput}
                className="hidden"
                disabled={disabled}
              />
              {afterImageFile && (
                <span className="text-sm text-neutral-400">
                  {afterImageFile.name}
                </span>
              )}
            </div>
            <p className="text-xs text-neutral-500 mt-1">
              Upload the "after" image for the preset preview slider (JPG, PNG, or WebP)
            </p>
          </div>
        </div>
      )}

      {/* Description Field for Templates */}
      {selectedCategory === 'Templates' && (
        <div>
          <label className="block text-sm font-medium text-neutral-300 mb-2">
            Description (Optional)
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={disabled}
            rows={4}
            className="w-full px-4 py-2 bg-neutral-900 border border-neutral-800 rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-ccaBlue disabled:opacity-50 disabled:cursor-not-allowed resize-none"
            placeholder="Enter a description for this template..."
          />
          <p className="text-xs text-neutral-500 mt-1">
            Add a description to help users understand what this template includes
          </p>
        </div>
      )}

      {/* ZIP Upload Zone */}
      <div>
        <label className="block text-sm font-medium text-neutral-300 mb-2">
          ZIP File
        </label>
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={handleClick}
          className={`
            border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors bg-black
            ${isDragging 
              ? 'border-ccaBlue bg-ccaBlue/10' 
              : 'border-neutral-800 hover:border-neutral-700'
            }
            ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
          `}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".zip"
            onChange={handleFileInput}
            className="hidden"
            disabled={disabled}
          />
          
          <svg
            className="w-16 h-16 mx-auto mb-4 text-neutral-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
            />
          </svg>
          
          <p className="text-lg font-medium text-neutral-300 mb-2">
            Drag and drop ZIP file here
          </p>
          <p className="text-sm text-neutral-500">
            or click to browse
          </p>
        </div>
      </div>
    </div>
  );
}

