"use client";
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';

export default function LegacyProfileEditorPage() {
  const { user } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [handle, setHandle] = useState('');
  const [bio, setBio] = useState('');
  const [kitSlug, setKitSlug] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [bannerUrl, setBannerUrl] = useState('');
  const [featuredPlaybackId, setFeaturedPlaybackId] = useState('');
  const [featuredTitle, setFeaturedTitle] = useState('');
  const [featuredDescription, setFeaturedDescription] = useState('');
  const [featuredDurationSec, setFeaturedDurationSec] = useState<number | ''>('');
  const [assetsOverlays, setAssetsOverlays] = useState<Array<{title:string; tag?:string; image?:string}>>([]);
  const [assetsSfx, setAssetsSfx] = useState<Array<{title:string; tag?:string; image?:string}>>([]);
  const [gear, setGear] = useState<Array<{name:string; category:string; image?:string; url?:string}>>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        // Fetch current profile via public API list then pick by slug/uid
        if (!user) { setLoading(false); return; }
        const res = await fetch(`/api/legacy/creators/${encodeURIComponent(user.uid)}`);
        if (res.ok) {
          const json = await res.json();
          const c = json?.creator;
          if (c) {
            setDisplayName(c.displayName || '');
            setHandle(c.handle || '');
            setBio(c.bio || '');
            setKitSlug(c.kitSlug || user.uid);
            setAvatarUrl(c.avatarUrl || '');
            setBannerUrl(c.bannerUrl || '');
            if (c.featured) {
              setFeaturedPlaybackId(c.featured.playbackId || '');
              setFeaturedTitle(c.featured.title || '');
              setFeaturedDescription(c.featured.description || '');
              setFeaturedDurationSec(c.featured.durationSec || '');
            }
            if (c.assets) {
              setAssetsOverlays(Array.isArray(c.assets.overlays) ? c.assets.overlays : []);
              setAssetsSfx(Array.isArray(c.assets.sfx) ? c.assets.sfx : []);
            }
            if (Array.isArray(c.gear)) setGear(c.gear);
          } else {
            setKitSlug(user.uid);
          }
        } else {
          setKitSlug(user.uid);
        }
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user]);

  const save = async () => {
    if (!user) { alert('Sign in first'); return; }
    setSaving(true);
    setStatus('');
    try {
      const idToken = await user.getIdToken();
      const res = await fetch('/api/legacy/creators/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          displayName,
          handle,
          bio,
          kitSlug,
          avatarUrl,
          bannerUrl,
          featured: featuredPlaybackId ? {
            playbackId: featuredPlaybackId,
            title: featuredTitle,
            description: featuredDescription,
            durationSec: typeof featuredDurationSec === 'number' ? featuredDurationSec : undefined,
          } : null,
          assets: { overlays: assetsOverlays, sfx: assetsSfx },
          gear,
        })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Failed to save');
      setStatus('Saved!');
    } catch (e: any) {
      setStatus(e?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-4">Edit Legacy Creator Profile</h1>
      {!user && <p className="text-neutral-400">Please sign in to edit your profile.</p>}
      {user && (
        <div className="space-y-8">
          <section className="border border-neutral-800 p-4 bg-neutral-950">
            <h2 className="text-xl font-semibold mb-4">Profile</h2>
          <div>
            <label className="block text-sm mb-1 text-neutral-300">Display Name</label>
            <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="w-full bg-neutral-900 border border-neutral-800 px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm mb-1 text-neutral-300">Handle</label>
            <input value={handle} onChange={(e) => setHandle(e.target.value.replace('@',''))} className="w-full bg-neutral-900 border border-neutral-800 px-3 py-2" placeholder="shortstache" />
          </div>
          <div>
            <label className="block text-sm mb-1 text-neutral-300">Bio</label>
            <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={3} className="w-full bg-neutral-900 border border-neutral-800 px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm mb-1 text-neutral-300">Kit Slug</label>
            <input value={kitSlug} onChange={(e) => setKitSlug(e.target.value)} className="w-full bg-neutral-900 border border-neutral-800 px-3 py-2" placeholder={user.uid} />
            <p className="text-xs text-neutral-500 mt-1">Public URL: /creator-kits/{kitSlug || user.uid}</p>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm mb-1 text-neutral-300">Avatar URL</label>
              <input value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} className="w-full bg-neutral-900 border border-neutral-800 px-3 py-2" placeholder="https://..." />
            </div>
            <div>
              <label className="block text-sm mb-1 text-neutral-300">Banner URL</label>
              <input value={bannerUrl} onChange={(e) => setBannerUrl(e.target.value)} className="w-full bg-neutral-900 border border-neutral-800 px-3 py-2" placeholder="https://..." />
            </div>
          </div>
          </section>

          <section className="border border-neutral-800 p-4 bg-neutral-950">
            <h2 className="text-xl font-semibold mb-4">Featured Video</h2>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm mb-1 text-neutral-300">Mux Playback ID</label>
                <input value={featuredPlaybackId} onChange={(e) => setFeaturedPlaybackId(e.target.value)} className="w-full bg-neutral-900 border border-neutral-800 px-3 py-2" placeholder="abc123" />
              </div>
              <div>
                <label className="block text-sm mb-1 text-neutral-300">Duration (seconds)</label>
                <input type="number" value={featuredDurationSec} onChange={(e) => setFeaturedDurationSec(e.target.value ? Number(e.target.value) : '')} className="w-full bg-neutral-900 border border-neutral-800 px-3 py-2" />
              </div>
            </div>
            <div className="grid md:grid-cols-2 gap-4 mt-4">
              <div>
                <label className="block text-sm mb-1 text-neutral-300">Title</label>
                <input value={featuredTitle} onChange={(e) => setFeaturedTitle(e.target.value)} className="w-full bg-neutral-900 border border-neutral-800 px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm mb-1 text-neutral-300">Description</label>
                <input value={featuredDescription} onChange={(e) => setFeaturedDescription(e.target.value)} className="w-full bg-neutral-900 border border-neutral-800 px-3 py-2" />
              </div>
            </div>
          </section>

          <section className="border border-neutral-800 p-4 bg-neutral-950">
            <h2 className="text-xl font-semibold mb-4">Assets</h2>
            <h3 className="text-sm text-neutral-400 mb-2">Overlays & Transitions</h3>
            <ListEditor items={assetsOverlays} onChange={setAssetsOverlays} labels={{title:'Title', tag:'Tag', image:'Image URL'}} />
            <h3 className="text-sm text-neutral-400 mt-6 mb-2">Sound Effects</h3>
            <ListEditor items={assetsSfx} onChange={setAssetsSfx} labels={{title:'Title', tag:'Tag', image:'Image URL'}} />
          </section>

          <section className="border border-neutral-800 p-4 bg-neutral-950">
            <h2 className="text-xl font-semibold mb-4">Gear</h2>
            <GearEditor items={gear} onChange={setGear} />
          </section>

          <div className="flex items-center gap-3">
            <button onClick={save} disabled={saving} className="px-4 py-2 bg-white text-black border-2 border-ccaBlue disabled:opacity-50">{saving ? 'Saving...' : 'Save'}</button>
            {status && <span className="text-sm text-neutral-300">{status}</span>}
            <a href={`/creator-kits/${encodeURIComponent(kitSlug || user?.uid || '')}`} className="text-ccaBlue text-sm">View public page ↗</a>
          </div>
        </div>
      )}
    </main>
  );
}

