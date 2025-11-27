"use client";
import { useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { AssetUploadZone } from '@/components/admin/AssetUploadZone';
import { ProcessingStatus } from '@/components/admin/ProcessingStatus';

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

  const handleFileSelect = useCallback(async (file: File, category: string) => {
    if (!user) return;

    // Check file size (Vercel has a 4.5MB limit for API routes)
    const MAX_SIZE = 4 * 1024 * 1024; // 4MB
    if (file.size > MAX_SIZE) {
      setProcessingState({
        status: 'error',
        progress: 0,
        error: `File is too large (${(file.size / 1024 / 1024).toFixed(2)}MB). Maximum size is 4MB. Please compress the ZIP file or split it into smaller archives.`,
      });
      return;
    }

    setProcessingState({
      status: 'uploading',
      progress: 0,
      currentStep: 'Uploading ZIP file...',
    });

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('category', category);

      const idToken = await user.getIdToken();

      const response = await fetch('/api/admin/assets/process', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${idToken}`,
        },
        body: formData,
      });

      if (!response.ok) {
        let errorMessage = 'Processing failed';
        if (response.status === 413) {
          errorMessage = 'File is too large. Maximum size is 4MB. Please compress the ZIP file or split it into smaller archives.';
        } else {
          try {
            const error = await response.json();
            errorMessage = error.error || errorMessage;
          } catch {
            errorMessage = `Server error: ${response.status} ${response.statusText}`;
          }
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
                  setProcessingState(prev => ({
                    ...prev,
                    progress: data.progress,
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

