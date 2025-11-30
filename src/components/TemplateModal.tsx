"use client";

import { useEffect } from 'react';

interface Asset {
  id: string;
  title: string;
  category: string;
  thumbnailUrl?: string;
  storagePath?: string;
  fileType?: string;
  description?: string;
  createdAt?: any;
}

interface TemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  asset: Asset | null;
  onDownload: () => void;
  downloading?: boolean;
}

export function TemplateModal({ isOpen, onClose, asset, onDownload, downloading = false }: TemplateModalProps) {
  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen || !asset) return null;

  // Format file size (assuming we can get it from storage or estimate)
  const formatFileSize = (bytes?: number): string => {
    if (!bytes) return 'N/A';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  // Format date
  const formatDate = (date?: any): string => {
    if (!date) return 'N/A';
    try {
      const d = date.toDate ? date.toDate() : new Date(date);
      return d.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
    } catch {
      return 'N/A';
    }
  };

  // Get creator name (default to "Overlay" if not available)
  const creatorName = 'Overlay'; // You can update this to get from asset data if available

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 overflow-y-auto">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div 
        className="relative bg-neutral-950 border border-neutral-800 rounded-lg max-w-6xl w-full my-4 sm:my-8 shadow-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 text-neutral-400 hover:text-white transition-colors p-1"
          aria-label="Close"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Content */}
        <div className="flex flex-col lg:flex-row">
          {/* Left Panel - Preview */}
          <div className="lg:w-1/2 p-4 sm:p-6 lg:p-8">
            <div className="space-y-4">
              {/* Title */}
              <div>
                <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-white mb-1 sm:mb-2">{asset.title}</h2>
                <p className="text-neutral-400 text-xs sm:text-sm">by {creatorName}</p>
              </div>

              {/* Preview Image */}
              <div className="aspect-video bg-neutral-900 rounded-lg overflow-hidden border border-neutral-800">
                {asset.thumbnailUrl && asset.thumbnailUrl.startsWith('https://') ? (
                  <img
                    src={asset.thumbnailUrl}
                    alt={asset.title}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-neutral-600">
                    <svg className="w-12 h-12 sm:w-16 sm:h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                  </div>
                )}
              </div>

              {/* Date and File Size */}
              <div className="flex items-center justify-between text-xs sm:text-sm text-neutral-500">
                <span>{formatDate(asset.createdAt)}</span>
                <span>{formatFileSize()}</span>
              </div>
            </div>
          </div>

          {/* Right Panel - Details */}
          <div className="lg:w-1/2 p-4 sm:p-6 lg:p-8 border-t lg:border-t-0 lg:border-l border-neutral-800">
            <div className="space-y-4 sm:space-y-6">
              {/* Header */}
              <div className="flex items-center justify-between">
                <h3 className="text-lg sm:text-xl font-semibold text-white">Asset Details</h3>
              </div>

              {/* Description */}
              <div>
                <p className="text-sm sm:text-base text-neutral-300 leading-relaxed whitespace-pre-wrap">
                  {asset.description || 'No description available.'}
                </p>
              </div>

              {/* Tags */}
              <div>
                <div className="flex flex-wrap gap-2">
                  <span className="px-2 sm:px-3 py-1 bg-neutral-900 border border-neutral-800 rounded-full text-xs sm:text-sm text-neutral-300">
                    templates
                  </span>
                  {asset.category && asset.category !== 'Templates' && (
                    <span className="px-2 sm:px-3 py-1 bg-neutral-900 border border-neutral-800 rounded-full text-xs sm:text-sm text-neutral-300">
                      {asset.category.toLowerCase()}
                    </span>
                  )}
                </div>
              </div>

              {/* Download Button */}
              <button
                onClick={onDownload}
                disabled={downloading}
                className="w-full bg-red-600 hover:bg-red-700 disabled:bg-red-600/50 disabled:cursor-not-allowed text-white font-semibold py-3 sm:py-4 px-4 sm:px-6 rounded-lg transition-colors flex items-center justify-center gap-2 text-sm sm:text-base"
              >
                {downloading ? (
                  <>
                    <svg className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    <span>Downloading...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    <span>Download</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

