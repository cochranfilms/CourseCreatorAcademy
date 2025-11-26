"use client";

import { useState, useEffect, useRef } from 'react';
import { collection, query, getDocs, orderBy } from 'firebase/firestore';
import { db, firebaseReady } from '@/lib/firebaseClient';

type AssetCategory = 'All Packs' | 'LUTs & Presets' | 'Overlays & Transitions' | 'SFX & Plugins' | 'Templates';
type SubCategory = 'Overlays' | 'Transitions' | 'SFX' | 'Plugins' | 'LUTs' | 'Presets' | null;

interface Asset {
  id: string;
  title: string;
  category: AssetCategory;
  thumbnailUrl?: string;
  storagePath?: string;
  muxPlaybackId?: string;
  fileType?: string;
  description?: string;
}

interface SoundEffect {
  id: string;
  assetId: string;
  assetTitle: string;
  fileName: string;
  storagePath: string;
  fileType: string;
  duration: number;
}

const categories: AssetCategory[] = ['All Packs', 'LUTs & Presets', 'Overlays & Transitions', 'SFX & Plugins', 'Templates'];

/**
 * Gets subcategory from storage path
 */
function getSubCategory(asset: Asset): SubCategory {
  if (!asset.storagePath) return null;
  
  const path = asset.storagePath.toLowerCase();
  const title = asset.title.toLowerCase();
  
  // Check storage path first
  if (path.includes('/overlays/')) return 'Overlays';
  if (path.includes('/transitions/')) return 'Transitions';
  if (path.includes('/sfx/')) return 'SFX';
  if (path.includes('/plugins/')) return 'Plugins';
  if (path.includes('/luts/')) return 'LUTs';
  if (path.includes('/presets/')) return 'Presets';
  
  // Fallback to title keywords
  if (title.includes('overlay') || title.includes('flare') || title.includes('light leak')) return 'Overlays';
  if (title.includes('transition')) return 'Transitions';
  if (title.includes('sfx') || title.includes('sound') || title.includes('audio')) return 'SFX';
  if (title.includes('plugin')) return 'Plugins';
  if (title.includes('lut')) return 'LUTs';
  if (title.includes('preset')) return 'Presets';
  
  return null;
}

/**
 * Format duration in seconds to MM:SS
 */
