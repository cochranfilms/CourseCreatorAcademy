"use client";
import { useState, useCallback, useRef } from 'react';

type Category = 'Overlays & Transitions' | 'SFX & Plugins' | 'LUTs & Presets';

interface AssetUploadZoneProps {
  onFileSelect: (file: File, category: Category) => void;
  disabled?: boolean;
}

export function AssetUploadZone({ onFileSelect, disabled }: AssetUploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<Category>('Overlays & Transitions');
  const fileInputRef = useRef<HTMLInputElement>(null);

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

    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith('.zip')) {
      onFileSelect(file, selectedCategory);
    } else {
      alert('Please upload a ZIP file');
    }
  }, [disabled, selectedCategory, onFileSelect]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.name.endsWith('.zip')) {
      onFileSelect(file, selectedCategory);
    } else {
      alert('Please upload a ZIP file');
    }
  }, [selectedCategory, onFileSelect]);

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
          onChange={(e) => setSelectedCategory(e.target.value as Category)}
          disabled={disabled}
          className="w-full px-4 py-2 bg-neutral-900 border border-neutral-800 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-ccaBlue disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <option value="Overlays & Transitions">Overlays & Transitions</option>
          <option value="SFX & Plugins">SFX & Plugins</option>
          <option value="LUTs & Presets">LUTs & Presets</option>
        </select>
      </div>

      {/* Upload Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClick}
        className={`
          border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors
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
  );
}

