"use client";
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { db, firebaseReady, storage } from '@/lib/firebaseClient';
import { doc, getDoc, collection, getDocs, query, orderBy } from 'firebase/firestore';
import { ref as storageRef, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import ImageCropperModal from '@/components/ImageCropperModal';

export default function LegacyProfileEditorPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'profile'|'upload'|'assets'|'gear'|'payouts'|'opportunities'>('profile');
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
  const [isLegacyCreator, setIsLegacyCreator] = useState<boolean | null>(null);
  const [hasCreatorMapping, setHasCreatorMapping] = useState<boolean>(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [bannerUploading, setBannerUploading] = useState(false);
  const [avatarProgress, setAvatarProgress] = useState(0);
  const [bannerProgress, setBannerProgress] = useState(0);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [cropAspect, setCropAspect] = useState<number>(1);
  const [pendingPath, setPendingPath] = useState<string>('');

  // Inline video upload state (replaces separate /upload page)
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadDescription, setUploadDescription] = useState('');
  const [uploadIsSample, setUploadIsSample] = useState(true);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  // Payouts (Stripe Connect) state
  const [connectAccountId, setConnectAccountId] = useState<string | null>(null);
  const [connectStatus, setConnectStatus] = useState<any>(null);
  const [payoutsLoading, setPayoutsLoading] = useState(false);
  // Opportunities state
  const [oppTitle, setOppTitle] = useState('');
  const [oppLocation, setOppLocation] = useState('');
  const [oppType, setOppType] = useState('Freelance');
  const [oppApplyUrl, setOppApplyUrl] = useState('');
  const [oppDescription, setOppDescription] = useState('');
  const [oppSaving, setOppSaving] = useState(false);
  const [myOpps, setMyOpps] = useState<Array<{ id: string; title: string; location: string; type: string; applyUrl: string; posted?: any }>>([]);
  // My uploaded videos
  const [myVideos, setMyVideos] = useState<Array<{ id: string; title?: string; description?: string; muxPlaybackId?: string | null; muxAnimatedGifUrl?: string | null; isSample?: boolean; createdAt?: any }>>([]);
  const [videosLoading, setVideosLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        // Fetch current profile via public API list then pick by slug/uid
        if (!user) { setLoading(false); return; }
        // Gate by legacy flag
        if (firebaseReady && db) {
          const uref = await getDoc(doc(db, 'users', user.uid));
          const udata = uref.exists() ? (uref.data() as any) : {};
          const legacy = Boolean(udata.isLegacyCreator || udata.roles?.legacyCreator);
          setIsLegacyCreator(legacy);
        }
        const res = await fetch(`/api/legacy/creators/${encodeURIComponent(user.uid)}`);
        if (res.ok) {
          const json = await res.json();
          const c = json?.creator;
          if (c) {
            setHasCreatorMapping(true);
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

  // Load creator opportunities
  useEffect(() => {
    const loadOpps = async () => {
      if (!user) return;
      try {
        const res = await fetch(`/api/legacy/creators/${encodeURIComponent(user.uid)}/opportunities`, { cache: 'no-store' });
        const json = await res.json();
        setMyOpps(Array.isArray(json?.opportunities) ? json.opportunities : []);
      } catch {}
    };
    loadOpps();
  }, [user]);

  // Load my uploaded videos
  useEffect(() => {
    const loadVideos = async () => {
      if (!user || !firebaseReady || !db) return;
      setVideosLoading(true);
      try {
        // Resolve legacy creator canonical id (doc by uid or ownerUserId)
        let creatorId = user.uid;
        try {
          const direct = await getDoc(doc(db, 'legacy_creators', user.uid));
          if (!direct.exists()) {
            const byOwnerQ = query(collection(db, 'legacy_creators'), orderBy('createdAt', 'desc'));
            // We don't have where on client here without importing; prefer try direct then fallback via server list endpoint
          }
        } catch {}
        // If the direct doc does not exist, fetch via server endpoint which resolves slug/owner mapping
        let canonicalId = creatorId;
        try {
          const res = await fetch(`/api/legacy/creators/${encodeURIComponent(user.uid)}?soft=1`, { cache: 'no-store' });
          const json = await res.json().catch(() => ({}));
          const creator = json?.creator;
          canonicalId = creator?.id || creator?.kitSlug || user.uid;
        } catch {}
        // Query the subcollection for videos
        const vref = collection(db, `legacy_creators/${canonicalId}/videos`);
        const q = query(vref, orderBy('createdAt', 'desc'));
        const snap = await getDocs(q);
        const list = snap.docs.map((d) => {
          const data = d.data() as any;
          return {
            id: d.id,
            title: data?.title || 'Untitled',
            description: data?.description || '',
            muxPlaybackId: data?.muxPlaybackId || null,
            muxAnimatedGifUrl: data?.muxAnimatedGifUrl || null,
            isSample: Boolean(data?.isSample),
            createdAt: data?.createdAt || null,
          };
        });
        setMyVideos(list);
      } catch {
        setMyVideos([]);
      } finally {
        setVideosLoading(false);
      }
    };
    loadVideos();
  }, [user, firebaseReady, db]);

  const postOpportunity = async () => {
    if (!user) { alert('Sign in first.'); return; }
    if (!oppTitle || !oppLocation || !oppType || !oppApplyUrl) { alert('Please fill in all required fields'); return; }
    setOppSaving(true);
    try {
      const idToken = await user.getIdToken();
      const res = await fetch('/api/legacy/creators/opportunities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
        body: JSON.stringify({
          title: oppTitle.trim(),
          location: oppLocation.trim(),
          type: oppType.trim(),
          applyUrl: oppApplyUrl.trim(),
          description: oppDescription.trim()
        })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Failed to post opportunity');
      // Refresh list
      try {
        const r = await fetch(`/api/legacy/creators/${encodeURIComponent(user.uid)}/opportunities`, { cache: 'no-store' });
        const j = await r.json();
        setMyOpps(Array.isArray(j?.opportunities) ? j.opportunities : []);
      } catch {}
      setOppTitle(''); setOppLocation(''); setOppType('Freelance'); setOppApplyUrl(''); setOppDescription('');
      alert('Opportunity posted!');
    } catch (e: any) {
      alert(e?.message || 'Failed to post opportunity');
    } finally {
      setOppSaving(false);
    }
  };
  // Load payouts/connect status
  useEffect(() => {
    const loadConnect = async () => {
      if (!firebaseReady || !db || !user) return;
      try {
        const uref = doc(db, 'users', user.uid);
        const snap = await getDoc(uref);
        const data = snap.data() as any;
        if (data?.connectAccountId) {
          setConnectAccountId(data.connectAccountId);
          try {
            const res = await fetch(`/api/stripe/connect/status?accountId=${data.connectAccountId}`);
            const json = await res.json();
            setConnectStatus(json);
          } catch {}
        }
      } catch {}
    };
    loadConnect();
  }, [user]);

  const startOnboarding = async () => {
    if (!user) { alert('Sign in first.'); return; }
    setPayoutsLoading(true);
    try {
      const res = await fetch('/api/stripe/connect/onboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId: connectAccountId || undefined })
      });
      const json = await res.json();
      if (json.accountId && firebaseReady && db) {
        await fetch('/api/creator/save-connect', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accountId: json.accountId }) }).catch(()=>{});
        setConnectAccountId(json.accountId);
      }
      if (json.url) window.location.href = json.url;
    } catch (e: any) {
      alert(e?.message || 'Failed to start onboarding');
    } finally {
      setPayoutsLoading(false);
    }
  };

  const refreshStatus = async () => {
    if (!connectAccountId) return;
    setPayoutsLoading(true);
    try {
      const res = await fetch(`/api/stripe/connect/status?accountId=${connectAccountId}`);
      const json = await res.json();
      setConnectStatus(json);
    } catch {}
    setPayoutsLoading(false);
  };
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

  const createUploadAndSend = async () => {
    if (!user) { alert('Sign in first.'); return; }
    if (!uploadFile) { alert('Choose a video file first.'); return; }
    if (!firebaseReady || !storage) {
      setUploadStatus('Storage not available. Please refresh the page.');
      return;
    }
    
    try {
      setUploading(true);
      setUploadStatus('Uploading to storage...');
      
      // Upload directly to Firebase Storage first (more reliable than TUS proxy)
      const path = `legacy-uploads/${user.uid}/${Date.now()}_${uploadFile.name.replace(/\s+/g,'_')}`;
      const sref = storageRef(storage, path);
      const task = uploadBytesResumable(sref, uploadFile, { contentType: uploadFile.type || 'video/mp4' });
      
      await new Promise<void>((resolve, reject) => {
        task.on('state_changed', 
          (snap) => {
            const p = (snap.bytesTransferred / snap.totalBytes) * 100;
            setUploadProgress(p);
            setUploadStatus(`Uploading to storage... ${Math.round(p)}%`);
          }, 
          reject, 
          resolve
        );
      });
      
      const downloadURL = await getDownloadURL(task.snapshot.ref);
      setUploadStatus('Ingesting to Mux...');
      
      // Now ingest into Mux via server-side API
      const res = await fetch('/api/legacy/upload-from-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creatorId: user.uid,
          title: uploadTitle || 'Untitled Video',
          description: uploadDescription,
          isSample: uploadIsSample,
          fileUrl: downloadURL,
        })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Mux ingest failed');
      
      setUploadStatus('Upload complete! Mux is processing your video...');
      setUploadFile(null);
      setUploadTitle('');
      setUploadDescription('');
    } catch (e: any) {
      const msg = String(e?.message || e || 'Upload failed');
      setUploadStatus(msg);
      console.error('Upload error:', e);
    } finally {
      setUploading(false);
    }
    
  };

  return (
    <main className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-4">Edit Legacy Creator Profile</h1>
      {/* Tabs */}
      <div className="mb-6 flex flex-wrap gap-2">
        {(['profile','upload','assets','gear','payouts','opportunities'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-3 py-1.5 text-sm rounded border ${activeTab===tab ? 'bg-neutral-800 border-neutral-700 text-white' : 'bg-neutral-900 border-neutral-800 text-neutral-300 hover:text-white'}`}
          >
            {tab.charAt(0).toUpperCase()+tab.slice(1)}
          </button>
        ))}
      </div>
      {!user && <p className="text-neutral-400">Please sign in to edit your profile.</p>}
      {user && isLegacyCreator === false && !hasCreatorMapping && (
        <div className="border border-neutral-800 p-4 bg-neutral-950">
          <p className="text-neutral-300">Your account is not enabled as a Legacy Creator yet.</p>
          <p className="text-neutral-400 text-sm mt-2">Contact support to request Legacy Creator access.</p>
        </div>
      )}
      {user && (isLegacyCreator === true || isLegacyCreator === null || hasCreatorMapping) && (
        <div className="space-y-8">
          {activeTab === 'upload' && (
          <section className="border border-neutral-800 p-4 bg-neutral-950">
            <h2 className="text-xl font-semibold mb-4">Upload Video</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="text-sm text-neutral-400">If an upload finished in Mux but didn’t appear yet, backfill from Mux.</div>
                <button
                  onClick={async () => {
                    if (!user) return;
                    try {
                      const idt = await user.getIdToken();
                      const res = await fetch('/api/legacy/backfill/videos', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idt}` },
                        body: JSON.stringify({ creatorId: user.uid })
                      });
                      const json = await res.json();
                      alert(res.ok ? `Backfill complete. Added ${json.added || 0} video(s).` : (json.error || 'Backfill failed'));
                    } catch (e: any) {
                      alert(e?.message || 'Backfill failed');
                    }
                  }}
                  className="px-3 py-2 bg-neutral-900 border border-neutral-800 text-white hover:bg-neutral-800 text-sm"
                >
                  Backfill from Mux
                </button>
              </div>
              <div className="rounded border border-neutral-800 p-3 bg-neutral-900/40 text-sm text-neutral-300">
                <div className="font-medium text-white mb-1">Where will my video appear?</div>
                <ul className="list-disc pl-5 space-y-1">
                  <li><span className="font-medium">Sample (public):</span> shown as “Featured Video” if none exists yet and under “Playlists” on your public Legacy Kit.</li>
                  <li><span className="font-medium">Exclusive (Legacy+):</span> appears under “Exclusive Content” and is visible only to Legacy+ or CCA members.</li>
                </ul>
              </div>
              <div>
                <label className="block text-sm mb-1 text-neutral-300">Title</label>
                <input value={uploadTitle} onChange={(e)=>setUploadTitle(e.target.value)} className="w-full bg-neutral-900 border border-neutral-800 px-3 py-2" placeholder="Sample Video" />
              </div>
              <div>
                <label className="block text-sm mb-1 text-neutral-300">Description</label>
                <textarea value={uploadDescription} onChange={(e)=>setUploadDescription(e.target.value)} className="w-full bg-neutral-900 border border-neutral-800 px-3 py-2" rows={3} placeholder="Short description" />
              </div>
              <div className="flex items-center gap-2">
                <input id="uploadIsSample" type="checkbox" checked={uploadIsSample} onChange={(e)=>setUploadIsSample(e.target.checked)} />
                <label htmlFor="uploadIsSample" className="text-sm text-neutral-300">Mark as sample (visible to everyone)</label>
              </div>
              <div>
                <label className="block text-sm mb-1 text-neutral-300">Video File</label>
                <input type="file" accept="video/*" onChange={(e)=>setUploadFile(e.target.files?.[0] || null)} />
              </div>
              <div className="flex items-center gap-3">
                <button onClick={createUploadAndSend} disabled={!user || uploading || !uploadFile} className="px-4 py-2 bg-white text-black border-2 border-ccaBlue disabled:opacity-50">{uploading ? 'Uploading...' : 'Create Upload & Send'}</button>
                {uploadStatus && <span className="text-sm text-neutral-300">{uploadStatus}</span>}
              </div>
              {uploadProgress > 0 && uploadProgress < 100 && (
                <div className="mt-2 h-2 bg-neutral-900"><div className="h-full bg-ccaBlue" style={{width: `${Math.round(uploadProgress)}%`}} /></div>
              )}
              <p className="text-xs text-neutral-500">After processing completes, your video will appear on your legacy kit automatically.</p>
            </div>
            <div className="mt-6 pt-6 border-t border-neutral-800 space-y-3">
              <div className="font-semibold text-white">Attach existing Mux Asset</div>
              <p className="text-sm text-neutral-400">If you uploaded directly in the Mux dashboard and see “No public playback ID”, paste the Asset ID here to attach it and create a playback ID.</p>
              <AttachExistingMuxForm />
            </div>
            <div className="mt-8 pt-6 border-t border-neutral-800">
              <h3 className="text-lg font-semibold mb-3">My Uploads</h3>
              {videosLoading ? (
                <div className="text-sm text-neutral-400">Loading uploads…</div>
              ) : myVideos.length === 0 ? (
                <div className="text-sm text-neutral-400">No uploads yet.</div>
              ) : (
                <ul className="grid md:grid-cols-2 gap-3">
                  {myVideos.map((v) => {
                    const thumb = v.muxAnimatedGifUrl || (v.muxPlaybackId ? `https://image.mux.com/${v.muxPlaybackId}/thumbnail.jpg?time=1&width=480` : '');
                    return (
                      <li key={v.id} className="border border-neutral-800 bg-neutral-900 p-2">
                        {thumb ? (
                          <img src={thumb} alt={v.title || 'Video thumbnail'} className="w-full h-40 object-cover border border-neutral-800" />
                        ) : (
                          <div className="w-full h-40 bg-neutral-800 flex items-center justify-center text-neutral-400 text-sm">No preview</div>
                        )}
                        <div className="mt-2">
                          <div className="font-medium text-neutral-200 truncate" title={v.title}>{v.title}</div>
                          <div className="text-xs text-neutral-500">{v.isSample ? 'Sample (public)' : 'Exclusive (Legacy+)'}</div>
                        </div>
                        <div className="mt-2 flex items-center gap-2">
                          {v.muxPlaybackId && (
                            <a href={`https://stream.mux.com/${v.muxPlaybackId}.m3u8`} target="_blank" className="text-sm text-ccaBlue">View ↗</a>
                          )}
                          <button
                            onClick={async () => {
                              if (!user) return;
                              if (!confirm('Delete this video? This will remove it from your legacy kit.')) return;
                              try {
                                const idt = await user.getIdToken();
                                const res = await fetch(`/api/legacy/videos/${encodeURIComponent(v.id)}?deleteMux=1`, {
                                  method: 'DELETE',
                                  headers: { 'Authorization': `Bearer ${idt}` }
                                });
                                const json = await res.json().catch(() => ({}));
                                if (!res.ok) throw new Error(json?.error || 'Delete failed');
                                setMyVideos((prev) => prev.filter((x) => x.id !== v.id));
                              } catch (e: any) {
                                alert(e?.message || 'Failed to delete');
                              }
                            }}
                            className="ml-auto px-3 py-1.5 bg-neutral-950 border border-neutral-800 text-neutral-300 hover:bg-neutral-800 text-sm"
                          >
                            Delete
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </section>
          )}
          {activeTab === 'profile' && (
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
              <label className="block text-sm mb-1 text-neutral-300">Avatar</label>
              {avatarUrl && (
                <div className="mb-2">
                  <img src={avatarUrl} alt="Avatar" className="w-24 h-24 object-cover border border-neutral-800" />
                </div>
              )}
              <input type="file" accept="image/*" onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file || !user || !firebaseReady || !storage) return;
                const reader = new FileReader();
                reader.onload = () => {
                  setCropSrc(reader.result as string);
                  setCropAspect(1);
                  setPendingPath(`legacy-creators/${user.uid}/avatar_${Date.now()}_${file.name.replace(/\s+/g,'_')}`);
                };
                reader.readAsDataURL(file);
              }} className="block w-full text-sm text-neutral-300 file:mr-3 file:px-3 file:py-2 file:border file:border-neutral-800 file:bg-neutral-900 file:text-neutral-300 hover:file:bg-neutral-800" />
              {avatarUploading && (
                <div className="mt-2 h-2 bg-neutral-900"><div className="h-full bg-ccaBlue" style={{width: `${Math.round(avatarProgress)}%`}} /></div>
              )}
            </div>
            <div>
              <label className="block text-sm mb-1 text-neutral-300">Banner</label>
              {bannerUrl && (
                <div className="mb-2">
                  <img src={bannerUrl} alt="Banner" className="w-full max-w-md h-24 object-cover border border-neutral-800" />
                </div>
              )}
              <input type="file" accept="image/*" onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file || !user || !firebaseReady || !storage) return;
                const reader = new FileReader();
                reader.onload = () => {
                  setCropSrc(reader.result as string);
                  setCropAspect(16/9);
                  setPendingPath(`legacy-creators/${user.uid}/banner_${Date.now()}_${file.name.replace(/\s+/g,'_')}`);
                };
                reader.readAsDataURL(file);
              }} className="block w-full text-sm text-neutral-300 file:mr-3 file:px-3 file:py-2 file:border file:border-neutral-800 file:bg-neutral-900 file:text-neutral-300 hover:file:bg-neutral-800" />
              {bannerUploading && (
                <div className="mt-2 h-2 bg-neutral-900"><div className="h-full bg-ccaBlue" style={{width: `${Math.round(bannerProgress)}%`}} /></div>
              )}
            </div>
      {cropSrc && storage && (
        <ImageCropperModal
          imageSrc={cropSrc}
          aspect={cropAspect}
          onCancel={() => setCropSrc(null)}
          onCropped={(blob) => {
            if (!user || !firebaseReady || !storage || !pendingPath) { setCropSrc(null); return; }
            const sref = storageRef(storage, pendingPath);
            const isAvatar = pendingPath.includes('/avatar_');
            if (isAvatar) { setAvatarUploading(true); setAvatarProgress(0); } else { setBannerUploading(true); setBannerProgress(0); }
            const task = uploadBytesResumable(sref, blob, { contentType: 'image/jpeg' });
            task.on('state_changed', (snap) => {
              const p = (snap.bytesTransferred / snap.totalBytes) * 100;
              if (isAvatar) setAvatarProgress(p); else setBannerProgress(p);
            }, (err) => {
              console.error('Image upload error', err);
              if (isAvatar) setAvatarUploading(false); else setBannerUploading(false);
            }, async () => {
              const url = await getDownloadURL(task.snapshot.ref);
              if (isAvatar) setAvatarUrl(url); else setBannerUrl(url);
              if (isAvatar) setAvatarUploading(false); else setBannerUploading(false);
              setCropSrc(null);
            });
          }}
        />
      )}
          </div>
          </section>
          )}

          {activeTab === 'opportunities' && (
          <section className="border border-neutral-800 p-4 bg-neutral-950">
            <h2 className="text-xl font-semibold mb-4">Opportunities</h2>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm mb-1 text-neutral-300">Title</label>
                <input value={oppTitle} onChange={(e)=>setOppTitle(e.target.value)} className="w-full bg-neutral-900 border border-neutral-800 px-3 py-2" placeholder="Video Editor for Product Launch" />
              </div>
              <div>
                <label className="block text-sm mb-1 text-neutral-300">Location</label>
                <input value={oppLocation} onChange={(e)=>setOppLocation(e.target.value)} className="w-full bg-neutral-900 border border-neutral-800 px-3 py-2" placeholder="Remote / Los Angeles, CA" />
              </div>
              <div>
                <label className="block text-sm mb-1 text-neutral-300">Type</label>
                <input value={oppType} onChange={(e)=>setOppType(e.target.value)} className="w-full bg-neutral-900 border border-neutral-800 px-3 py-2" placeholder="Freelance" />
              </div>
              <div>
                <label className="block text-sm mb-1 text-neutral-300">Apply URL</label>
                <input value={oppApplyUrl} onChange={(e)=>setOppApplyUrl(e.target.value)} className="w-full bg-neutral-900 border border-neutral-800 px-3 py-2" placeholder="https://company.com/apply" />
              </div>
            </div>
            <div className="mt-3">
              <label className="block text-sm mb-1 text-neutral-300">Description (optional)</label>
              <textarea value={oppDescription} onChange={(e)=>setOppDescription(e.target.value)} className="w-full bg-neutral-900 border border-neutral-800 px-3 py-2" rows={3} placeholder="Short description" />
            </div>
            <div className="mt-3">
              <button onClick={postOpportunity} disabled={oppSaving} className="px-4 py-2 bg-white text-black border-2 border-ccaBlue disabled:opacity-50">{oppSaving ? 'Posting...' : 'Post Opportunity'}</button>
            </div>
            <div className="mt-6">
              <h3 className="text-lg font-semibold mb-2">My Opportunities</h3>
              {myOpps.length === 0 ? (
                <div className="text-neutral-400 text-sm">No opportunities posted yet.</div>
              ) : (
                <div className="space-y-2">
                  {myOpps.map((o) => (
                    <div key={o.id} className="border border-neutral-800 p-3 bg-neutral-900">
                      <div className="font-medium">{o.title}</div>
                      <div className="text-sm text-neutral-400">{o.location} • {o.type}</div>
                      {o.posted && <div className="text-xs text-neutral-500">Posted {new Date(o.posted).toLocaleDateString?.() || ''}</div>}
                      {o.applyUrl && <a href={o.applyUrl} target="_blank" className="text-ccaBlue text-sm">Apply URL ↗</a>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
          )}

          {activeTab === 'profile' && (
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
          )}

          {activeTab === 'assets' && (
          <section className="border border-neutral-800 p-4 bg-neutral-950">
            <h2 className="text-xl font-semibold mb-4">Assets</h2>
            <h3 className="text-sm text-neutral-400 mb-2">Overlays & Transitions</h3>
            <ListEditor items={assetsOverlays} onChange={setAssetsOverlays} labels={{title:'Title', tag:'Tag', image:'Image URL'}} />
            <h3 className="text-sm text-neutral-400 mt-6 mb-2">Sound Effects</h3>
            <ListEditor items={assetsSfx} onChange={setAssetsSfx} labels={{title:'Title', tag:'Tag', image:'Image URL'}} />
          </section>
          )}

          {activeTab === 'gear' && (
          <section className="border border-neutral-800 p-4 bg-neutral-950">
            <h2 className="text-xl font-semibold mb-4">Gear</h2>
            <GearEditor items={gear} onChange={setGear} />
          </section>
          )}

          {activeTab === 'payouts' && (
          <section className="border border-neutral-800 p-4 bg-neutral-950">
            <h2 className="text-xl font-semibold mb-4">Payouts</h2>
            <p className="text-neutral-300 mb-3">Connect your Stripe account to receive marketplace sales and Legacy+ subscription payouts.</p>
            <div className="space-y-3">
              <div className="text-sm text-neutral-400">
                Status: {connectAccountId ? 'Connected' : 'Not connected'}
                {connectStatus?.charges_enabled === false && connectAccountId ? ' (action required)' : ''}
              </div>
              <div className="flex items-center gap-2">
                <button onClick={startOnboarding} disabled={payoutsLoading} className="px-4 py-2 bg-white text-black border-2 border-ccaBlue disabled:opacity-50">
                  {connectAccountId ? 'Update in Stripe' : 'Connect with Stripe'}
                </button>
                {connectAccountId && (
                  <button onClick={refreshStatus} disabled={payoutsLoading} className="px-4 py-2 bg-neutral-900 border border-neutral-800 text-white hover:bg-neutral-800">
                    Refresh Status
                  </button>
                )}
              </div>
              {connectStatus && (
                <pre className="text-xs text-neutral-400 bg-neutral-900 border border-neutral-800 p-3 overflow-x-auto">{JSON.stringify({
                  charges_enabled: connectStatus?.charges_enabled,
                  payouts_enabled: connectStatus?.payouts_enabled,
                  details_submitted: connectStatus?.details_submitted
                }, null, 2)}</pre>
              )}
            </div>
          </section>
          )}

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

function AttachExistingMuxForm() {
  const { user } = useAuth();
  const [assetId, setAssetId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isSample, setIsSample] = useState(true);
  const [saving, setSaving] = useState(false);
  const onAttach = async () => {
    if (!user) { alert('Sign in first.'); return; }
    if (!assetId) { alert('Enter an Asset ID.'); return; }
    setSaving(true);
    try {
      const idt = await user.getIdToken();
      const res = await fetch('/api/legacy/videos/attach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idt}` },
        body: JSON.stringify({
          creatorId: user.uid,
          assetId: assetId.trim(),
          isSample,
          title,
          description,
        })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Attach failed');
      alert('Attached! Your video will appear on your kit shortly.');
      setAssetId(''); setTitle(''); setDescription('');
    } catch (e: any) {
      alert(e?.message || 'Attach failed');
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="grid md:grid-cols-2 gap-3">
      <div>
        <label className="block text-sm mb-1 text-neutral-300">Mux Asset ID</label>
        <input value={assetId} onChange={(e)=>setAssetId(e.target.value)} className="w-full bg-neutral-900 border border-neutral-800 px-3 py-2" placeholder="hEnlaO..." />
      </div>
      <div className="flex items-center gap-2">
        <input id="attachIsSample" type="checkbox" checked={isSample} onChange={(e)=>setIsSample(e.target.checked)} />
        <label htmlFor="attachIsSample" className="text-sm text-neutral-300">Mark as sample (public playback)</label>
      </div>
      <div>
        <label className="block text-sm mb-1 text-neutral-300">Title (optional)</label>
        <input value={title} onChange={(e)=>setTitle(e.target.value)} className="w-full bg-neutral-900 border border-neutral-800 px-3 py-2" />
      </div>
      <div>
        <label className="block text-sm mb-1 text-neutral-300">Description (optional)</label>
        <input value={description} onChange={(e)=>setDescription(e.target.value)} className="w-full bg-neutral-900 border border-neutral-800 px-3 py-2" />
      </div>
      <div className="md:col-span-2">
        <button onClick={onAttach} disabled={saving} className="px-4 py-2 bg-white text-black border-2 border-ccaBlue disabled:opacity-50">{saving ? 'Attaching...' : 'Attach Asset'}</button>
      </div>
    </div>
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