function formatDuration(seconds: number): string {
  if (!seconds || seconds === 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Sound Effect Player Component
 */
function SoundEffectPlayer({ soundEffect, asset }: { soundEffect: SoundEffect; asset: Asset }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(soundEffect.duration || 0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // Load audio URL when component mounts
    const loadAudioUrl = async () => {
      try {
        const response = await fetch(`/api/assets/sound-effect-download?assetId=${soundEffect.assetId}&soundEffectId=${soundEffect.id}`);
        if (response.ok) {
          const data = await response.json();
          setAudioUrl(data.downloadUrl);
        }
      } catch (error) {
        console.error('Error loading audio URL:', error);
      }
    };
    loadAudioUrl();
  }, [soundEffect]);

  useEffect(() => {
    if (!audioRef.current || !audioUrl) return;

    const audio = audioRef.current;
    
    const updateTime = () => setCurrentTime(audio.currentTime);
    const updateDuration = () => setDuration(audio.duration || soundEffect.duration || 0);
    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener('timeupdate', updateTime);
    audio.addEventListener('loadedmetadata', updateDuration);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', updateTime);
      audio.removeEventListener('loadedmetadata', updateDuration);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [audioUrl, soundEffect.duration]);

  const togglePlay = () => {
    if (!audioRef.current || !audioUrl) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (downloading) return;
    
    setDownloading(true);
    try {
      const response = await fetch(`/api/assets/sound-effect-download?assetId=${soundEffect.assetId}&soundEffectId=${soundEffect.id}`);
      if (!response.ok) throw new Error('Failed to get download URL');
      const data = await response.json();
      
      const link = document.createElement('a');
      link.href = data.downloadUrl;
      link.download = soundEffect.fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Download error:', error);
      alert('Failed to download sound effect. Please try again.');
    } finally {
      setDownloading(false);
    }
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="border border-neutral-700 bg-black rounded-lg p-3 hover:border-neutral-500 transition-colors">
      <div className="flex items-center gap-3">
        {/* Play Button */}
        <button
          onClick={togglePlay}
          disabled={!audioUrl}
          className="w-10 h-10 rounded-full bg-neutral-800 hover:bg-neutral-700 flex items-center justify-center flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isPlaying ? (
            <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>
            </svg>
          ) : (
            <svg className="w-5 h-5 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z"/>
            </svg>
          )}
        </button>

        {/* Thumbnail */}
        <div className="w-12 h-12 rounded bg-neutral-900 flex-shrink-0 overflow-hidden">
          {asset.thumbnailUrl && asset.thumbnailUrl.startsWith('https://') ? (
            <img 
              src={asset.thumbnailUrl} 
              alt={soundEffect.fileName}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-neutral-600">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
              </svg>
            </div>
          )}
        </div>

        {/* Info and Waveform */}
        <div className="flex-1 min-w-0">
          <div className="text-white text-sm font-medium truncate">{soundEffect.fileName.replace(/\.[^/.]+$/, '')}</div>
          <div className="text-xs text-neutral-400 mt-0.5">Overlay</div>
          
          {/* Waveform Visualization */}
          <div className="mt-2 h-8 bg-neutral-900 rounded relative overflow-hidden">
            <div className="absolute inset-0 flex items-center gap-0.5 px-1">
              {Array.from({ length: 50 }).map((_, i) => {
                const barHeight = Math.random() * 100;
                const isActive = progress > 0 && (i / 50) * 100 < progress;
                return (
                  <div
                    key={i}
                    className={`flex-1 ${isActive ? 'bg-ccaBlue' : 'bg-neutral-600'} rounded-sm transition-colors`}
                    style={{ height: `${barHeight}%` }}
                  />
                );
              })}
            </div>
          </div>
          
          {/* Duration */}
          <div className="text-xs text-neutral-500 mt-1">
            {formatDuration(currentTime)}/{formatDuration(duration)}
          </div>
        </div>

        {/* Download Button */}
        <button
          onClick={handleDownload}
          disabled={downloading}
          className="w-8 h-8 flex items-center justify-center text-neutral-400 hover:text-white transition-colors flex-shrink-0"
          title="Download"
        >
          {downloading ? (
            <svg className="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
          )}
        </button>

        {/* Favorite Button */}
        <button
          className="w-8 h-8 flex items-center justify-center text-neutral-400 hover:text-white transition-colors flex-shrink-0"
          title="Favorite"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </svg>
        </button>
      </div>

      {/* Tag */}
      <div className="mt-2">
        <span className="inline-block px-2 py-0.5 bg-neutral-800 text-neutral-400 text-xs rounded">
          sound effects
        </span>
      </div>

      {/* Hidden Audio Element */}
      {audioUrl && (
        <audio ref={audioRef} src={audioUrl} preload="metadata" />
      )}
    </div>
  );
}

