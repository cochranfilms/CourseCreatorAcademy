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
        body: JSON.stringify({ displayName, handle, bio, kitSlug, avatarUrl, bannerUrl })
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
    <main className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-4">Edit Legacy Creator Profile</h1>
      {!user && <p className="text-neutral-400">Please sign in to edit your profile.</p>}
      {user && (
        <div className="space-y-4 border border-neutral-800 p-4 bg-neutral-950">
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
          <div>
            <label className="block text-sm mb-1 text-neutral-300">Avatar URL</label>
            <input value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} className="w-full bg-neutral-900 border border-neutral-800 px-3 py-2" placeholder="https://..." />
          </div>
          <div>
            <label className="block text-sm mb-1 text-neutral-300">Banner URL</label>
            <input value={bannerUrl} onChange={(e) => setBannerUrl(e.target.value)} className="w-full bg-neutral-900 border border-neutral-800 px-3 py-2" placeholder="https://..." />
          </div>

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


