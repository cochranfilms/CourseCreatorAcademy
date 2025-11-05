"use client";

import { useState, useRef } from 'react';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { doc, setDoc } from 'firebase/firestore';
import { updateProfile } from 'firebase/auth';
import { storage, db, auth, firebaseReady } from '@/lib/firebaseClient';
import ImageCropperModal from './ImageCropperModal';
import { useAuth } from '@/contexts/AuthContext';

interface ProfileImageUploadProps {
  onUploadComplete?: (url: string) => void;
}

export function ProfileImageUpload({ onUploadComplete }: ProfileImageUploadProps) {
  const { user } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [pendingFileName, setPendingFileName] = useState<string>('image.jpg');
  const [previewUrl, setPreviewUrl] = useState<string | null>(user?.photoURL || null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('Image size must be less than 5MB');
      return;
    }

    // Open cropper first; we'll upload the cropped blob
    const reader = new FileReader();
    reader.onload = () => {
      setCropSrc(reader.result as string);
      setPendingFileName(file.name);
    };
    reader.readAsDataURL(file);
  };

  const uploadCroppedBlob = async (blob: Blob) => {
    if (!user || !firebaseReady || !storage || !db) {
      setError('Firebase is not configured');
      return;
    }
    // Close the cropper immediately so the user sees the progress on the modal behind it
    setCropSrc(null);

    // Show a local preview right away while the upload runs
    try {
      const objectUrl = URL.createObjectURL(blob);
      setPreviewUrl(objectUrl);
    } catch {}

    setUploading(true);
    setError(null);
    setProgress(0);
    try {
      const path = `profile-images/${user.uid}/${Date.now()}_${pendingFileName.replace(/\s+/g,'_')}`;
      const sref = ref(storage, path);
      const uploadTask = uploadBytesResumable(sref, blob, { contentType: 'image/jpeg' });
      uploadTask.on('state_changed', (snap) => {
        const percent = (snap.bytesTransferred / snap.totalBytes) * 100;
        setProgress(percent);
      }, (err) => {
        console.error('Upload error:', err);
        setError('Failed to upload image. Please try again.');
        setUploading(false);
      }, async () => {
        const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
        if (auth.currentUser) {
          await updateProfile(auth.currentUser, { photoURL: downloadURL });
        }
        await setDoc(doc(db, 'users', user.uid), {
          photoURL: downloadURL,
          displayName: user.displayName || user.email?.split('@')[0],
          updatedAt: new Date(),
        }, { merge: true });
        setUploading(false);
        setProgress(0);
        setPreviewUrl(downloadURL);
        if (onUploadComplete) onUploadComplete(downloadURL);
      });
    } catch (e) {
      console.error(e);
      setUploading(false);
      setError('Failed to upload image.');
    }
  };

  return (
    <div className="space-y-2">
      {(previewUrl || user?.photoURL) && (
        <div className="w-20 h-20 rounded-full overflow-hidden border border-neutral-800">
          <img
            src={previewUrl || user?.photoURL || ''}
            alt="Profile preview"
            className="w-full h-full object-cover"
          />
        </div>
      )}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
        disabled={uploading}
      />

      <button
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
        className="px-4 py-2 bg-neutral-900 border border-neutral-800 text-neutral-300 hover:bg-neutral-800 transition disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {uploading ? `Uploading... ${Math.round(progress)}%` : 'Upload Profile Image'}
      </button>

      {error && <p className="text-sm text-red-400">{error}</p>}

      {uploading && (
        <div className="w-full bg-neutral-900 h-2">
          <div
            className="bg-ccaBlue h-2 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      {cropSrc && (
        <ImageCropperModal
          imageSrc={cropSrc}
          aspect={1}
          onCancel={() => setCropSrc(null)}
          onCropped={(blob) => uploadCroppedBlob(blob)}
        />
      )}
    </div>
  );
}