function ListEditor({ items, onChange, labels }: { items: Array<{title:string; tag?:string; image?:string}>; onChange: (v:any)=>void; labels: {title:string; tag:string; image:string} }) {
  const add = () => onChange([...(items||[]), { title: '', tag: '', image: '' }]);
  const update = (idx: number, key: 'title'|'tag'|'image', value: string) => {
    const next = items.slice();
    next[idx] = { ...next[idx], [key]: value };
    onChange(next);
  };
  const remove = (idx: number) => onChange(items.filter((_, i) => i !== idx));
  return (
    <div className="space-y-3">
      {(items||[]).map((it, i) => (
        <div key={i} className="grid md:grid-cols-3 gap-2 items-center">
          <input value={it.title||''} onChange={(e)=>update(i,'title',e.target.value)} placeholder={labels.title} className="bg-neutral-900 border border-neutral-800 px-3 py-2" />
          <input value={it.tag||''} onChange={(e)=>update(i,'tag',e.target.value)} placeholder={labels.tag} className="bg-neutral-900 border border-neutral-800 px-3 py-2" />
          <div className="flex gap-2">
            <input value={it.image||''} onChange={(e)=>update(i,'image',e.target.value)} placeholder={labels.image} className="flex-1 bg-neutral-900 border border-neutral-800 px-3 py-2" />
            <button onClick={()=>remove(i)} className="px-3 py-2 bg-neutral-900 border border-neutral-800 text-neutral-300 hover:bg-neutral-800">Remove</button>
          </div>
        </div>
      ))}
      <button onClick={add} className="px-3 py-2 bg-neutral-900 border border-neutral-800 text-white hover:bg-neutral-800">Add Item</button>
    </div>
  );
}

function GearEditor({ items, onChange }: { items: Array<{name:string; category:string; image?:string; url?:string}>; onChange: (v:any)=>void }) {
  const add = () => onChange([...(items||[]), { name: '', category: '', image: '', url: '' }]);
  const update = (idx: number, key: 'name'|'category'|'image'|'url', value: string) => {
    const next = items.slice();
    next[idx] = { ...next[idx], [key]: value };
    onChange(next);
  };
  const remove = (idx: number) => onChange(items.filter((_, i) => i !== idx));
  return (
    <div className="space-y-3">
      {(items||[]).map((it, i) => (
        <div key={i} className="grid md:grid-cols-4 gap-2 items-center">
          <input value={it.name||''} onChange={(e)=>update(i,'name',e.target.value)} placeholder="Product Name" className="bg-neutral-900 border border-neutral-800 px-3 py-2" />
          <input value={it.category||''} onChange={(e)=>update(i,'category',e.target.value)} placeholder="Category" className="bg-neutral-900 border border-neutral-800 px-3 py-2" />
          <input value={it.image||''} onChange={(e)=>update(i,'image',e.target.value)} placeholder="Image URL" className="bg-neutral-900 border border-neutral-800 px-3 py-2" />
          <div className="flex gap-2">
            <input value={it.url||''} onChange={(e)=>update(i,'url',e.target.value)} placeholder="Affiliate URL" className="flex-1 bg-neutral-900 border border-neutral-800 px-3 py-2" />
            <button onClick={()=>remove(i)} className="px-3 py-2 bg-neutral-900 border border-neutral-800 text-neutral-300 hover:bg-neutral-800">Remove</button>
          </div>
        </div>
      ))}
      <button onClick={add} className="px-3 py-2 bg-neutral-900 border border-neutral-800 text-white hover:bg-neutral-800">Add Gear Item</button>
    </div>
  );
}


