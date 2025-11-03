"use client";
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@/contexts/AuthContext';
import { db, firebaseReady } from '@/lib/firebaseClient';
import { doc, getDoc, collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { LegacyUpgradeModal } from '@/components/LegacyUpgradeModal';
import MuxPlayer from '@mux/mux-player-react';

type LegacyVideo = {
  id: string;
  title: string;
  description?: string;
  muxPlaybackId?: string;
  muxAnimatedGifUrl?: string;
  durationSec?: number;
  isSample: boolean;
  createdAt?: any;
};

type Creator = {
  id: string;
  displayName: string;
  handle?: string;
  avatarUrl?: string | null;
  bannerUrl?: string | null;
  bio?: string;
  kitSlug?: string;
};

export default function CreatorKitPage() {
  const params = useParams();
  const slug = params?.slug as string || '';
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [creator, setCreator] = useState<Creator | null>(null);
  const [videos, setVideos] = useState<LegacyVideo[]>([]);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<LegacyVideo | null>(null);

  useEffect(() => {
    const load = async () => {
      if (!firebaseReady || !db || !slug) {
        setLoading(false);
        return;
      }

      try {
        // Find creator by kitSlug
        const creatorsSnap = await getDocs(collection(db, 'legacy_creators'));
        let creatorDoc: any = null;
        let creatorId: string | null = null;

        creatorsSnap.forEach((d) => {
          const data = d.data();
          if ((data.kitSlug || d.id) === slug) {
            creatorDoc = d;
            creatorId = d.id;
          }
        });

        if (!creatorDoc || !creatorId) {
          setLoading(false);
          return;
        }

        const creatorData = creatorDoc.data();
        setCreator({
          id: creatorId,
          displayName: creatorData.displayName || creatorData.handle || 'Creator',
          handle: creatorData.handle,
          avatarUrl: creatorData.avatarUrl || null,
          bannerUrl: creatorData.bannerUrl || null,
          bio: creatorData.bio || '',
          kitSlug: creatorData.kitSlug || creatorId,
        });

        // Check subscription status
        if (user) {
          const subsQ = query(
            collection(db, 'legacySubscriptions'),
            where('userId', '==', user.uid),
            where('creatorId', '==', creatorId),
            where('status', 'in', ['active', 'trialing'])
          );
          const subsSnap = await getDocs(subsQ);
          setIsSubscribed(!subsSnap.empty);
        }

        // Load videos from creator's legacy content collection
        const videosRef = collection(db, `legacy_creators/${creatorId}/videos`);
        const videosQ = query(videosRef, orderBy('createdAt', 'desc'));
        const videosSnap = await getDocs(videosQ).catch(() => ({ empty: true, docs: [] } as any));

        const videosList: LegacyVideo[] = [];
        videosSnap.forEach((d) => {
          const data = d.data();
          videosList.push({
            id: d.id,
            title: data.title || 'Untitled',
            description: data.description || '',
            muxPlaybackId: data.muxPlaybackId || null,
            muxAnimatedGifUrl: data.muxAnimatedGifUrl || null,
            durationSec: data.durationSec || 0,
            isSample: Boolean(data.isSample),
            createdAt: data.createdAt,
          });
        });

        // Separate samples from full content
        const samples = videosList.filter(v => v.isSample).slice(0, 3);
        const fullContent = videosList.filter(v => !v.isSample);

        // Show samples to all, full content only to subscribers
        if (isSubscribed) {
          setVideos([...samples, ...fullContent]);
        } else {
          setVideos(samples);
        }
      } catch (e) {
        console.error('Error loading creator kit:', e);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [slug, user, isSubscribed]);

  if (loading) {
    return (
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="inline-block animate-spin h-12 w-12 border-b-2 border-ccaBlue mb-4"></div>
            <p className="text-neutral-400">Loading creator kit...</p>
          </div>
        </div>
      </main>
    );
  }

  if (!creator) {
    return (
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-2">Creator Kit Not Found</h1>
          <p className="text-neutral-400 mb-6">This creator kit doesn't exist.</p>
          <Link href="/" className="text-ccaBlue hover:underline">Return to Home</Link>
        </div>
      </main>
    );
  }

  const sampleVideos = videos.filter(v => v.isSample);
  const lockedVideos = videos.filter(v => !v.isSample);

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
      {/* Creator Header */}
      <div className="mb-12">
        <div className="relative h-64 rounded-xl overflow-hidden bg-neutral-900 mb-6">
          {creator.bannerUrl && (
            <Image src={creator.bannerUrl} alt={creator.displayName} fill sizes="100vw" className="object-cover" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-neutral-950/50 to-transparent" />
          <div className="absolute bottom-6 left-6 flex items-center gap-4">
            {creator.avatarUrl && (
              <div className="relative w-24 h-24 rounded-full overflow-hidden border-4 border-neutral-900">
                <Image src={creator.avatarUrl} alt={creator.displayName} fill sizes="96px" className="object-cover" />
              </div>
            )}
            <div>
              <h1 className="text-3xl font-bold text-white mb-1">{creator.displayName}</h1>
              {creator.handle && <div className="text-neutral-400">@{creator.handle}</div>}
            </div>
          </div>
        </div>

        {creator.bio && (
          <p className="text-neutral-300 mb-6 max-w-3xl">{creator.bio}</p>
        )}

        {!isSubscribed && (
          <div className="flex items-center gap-4 mb-6">
            <button
              onClick={() => setShowUpgrade(true)}
              className="px-6 py-3 bg-gradient-to-r from-orange-500 to-red-500 text-white hover:from-orange-600 hover:to-red-600 rounded-lg font-semibold transition"
            >
              Upgrade to Legacy+ - $10/mo
            </button>
            <span className="text-neutral-400 text-sm">
              Unlock full access to {creator.displayName}'s exclusive content
            </span>
          </div>
        )}

        {isSubscribed && (
          <div className="flex items-center gap-2 px-4 py-2 bg-green-500/20 border border-green-500/50 rounded-lg text-green-400 text-sm">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            You have active Legacy+ subscription
          </div>
        )}
      </div>

      {/* Videos Grid */}
      <div className="mb-8">
        {sampleVideos.length > 0 && (
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-white mb-4">Sample Videos</h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {sampleVideos.map((video) => (
                <div
                  key={video.id}
                  className="bg-neutral-950 border border-neutral-800 rounded-lg overflow-hidden hover:border-ccaBlue/50 transition cursor-pointer"
                  onClick={() => setSelectedVideo(video)}
                >
                  <div className="relative aspect-video bg-neutral-900">
                    {video.muxAnimatedGifUrl ? (
                      <img src={video.muxAnimatedGifUrl} alt={video.title} className="w-full h-full object-cover" />
                    ) : video.muxPlaybackId ? (
                      <div className="w-full h-full flex items-center justify-center text-neutral-600">
                        <svg className="w-16 h-16" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                        </svg>
                      </div>
                    ) : null}
                    {video.durationSec && (
                      <div className="absolute bottom-2 right-2 px-2 py-1 bg-black/80 text-white text-xs rounded">
                        {Math.floor(video.durationSec / 60)}:{(video.durationSec % 60).toString().padStart(2, '0')}
                      </div>
                    )}
                  </div>
                  <div className="p-4">
                    <h3 className="font-semibold text-white mb-1">{video.title}</h3>
                    {video.description && (
                      <p className="text-sm text-neutral-400 line-clamp-2">{video.description}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {lockedVideos.length > 0 && (
          <div>
            <h2 className="text-2xl font-bold text-white mb-4">
              Exclusive Content {isSubscribed ? '' : '(Locked)'}
            </h2>
            {!isSubscribed && (
              <div className="mb-6 p-4 bg-neutral-900 border border-neutral-800 rounded-lg text-center">
                <p className="text-neutral-300 mb-4">
                  Subscribe to Legacy+ to unlock {lockedVideos.length} exclusive video{lockedVideos.length !== 1 ? 's' : ''}
                </p>
                <button
                  onClick={() => setShowUpgrade(true)}
                  className="px-6 py-3 bg-gradient-to-r from-orange-500 to-red-500 text-white hover:from-orange-600 hover:to-red-600 rounded-lg font-semibold transition"
                >
                  Upgrade to Legacy+ - $10/mo
                </button>
              </div>
            )}
            {isSubscribed && (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {lockedVideos.map((video) => (
                  <div
                    key={video.id}
                    className="bg-neutral-950 border border-neutral-800 rounded-lg overflow-hidden hover:border-ccaBlue/50 transition cursor-pointer"
                    onClick={() => setSelectedVideo(video)}
                  >
                    <div className="relative aspect-video bg-neutral-900">
                      {video.muxAnimatedGifUrl ? (
                        <img src={video.muxAnimatedGifUrl} alt={video.title} className="w-full h-full object-cover" />
                      ) : video.muxPlaybackId ? (
                        <div className="w-full h-full flex items-center justify-center text-neutral-600">
                          <svg className="w-16 h-16" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                          </svg>
                        </div>
                      ) : null}
                      {video.durationSec && (
                        <div className="absolute bottom-2 right-2 px-2 py-1 bg-black/80 text-white text-xs rounded">
                          {Math.floor(video.durationSec / 60)}:{(video.durationSec % 60).toString().padStart(2, '0')}
                        </div>
                      )}
                    </div>
                    <div className="p-4">
                      <h3 className="font-semibold text-white mb-1">{video.title}</h3>
                      {video.description && (
                        <p className="text-sm text-neutral-400 line-clamp-2">{video.description}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {videos.length === 0 && (
          <div className="text-center py-12">
            <p className="text-neutral-400">No videos available yet.</p>
          </div>
        )}
      </div>

      {/* Video Player Modal */}
      {selectedVideo && selectedVideo.muxPlaybackId && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/90" onClick={() => setSelectedVideo(null)}>
          <div className="relative w-full max-w-6xl mx-4" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setSelectedVideo(null)}
              className="absolute -top-10 right-0 text-white hover:text-neutral-400 transition"
            >
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <div className="bg-neutral-900 rounded-lg overflow-hidden">
              <MuxPlayer
                playbackId={selectedVideo.muxPlaybackId}
                streamType="on-demand"
                primaryColor="#3B82F6"
                className="w-full"
                style={{ aspectRatio: '16 / 9' }}
              />
              <div className="p-6">
                <h3 className="text-2xl font-bold text-white mb-2">{selectedVideo.title}</h3>
                {selectedVideo.description && (
                  <p className="text-neutral-300">{selectedVideo.description}</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Upgrade Modal */}
      {showUpgrade && (
        <LegacyUpgradeModal isOpen={showUpgrade} onClose={() => setShowUpgrade(false)} />
      )}
    </main>
  );
}

