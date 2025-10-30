"use client";
import { useState, useRef } from 'react';
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage, firebaseReady } from '@/lib/firebaseClient';
import { useAuth } from '@/contexts/AuthContext';

interface ListingImageUploadProps {
  images: string[];
  onImagesChange: (images: string[]) => void;
  maxImages?: number;
}

export function ListingImageUpload({ images, onImagesChange, maxImages = 10 }: ListingImageUploadProps) {
  const { user } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    if (images.length + files.length > maxImages) {
      setError(`Maximum ${maxImages} images allowed. You can add ${maxImages - images.length} more.`);
      return;
    }

    if (!user || !firebaseReady || !storage) {
      setError('Firebase is not configured');
      return;
    }

    setError(null);
    const uploadPromises = files.map(async (file) => {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        throw new Error(`${file.name} is not an image file`);
      }

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        throw new Error(`${file.name} is too large (max 5MB)`);
      }

      const fileId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const storageRef = ref(storage, `listing-images/${user.uid}/${fileId}_${file.name}`);
      
      return new Promise<string>((resolve, reject) => {
        const uploadTask = uploadBytesResumable(storageRef, file);

        uploadTask.on(
          'state_changed',
          (snapshot) => {
            const percent = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            setUploadProgress(prev => ({ ...prev, [fileId]: percent }));
          },
          (error) => {
            console.error('Upload error:', error);
            reject(new Error(`Failed to upload ${file.name}`));
          },
          async () => {
            try {
              const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
              setUploadProgress(prev => {
                const newProgress = { ...prev };
                delete newProgress[fileId];
                return newProgress;
              });
              resolve(downloadURL);
            } catch (error) {
              reject(error);
            }
          }
        );
      });
    });

    setUploading(true);

    try {
      const urls = await Promise.all(uploadPromises);
      onImagesChange([...images, ...urls]);
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error: any) {
      console.error('Error uploading images:', error);
      setError(error.message || 'Failed to upload images. Please try again.');
      setUploading(false);
    }
  };

  const handleRemoveImage = async (imageUrl: string, index: number) => {
    try {
      // Try to delete from storage if it's a Firebase Storage URL
      if (imageUrl.includes('firebasestorage.googleapis.com')) {
        try {
          const imageRef = ref(storage, imageUrl);
          await deleteObject(imageRef);
        } catch (error) {
          console.error('Error deleting from storage:', error);
          // Continue anyway - remove from array even if storage delete fails
        }
      }
      
      const newImages = images.filter((_, i) => i !== index);
      onImagesChange(newImages);
    } catch (error) {
      console.error('Error removing image:', error);
      setError('Failed to remove image. Please try again.');
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3">
        {images.map((imageUrl, index) => (
          <div key={index} className="relative group">
            <div className="w-24 h-24 overflow-hidden border border-neutral-800 bg-neutral-900">
              <img
                src={imageUrl}
                alt={`Listing image ${index + 1}`}
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            </div>
            <button
              onClick={() => handleRemoveImage(imageUrl, index)}
              className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 hover:bg-red-600 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            {index === 0 && (
              <span className="absolute bottom-1 left-1 text-xs px-1.5 py-0.5 rounded bg-black/60 text-white text-[10px]">
                Main
              </span>
            )}
          </div>
        ))}
        
        {images.length < maxImages && (
          <label className="w-24 h-24 border-2 border-dashed border-neutral-700 bg-neutral-900/50 hover:bg-neutral-900 hover:border-neutral-600 cursor-pointer flex flex-col items-center justify-center transition-all">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileSelect}
              className="hidden"
              disabled={uploading}
            />
            {uploading ? (
              <div className="text-center">
                <div className="w-8 h-8 border-2 border-ccaBlue border-t-transparent animate-spin mx-auto mb-1"></div>
                <span className="text-xs text-neutral-400">Uploading...</span>
              </div>
            ) : (
              <>
                <svg className="w-6 h-6 text-neutral-400 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span className="text-xs text-neutral-400">Add Image</span>
              </>
            )}
          </label>
        )}
      </div>

      {Object.keys(uploadProgress).length > 0 && (
        <div className="space-y-1">
          {Object.entries(uploadProgress).map(([fileId, progress]) => (
            <div key={fileId} className="w-full bg-neutral-900 h-2">
              <div
                className="bg-ccaBlue h-2 transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          ))}
        </div>
      )}

      {error && (
        <p className="text-sm text-red-400">{error}</p>
      )}

      {images.length > 0 && images.length < maxImages && (
        <p className="text-xs text-neutral-500">
          {images.length} / {maxImages} images ({maxImages - images.length} remaining)
        </p>
      )}
      {images.length >= maxImages && (
        <p className="text-xs text-yellow-400">
          Maximum {maxImages} images reached
        </p>
      )}
    </div>
  );
}

