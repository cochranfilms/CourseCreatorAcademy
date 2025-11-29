"use client";

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import MuxPlayer from '@mux/mux-player-react';

function WalkthroughContent() {
  const searchParams = useSearchParams();
  const playbackId = searchParams?.get('playbackId');
  const [title, setTitle] = useState<string>('Platform Walkthrough');
  const [description, setDescription] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchWalkthroughData() {
      if (!playbackId) {
        setLoading(false);
        return;
      }

      try {
        // Try to get title and description from Firestore config
        const { db, firebaseReady } = await import('@/lib/firebaseClient');
        if (firebaseReady && db) {
          const { doc, getDoc } = await import('firebase/firestore');
          const configDoc = await getDoc(doc(db, 'config', 'walkthrough'));
          if (configDoc.exists()) {
            const configData = configDoc.data();
            if (configData.title) setTitle(configData.title);
            if (configData.description) setDescription(configData.description);
          }
        }
      } catch (error) {
        console.error('Error fetching walkthrough config:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchWalkthroughData();
  }, [playbackId]);

  if (!playbackId) {
    return (
      <main className="min-h-screen max-w-7xl mx-auto px-3 sm:px-4 md:px-6 py-4 sm:py-6 md:py-8">
        <div className="max-w-4xl mx-auto rounded-2xl overflow-hidden border border-neutral-800 bg-transparent p-4">
          <div className="aspect-video bg-transparent rounded-xl flex items-center justify-center">
            <div className="text-neutral-400 text-center px-4">
              No playback ID provided. Please provide a playbackId query parameter.
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 py-4 sm:py-6 md:py-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-2">{title}</h1>
        {description && (
          <p className="text-neutral-400 mb-6">{description}</p>
        )}
        
        {loading ? (
          <div className="rounded-2xl overflow-hidden border border-neutral-800 bg-transparent p-4">
            <div className="aspect-video bg-transparent rounded-xl flex items-center justify-center">
              <div className="text-neutral-400">Loading video...</div>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl overflow-hidden border border-neutral-800 bg-transparent p-4">
            <div className="aspect-video bg-transparent rounded-xl overflow-hidden">
              <MuxPlayer
                playbackId={playbackId}
                streamType="on-demand"
                primaryColor="#3B82F6"
                className="w-full"
                style={{ aspectRatio: '16 / 9' }}
                playsInline
                preload="metadata"
                // @ts-ignore
                preferMse
                // @ts-ignore
                maxResolution="540p"
                // @ts-ignore
                disablePictureInPicture
                // @ts-ignore
                autoPictureInPicture={false}
              />
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

export default function WalkthroughPage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen max-w-7xl mx-auto px-3 sm:px-4 md:px-6 py-4 sm:py-6 md:py-8">
        <div className="max-w-4xl mx-auto rounded-2xl overflow-hidden border border-neutral-800 bg-transparent p-4">
          <div className="aspect-video bg-transparent rounded-xl flex items-center justify-center">
            <div className="text-neutral-400">Loading...</div>
          </div>
        </div>
      </main>
    }>
      <WalkthroughContent />
    </Suspense>
  );
}

