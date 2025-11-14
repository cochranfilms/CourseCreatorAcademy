"use client";

import { useState, useEffect } from 'react';
import { collection, query, getDocs, orderBy } from 'firebase/firestore';
import { db, firebaseReady } from '@/lib/firebaseClient';

type AssetCategory = 'All Packs' | 'LUTs & Presets' | 'Overlays & Transitions' | 'SFX & Plugins' | 'Templates';

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

const categories: AssetCategory[] = ['All Packs', 'LUTs & Presets', 'Overlays & Transitions', 'SFX & Plugins', 'Templates'];

export default function AssetsPage() {
  const [selectedCategory, setSelectedCategory] = useState<AssetCategory>('All Packs');
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState<string | null>(null);

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

  const filteredAssets = selectedCategory === 'All Packs' 
    ? assets 
    : assets.filter(asset => asset.category === selectedCategory);

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

  return (
    <main className="max-w-7xl mx-auto px-6 py-8">
      <h1 className="text-3xl md:text-4xl font-bold">OVERLAY+</h1>
      <p className="text-neutral-400">Thousands of premium assets & templates.</p>

      <div className="mt-6 flex flex-wrap gap-2">
        {categories.map((category) => (
          <button 
            key={category}
            onClick={() => setSelectedCategory(category)}
            className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
              selectedCategory === category
                ? 'bg-ccaBlue text-white'
                : 'bg-neutral-900 border border-neutral-800 text-neutral-300 hover:bg-neutral-800'
            }`}
          >
            {category}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="mt-6 text-neutral-400">Loading assets...</div>
      ) : filteredAssets.length === 0 ? (
        <div className="mt-6 text-neutral-400">No assets found in this category.</div>
      ) : (
        <div className="mt-6 grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredAssets.map((asset) => (
            <div 
              key={asset.id} 
              className="rounded-2xl overflow-hidden border border-neutral-800 bg-neutral-950 hover:border-ccaBlue/50 transition-colors cursor-pointer group"
              onClick={() => handleDownload(asset)}
            >
              <div className="h-44 bg-neutral-800 relative overflow-hidden">
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
                      // Hide image if it fails to load
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                ) : null}
                <div className="w-full h-full flex items-center justify-center text-neutral-600 bg-gradient-to-br from-neutral-800 to-neutral-900">
                  <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
              <div className="p-4">
                <div className="font-semibold text-white">{asset.title}</div>
                <div className="text-sm text-neutral-400 mt-1">{asset.category}</div>
                {asset.description && (
                  <div className="text-xs text-neutral-500 mt-2 line-clamp-2">{asset.description}</div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}


