"use client";
import { useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { ref, uploadBytesResumable } from 'firebase/storage';
import { storage, firebaseReady } from '@/lib/firebaseClient';
import { AssetUploadZone } from '@/components/admin/AssetUploadZone';
import { ProcessingStatus } from '@/components/admin/ProcessingStatus';

type Category = 'Overlays & Transitions' | 'SFX & Plugins' | 'LUTs & Presets';
type SubCategory = 'Overlays' | 'Transitions' | null;

type ProcessingState = {
  status: 'idle' | 'uploading' | 'processing' | 'completed' | 'error';
  progress: number;
  currentStep?: string;
  results?: {
    assetId?: string;
    filesProcessed: number;
    conversionsCompleted: number;
    previewsGenerated: number;
    durationsExtracted: number;
    lutPreviewsCreated: number;
    documentsCreated: number;
    errors: string[];
  };
  error?: string;
};

export default function AdminAssetsUploadPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [processingState, setProcessingState] = useState<ProcessingState>({
    status: 'idle',
    progress: 0,
  });

  const handleFileSelect = useCallback(async (file: File, category: Category, thumbnail?: File, subCategory?: SubCategory) => {
    if (!user || !firebaseReady || !storage) {
      setProcessingState({
        status: 'error',
        progress: 0,
        error: 'Firebase is not ready. Please refresh the page.',
      });
      return;
    }

    setProcessingState({
      status: 'uploading',
      progress: 0,
      currentStep: 'Uploading files to Storage...',
    });

    try {
      // Step 1: Upload ZIP file directly to Firebase Storage
      const zipFileName = file.name;
      const timestamp = Date.now();
      const zipStoragePath = `admin-assets-uploads/${user.uid}/${timestamp}_${zipFileName.replace(/\s+/g, '_')}`;
      const zipStorageRef = ref(storage, zipStoragePath);
      
      const zipUploadTask = uploadBytesResumable(zipStorageRef, file, {
        contentType: 'application/zip',
      });

      // Wait for ZIP upload to complete with progress tracking
      await new Promise<void>((resolve, reject) => {
        zipUploadTask.on(
          'state_changed',
          (snapshot) => {
            const uploadProgress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            setProcessingState(prev => ({
              ...prev,
              progress: Math.min(uploadProgress * 0.25, 25), // ZIP upload is 25% of total progress
              currentStep: `Uploading ZIP file... ${Math.round(uploadProgress)}%`,
            }));
          },
          (error) => {
            reject(error);
          },
          async () => {
            resolve();
          }
        );
      });

      // Note: We don't need to get downloadURL here - the API route uses Admin SDK
      // which bypasses storage rules and can access files directly via storagePath

      // Step 2: Upload thumbnail if provided
      let thumbnailStoragePath: string | undefined;
      let thumbnailDownloadURL: string | undefined;
      
      if (thumbnail) {
        setProcessingState(prev => ({
          ...prev,
          progress: 25,
          currentStep: 'Uploading thumbnail image...',
        }));

        const thumbnailFileName = thumbnail.name;
        const thumbnailPath = `admin-assets-uploads/${user.uid}/${timestamp}_${thumbnailFileName.replace(/\s+/g, '_')}`;
        const thumbnailStorageRef = ref(storage, thumbnailPath);
        
        const thumbnailUploadTask = uploadBytesResumable(thumbnailStorageRef, thumbnail, {
          contentType: thumbnail.type || 'image/png',
        });

        await new Promise<void>((resolve, reject) => {
          thumbnailUploadTask.on(
            'state_changed',
            (snapshot) => {
              const uploadProgress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
              setProcessingState(prev => ({
                ...prev,
                progress: 25 + Math.min(uploadProgress * 0.05, 5), // Thumbnail upload is 5% of total progress
                currentStep: `Uploading thumbnail... ${Math.round(uploadProgress)}%`,
              }));
            },
            (error) => {
              reject(error);
            },
            async () => {
              resolve();
            }
          );
        });

        thumbnailStoragePath = thumbnailPath;
        // Note: We don't need thumbnailDownloadURL - the API route uses Admin SDK
        // which bypasses storage rules and can access files directly via storagePath
        thumbnailDownloadURL = undefined;
      }

      // Step 3: Call API to process the file from Storage
      const hasThumbnail = !!thumbnail;
      setProcessingState(prev => ({
        ...prev,
        progress: hasThumbnail ? 30 : 25,
        currentStep: 'Processing ZIP file...',
        status: 'processing',
      }));

      const idToken = await user.getIdToken();
      const response = await fetch('/api/admin/assets/process', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          storagePath: zipStoragePath,
          category,
          fileName: zipFileName,
          thumbnailStoragePath,
          thumbnailDownloadURL,
          subCategory: subCategory || undefined,
        }),
      });

      if (!response.ok) {
        let errorMessage = 'Processing failed';
        try {
          const error = await response.json();
          errorMessage = error.error || errorMessage;
        } catch {
          errorMessage = `Server error: ${response.status} ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }

      // Handle streaming response for progress updates
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (reader) {
        let buffer = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || ''; // Keep incomplete line in buffer

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                
                if (data.progress !== undefined) {
                  // Server progress starts at 30% (after ZIP + optional thumbnail upload)
                  // Map server progress (30-100%) to overall progress
                  const serverProgress = Math.max(hasThumbnail ? 30 : 25, Math.min(100, data.progress));
                  setProcessingState(prev => ({
                    ...prev,
                    progress: serverProgress,
                    currentStep: data.step,
                    status: (data.status as any) || prev.status,
                  }));
                }

                if (data.complete) {
                  setProcessingState({
                    status: 'completed',
                    progress: 100,
                    results: data.results,
                  });
                }

                if (data.error) {
                  setProcessingState(prev => ({
                    ...prev,
                    status: 'error',
                    error: data.error,
                  }));
                }
              } catch (e) {
                console.error('Error parsing progress data:', e);
              }
            }
          }
        }
      } else {
        // Fallback: wait for complete response
        const result = await response.json();
        setProcessingState({
          status: 'completed',
          progress: 100,
          results: result,
        });
      }
    } catch (error: any) {
      setProcessingState({
        status: 'error',
        progress: 0,
        error: error.message || 'An error occurred during processing',
      });
    }
  }, [user]);

  // Check if user is authorized
  if (!authLoading && (!user || user.email !== 'info@cochranfilms.com')) {
    router.push('/home');
    return null;
  }

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-950">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-ccaBlue mb-4"></div>
          <p className="text-neutral-400">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-white p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">Admin Asset Upload</h1>
        <p className="text-neutral-400 mb-8">
          Upload ZIP files to automatically process and create asset documents
        </p>

        <AssetUploadZone
          onFileSelect={handleFileSelect}
          disabled={processingState.status === 'uploading' || processingState.status === 'processing'}
        />

        <ProcessingStatus state={processingState} />
      </div>
    </div>
  );
}

