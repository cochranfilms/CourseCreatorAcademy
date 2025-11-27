"use client";
import { useState, useRef, DragEvent } from 'react';
import ImageCropperModal from '@/components/ImageCropperModal';
import { storage } from '@/lib/firebaseClient';
import { ref as storageRef, uploadBytesResumable, getDownloadURL } from 'firebase/storage';

type Props = {
  currentUrl?: string;
  onUploadComplete: (url: string) => void;
  aspectRatio?: number; // 1 for square (avatar), 16/9 for banner
  shape?: 'rect' | 'circle';
  label?: string;
  storagePath: string; // e.g., 'legacy-creators/{userId}/avatar'
  maxSizeMB?: number;
};

export function ImageUploadZone({
  currentUrl,
  onUploadComplete,
  aspectRatio = 1,
  shape = 'rect',
  label,
  storagePath,
  maxSizeMB = 5,
}: Props) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [pendingPath, setPendingPath] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }
    if (file.size > maxSizeMB * 1024 * 1024) {
      alert(`File size must be less than ${maxSizeMB}MB`);
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setCropSrc(reader.result as string);
      setPendingPath(`${storagePath}_${Date.now()}_${file.name.replace(/\s+/g, '_')}`);
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const handleCropped = async (blob: Blob) => {
    if (!storage || !pendingPath) {
      setCropSrc(null);
      return;
    }

    setUploading(true);
    setProgress(0);
    const sref = storageRef(storage, pendingPath);
    const task = uploadBytesResumable(sref, blob, { contentType: 'image/jpeg' });

    task.on(
      'state_changed',
      (snap) => {
        const p = (snap.bytesTransferred / snap.totalBytes) * 100;
        setProgress(p);
      },
      (err) => {
        console.error('Upload error', err);
        alert('Upload failed. Please try again.');
        setUploading(false);
        setCropSrc(null);
      },
      async () => {
        const url = await getDownloadURL(task.snapshot.ref);
        onUploadComplete(url);
        setUploading(false);
        setProgress(0);
        setCropSrc(null);
      }
    );
  };

  const containerClass = shape === 'circle' 
    ? 'rounded-full overflow-hidden'
    : 'rounded-lg overflow-hidden';

  return (
    <>
      <div
        className={`${containerClass} border-2 border-dashed ${
          isDragging ? 'border-ccaBlue bg-ccaBlue/10' : 'border-neutral-700 hover:border-neutral-600'
        } transition cursor-pointer relative group`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={handleClick}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
        />
        
        {currentUrl ? (
          <div className="relative w-full h-full">
            <img
              src={currentUrl}
              alt={label || 'Preview'}
              className={`w-full h-full object-cover ${shape === 'circle' ? 'rounded-full' : ''}`}
            />
            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
              <div className="text-white text-sm font-medium">Click to change</div>
            </div>
          </div>
        ) : (
          <div className={`flex flex-col items-center justify-center p-8 ${shape === 'circle' ? 'aspect-square' : 'aspect-video'}`}>
            <svg className="w-12 h-12 text-neutral-500 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <div className="text-neutral-400 text-sm text-center">
              {label || 'Drop image here or click to upload'}
            </div>
            {shape === 'rect' && aspectRatio === 16/9 && (
              <div className="text-neutral-500 text-xs mt-1">Recommended: 16:9 aspect ratio</div>
            )}
          </div>
        )}

        {uploading && (
          <div className="absolute inset-0 bg-black/80 flex items-center justify-center">
            <div className="text-center">
              <div className="text-white text-sm mb-2">Uploading... {Math.round(progress)}%</div>
              <div className="w-48 h-2 bg-neutral-800 rounded-full overflow-hidden">
                <div className="h-full bg-ccaBlue transition-all" style={{ width: `${progress}%` }} />
              </div>
            </div>
          </div>
        )}
      </div>

      {cropSrc && (
        <ImageCropperModal
          imageSrc={cropSrc}
          aspect={aspectRatio}
          onCancel={() => setCropSrc(null)}
          onCropped={handleCropped}
        />
      )}
    </>
  );
}