export default function AssetsPage() {
  const [selectedCategory, setSelectedCategory] = useState<AssetCategory>('All Packs');
  const [selectedSubCategory, setSelectedSubCategory] = useState<SubCategory>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [soundEffects, setSoundEffects] = useState<{ [assetId: string]: SoundEffect[] }>({});
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState<string | null>(null);
  
  // Reset subcategory when main category changes
  useEffect(() => {
    setSelectedSubCategory(null);
  }, [selectedCategory]);

  useEffect(() => {
    const loadAssets = async () => {
      if (!firebaseReady || !db) {
        setLoading(false);
        return;
      }

      try {
        const q = query(collection(db, 'assets'), orderBy('createdAt', 'desc'));
        const snapshot = await getDocs(q);
        const loadedAssets: Asset[] = [];
        snapshot.forEach((doc) => {
          loadedAssets.push({
            id: doc.id,
            ...doc.data()
          } as Asset);
        });
        setAssets(loadedAssets);
      } catch (error) {
        console.error('Error loading assets:', error);
      } finally {
        setLoading(false);
      }
    };

    loadAssets();
  }, []);

  // Load sound effects for SFX assets when SFX subcategory is selected
  useEffect(() => {
    if (selectedSubCategory !== 'SFX') return;

    const loadSoundEffects = async () => {
      const sfxAssets = assets.filter(asset => getSubCategory(asset) === 'SFX');
      const effectsMap: { [assetId: string]: SoundEffect[] } = {};

      for (const asset of sfxAssets) {
        try {
          const response = await fetch(`/api/assets/sound-effects?assetId=${asset.id}`);
          if (response.ok) {
            const data = await response.json();
            effectsMap[asset.id] = data.soundEffects || [];
          }
        } catch (error) {
          console.error(`Error loading sound effects for ${asset.id}:`, error);
        }
      }

      setSoundEffects(effectsMap);
    };

    if (assets.length > 0) {
      loadSoundEffects();
    }
  }, [selectedSubCategory, assets]);

  // Get subcategories for the current category
  const getSubCategories = (category: AssetCategory): SubCategory[] => {
    if (category === 'Overlays & Transitions') return ['Overlays', 'Transitions'];
    if (category === 'SFX & Plugins') return ['SFX', 'Plugins'];
    if (category === 'LUTs & Presets') return ['LUTs', 'Presets'];
    return [];
  };

  const subCategories = getSubCategories(selectedCategory);
  const showSubTabs = subCategories.length > 0;

  const filteredAssets = selectedCategory === 'All Packs' 
    ? assets 
    : assets.filter(asset => {
        if (asset.category !== selectedCategory) return false;
        
        // If subcategory is selected, filter by it
        if (selectedSubCategory) {
          return getSubCategory(asset) === selectedSubCategory;
        }
        
        return true;
      });

  const handleDownload = async (asset: Asset) => {
    if (downloading === asset.id) return;
    
    setDownloading(asset.id);
    try {
      if (asset.storagePath) {
        // File asset - get signed URL from API
        const response = await fetch(`/api/assets/download?assetId=${asset.id}`);
        if (!response.ok) throw new Error('Failed to get download URL');
        const data = await response.json();
        
        // Trigger download
        const link = document.createElement('a');
        link.href = data.downloadUrl;
        link.download = asset.title.replace(/\s+/g, '_') + (asset.fileType ? `.${asset.fileType}` : '');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else if (asset.muxPlaybackId) {
        // Video asset - handle MUX playback (for now, just show message)
        alert('Video assets will open in player');
      }
    } catch (error) {
      console.error('Download error:', error);
      alert('Failed to download asset. Please try again.');
    } finally {
      setDownloading(null);
    }
  };

  // Show individual sound effects for SFX subcategory
  const showSoundEffects = selectedSubCategory === 'SFX';
  const allSoundEffects: Array<{ soundEffect: SoundEffect; asset: Asset }> = [];

  if (showSoundEffects) {
    filteredAssets.forEach(asset => {
      const effects = soundEffects[asset.id] || [];
      effects.forEach(effect => {
        allSoundEffects.push({ soundEffect: effect, asset });
      });
    });
  }

  return (
    <main className="bg-black min-h-screen">
      <div className="max-w-7xl mx-auto px-6 py-8">
        <h1 className="text-3xl md:text-4xl font-bold text-center text-white">Assets</h1>
        <p className="text-neutral-400 text-center mt-2">Thousands of premium assets & templates.</p>

        <div className="mt-6 flex flex-wrap gap-2 justify-center">
          {categories.map((category) => (
            <button 
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`px-4 py-2 rounded-full text-sm transition-colors ${
                selectedCategory === category
                  ? 'bg-ccaBlue text-white'
                  : 'bg-neutral-900 border border-neutral-800 text-neutral-300 hover:bg-neutral-800'
              }`}
            >
              {category}
            </button>
          ))}
        </div>

        {/* Sub-category tabs for combined categories - Made smaller */}
        {showSubTabs && (
          <div className="mt-4 flex justify-center gap-2">
            <button
              onClick={() => setSelectedSubCategory(null)}
              className={`px-4 py-1 rounded-lg text-sm font-medium transition-colors ${
                selectedSubCategory === null
                  ? 'bg-ccaBlue text-white'
                  : 'bg-neutral-900 border border-neutral-800 text-neutral-300 hover:bg-neutral-800'
              }`}
            >
              All
            </button>
            {subCategories.map((subCat) => (
              <button
                key={subCat}
                onClick={() => setSelectedSubCategory(subCat)}
                className={`px-4 py-1 rounded-lg text-sm font-medium transition-colors ${
                  selectedSubCategory === subCat
                    ? 'bg-ccaBlue text-white'
                    : 'bg-neutral-900 border border-neutral-800 text-neutral-300 hover:bg-neutral-800'
                }`}
              >
                {subCat}
              </button>
            ))}
          </div>
        )}

        {loading ? (
          <div className="mt-6 grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="rounded-lg overflow-hidden border border-neutral-700 bg-black">
                <div className="aspect-square bg-neutral-900 animate-pulse"></div>
                <div className="p-3">
                  <div className="h-4 bg-neutral-900 rounded w-3/4 mb-2 animate-pulse"></div>
                  <div className="h-3 bg-neutral-900 rounded w-1/2 animate-pulse"></div>
                </div>
              </div>
            ))}
          </div>
        ) : showSoundEffects && allSoundEffects.length > 0 ? (
          <div className="mt-6 space-y-2">
            {allSoundEffects.map(({ soundEffect, asset }) => (
              <SoundEffectPlayer key={soundEffect.id} soundEffect={soundEffect} asset={asset} />
            ))}
          </div>
        ) : filteredAssets.length === 0 ? (
          <div className="mt-6 text-neutral-400 text-center">No assets found in this category.</div>
        ) : (
          <div className="mt-6 grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredAssets.map((asset) => (
              <div 
                key={asset.id} 
                className="rounded-lg overflow-hidden border border-neutral-700 bg-black hover:border-neutral-500 transition-colors cursor-pointer group"
                onClick={() => handleDownload(asset)}
              >
                <div className="aspect-square bg-neutral-900 relative overflow-hidden">
                  {asset.thumbnailUrl && 
                   asset.thumbnailUrl.startsWith('https://') && 
                   !asset.thumbnailUrl.includes('via.placeholder.com') &&
                   (asset.thumbnailUrl.includes('firebasestorage.googleapis.com') || 
                    asset.thumbnailUrl.includes('firebasestorage.app')) ? (
                    <img 
                      src={asset.thumbnailUrl} 
                      alt={asset.title}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        console.error('Failed to load thumbnail:', asset.title, asset.thumbnailUrl);
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  ) : null}
                  <div className="w-full h-full flex items-center justify-center text-neutral-600 bg-gradient-to-br from-neutral-900 to-black">
                    <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                  </div>
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                    {downloading === asset.id ? (
                      <div className="text-white text-sm">Downloading...</div>
                    ) : (
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity text-white text-sm font-medium">
                        Click to Download
                      </div>
                    )}
                  </div>
                </div>
                <div className="p-3 bg-black">
                  <div className="font-semibold text-white text-sm">{asset.title}</div>
                  <div className="text-xs text-neutral-400 mt-1">{asset.category}</div>
                  {asset.description && (
                    <div className="text-xs text-neutral-500 mt-2 line-clamp-2">{asset.description}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
