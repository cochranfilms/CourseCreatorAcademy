"use client";
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@/contexts/AuthContext';
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
  const [assetsTab, setAssetsTab] = useState<'overlays' | 'sfx'>('overlays');

  useEffect(() => {
    const load = async () => {
      if (!slug) { setLoading(false); return; }
      try {
        const url = `/api/legacy/creators/${encodeURIComponent(slug)}${user ? `?userId=${encodeURIComponent(user.uid)}` : ''}`;
        const res = await fetch(url, { cache: 'no-store' });
        const json = await res.json();
        if (res.status !== 200) {
          // Fallback to placeholders
          setCreator({ id: 'placeholder', displayName: 'Creator', bio: '', kitSlug: slug } as any);
          setVideos([
            { id: 'ph-1', title: 'Sample Video 1', description: 'Preview of exclusive content', isSample: true },
            { id: 'ph-2', title: 'Sample Video 2', description: 'Preview of exclusive content', isSample: true },
            { id: 'ph-3', title: 'Sample Video 3', description: 'Preview of exclusive content', isSample: true },
          ] as any);
          setIsSubscribed(false);
          return;
        }
        const { creator: c, subscribed, samples, full } = json || {};
        setCreator(c || null);
        setIsSubscribed(Boolean(subscribed));
        const vids: LegacyVideo[] = Array.isArray(samples) ? samples.map((v: any) => ({ id: v.id, ...v })) : [];
        if (Array.isArray(full) && subscribed) vids.push(...full.map((v: any) => ({ id: v.id, ...v })));
        // Ensure at least 3 placeholders if no samples
        if (!vids.length) {
          vids.push(
            { id: 'ph-1', title: 'Sample Video 1', description: 'Preview of exclusive content', isSample: true } as any,
            { id: 'ph-2', title: 'Sample Video 2', description: 'Preview of exclusive content', isSample: true } as any,
            { id: 'ph-3', title: 'Sample Video 3', description: 'Preview of exclusive content', isSample: true } as any,
          );
        }
        setVideos(vids);
      } catch (e) {
        setCreator({ id: 'placeholder', displayName: 'Creator', bio: '', kitSlug: slug } as any);
        setVideos([
          { id: 'ph-1', title: 'Sample Video 1', description: 'Preview of exclusive content', isSample: true },
          { id: 'ph-2', title: 'Sample Video 2', description: 'Preview of exclusive content', isSample: true },
          { id: 'ph-3', title: 'Sample Video 3', description: 'Preview of exclusive content', isSample: true },
        ] as any);
        setIsSubscribed(false);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [slug, user]);

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

  // Featured + sample placeholder data
  const featured: LegacyVideo | null = (sampleVideos.find(v => v.muxPlaybackId) || sampleVideos[0] || null) || null;
  const assetSamples = {
    overlays: [
      { id: 'a1', title: 'GK - Flux Essence', by: creator?.displayName || 'Creator', tag: 'transitions', image: creator?.bannerUrl || '' },
      { id: 'a2', title: 'GK - Spin Transitions', by: creator?.displayName || 'Creator', tag: 'transitions', image: creator?.bannerUrl || '' },
      { id: 'a3', title: 'GK - Whip Pans', by: creator?.displayName || 'Creator', tag: 'transitions', image: creator?.bannerUrl || '' },
      { id: 'a4', title: 'GK - Gate Flare', by: creator?.displayName || 'Creator', tag: 'analog', image: creator?.bannerUrl || '' },
      { id: 'a5', title: 'GK - Dust Wave', by: creator?.displayName || 'Creator', tag: 'film', image: creator?.bannerUrl || '' },
      { id: 'a6', title: 'GK - Retro Gate Portra Film', by: creator?.displayName || 'Creator', tag: 'film', image: creator?.bannerUrl || '' },
    ],
    sfx: [
      { id: 's1', title: 'GK - Swoosh Pack', by: creator?.displayName || 'Creator', tag: 'wooshes', image: creator?.bannerUrl || '' },
      { id: 's2', title: 'GK - Atmospheres', by: creator?.displayName || 'Creator', tag: 'ambience', image: creator?.bannerUrl || '' },
      { id: 's3', title: 'GK - Risers', by: creator?.displayName || 'Creator', tag: 'risers', image: creator?.bannerUrl || '' },
    ],
  } as const;

  const gearSamples = [
    { id: 'g1', name: 'Canon RF 85mm F1.2 L USM DS', category: 'LENSES', image: '/api/placeholder/600/400', url: '#' },
    { id: 'g2', name: 'Canon C70 Cinema Camera', category: 'CAMERA', image: '/api/placeholder/600/400', url: '#' },
    { id: 'g3', name: 'Canon EOS R3 Mirrorless Camera', category: 'CAMERA', image: '/api/placeholder/600/400', url: '#' },
    { id: 'g4', name: 'Canon EOS R5 Mirrorless Camera', category: 'CAMERA', image: '/api/placeholder/600/400', url: '#' },
    { id: 'g5', name: 'Shortstache Everyday Filter', category: 'FILTER', image: '/api/placeholder/600/400', url: '#' },
    { id: 'g6', name: 'RED Komodo-X', category: 'CAMERA', image: '/api/placeholder/600/400', url: '#' },
  ] as const;

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

      {/* Featured Video */}
      <div className="mb-10">
        <h2 className="text-2xl md:text-3xl font-bold text-white mb-2">Featured Video</h2>
        <p className="text-neutral-400 mb-4">Check out this highlighted video from {creator.displayName}</p>
        <div className="bg-neutral-900 rounded-xl overflow-hidden border border-neutral-800">
          <div className="relative">
            {featured && featured.muxPlaybackId ? (
              <MuxPlayer
                playbackId={featured.muxPlaybackId}
                streamType="on-demand"
                primaryColor="#3B82F6"
                className="w-full"
                style={{ aspectRatio: '16 / 9' }}
              />
            ) : (
              <div className="aspect-video w-full bg-neutral-800 flex items-center justify-center">
                <div className="text-neutral-500">Featured video coming soon</div>
              </div>
            )}
          </div>
          <div className="p-5">
            <div className="inline-flex items-center gap-2 text-xs mb-2">
              <span className="px-2 py-0.5 rounded bg-red-600/20 text-red-400 border border-red-500/30">Featured</span>
              {featured?.durationSec ? (
                <span className="text-neutral-400">{Math.floor((featured.durationSec||0)/60)}m</span>
              ) : null}
            </div>
            <div className="text-xl md:text-2xl font-semibold text-white">
              {featured?.title || `Backstage EP1 — Controlled Chaos with Jeremy Piven`}
            </div>
            <p className="text-neutral-300 mt-2">
              {featured?.description || `Behind-the-scenes look into a live project. No fancy setups — just instinct and fast moves.`}
            </p>
          </div>
        </div>
      </div>

      {/* Videos Grid */}
      <div className="mb-8">
        {sampleVideos.length > 0 && (
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-white mb-4">Playlists</h2>
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

      {/* Assets */}
      <div className="mb-12">
        <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">Assets</h2>
        <div className="flex items-center justify-center mb-6">
          <div className="inline-flex bg-neutral-900 border border-neutral-800 rounded-full p-1">
            <button onClick={() => setAssetsTab('overlays')} className={`px-4 py-1 rounded-full text-sm ${assetsTab==='overlays'?'bg-ccaBlue/20 text-ccaBlue border border-ccaBlue/30':'text-neutral-300'}`}>Overlays & Transitions</button>
            <button onClick={() => setAssetsTab('sfx')} className={`px-4 py-1 rounded-full text-sm ${assetsTab==='sfx'?'bg-ccaBlue/20 text-ccaBlue border border-ccaBlue/30':'text-neutral-300'}`}>Sound Effects</button>
          </div>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {(assetsTab==='overlays' ? assetSamples.overlays : assetSamples.sfx).map((a) => (
            <div key={a.id} className="bg-neutral-950 border border-neutral-800 rounded-xl overflow-hidden">
              <div className="aspect-video w-full bg-neutral-900 relative">
                {a.image ? (
                  <Image src={a.image} alt={a.title} fill sizes="(max-width:768px) 100vw, 33vw" className="object-cover" />
                ) : null}
              </div>
              <div className="p-4">
                <div className="text-lg font-semibold text-white mb-1">{a.title}</div>
                <div className="text-sm text-neutral-400 mb-2">By {a.by}</div>
                <div className="text-xs text-neutral-400">{a.tag}</div>
                <div className="flex items-center justify-between mt-3 text-neutral-400">
                  <div className="inline-flex items-center gap-3 text-sm">
                    <span className="inline-flex items-center gap-1">
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M5 20h14v-2H5v2zm7-18L5.33 15h13.34L12 2z"/></svg> 0
                    </span>
                  </div>
                  <button className="p-2 hover:bg-neutral-800 rounded">
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 6 4 4 6.5 4c1.74 0 3.41 1 4.13 2.44C11.09 5 12.76 4 14.5 4 17 4 19 6 19 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Gear */}
      <div className="mb-12">
        <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">{creator.displayName}'s Gear</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {gearSamples.map((g) => (
            <a key={g.id} href={g.url} target="_blank" rel="noreferrer" className="bg-neutral-950 border border-neutral-800 rounded-xl overflow-hidden hover:border-ccaBlue/50 transition block">
              <div className="aspect-video w-full bg-neutral-900" />
              <div className="p-4">
                <div className="text-xs mb-2">
                  <span className="px-2 py-1 rounded bg-neutral-800 text-neutral-300">{g.category}</span>
                </div>
                <div className="text-white font-semibold">{g.name}</div>
                <div className="text-sm text-ccaBlue mt-1">View Product ↗</div>
              </div>
            </a>
          ))}
        </div>
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

