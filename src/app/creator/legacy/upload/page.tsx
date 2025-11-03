"use client";
import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { db, firebaseReady } from '@/lib/firebaseClient';
import { doc, getDoc } from 'firebase/firestore';

export default function LegacyUploadPage() {
  const { user } = useAuth();
  const [isLegacyCreator, setIsLegacyCreator] = useState<boolean | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isSample, setIsSample] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<string>("");
  const [uploading, setUploading] = useState(false);

  // Gate by legacy flag
  useEffect(() => {
    const check = async () => {
      if (!user || !firebaseReady || !db) { setIsLegacyCreator(null); return; }
      const uref = await getDoc(doc(db, 'users', user.uid));
      const udata = uref.exists() ? (uref.data() as any) : {};
      setIsLegacyCreator(Boolean(udata.isLegacyCreator || udata.roles?.legacyCreator));
    };
    check();
  }, [user]);

  const handleCreateUploadAndSend = async () => {
    if (!user) { alert('Sign in first.'); return; }
    if (!file) { alert('Choose a video file first.'); return; }
    try {
      setUploading(true);
      setStatus('Requesting upload URL...');

      // creatorId can be the legacy doc id or owner uid; server resolves owner mapping
      const res = await fetch('/api/legacy/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ creatorId: user.uid, title, description, isSample })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Failed to create upload');

      const uploadUrl: string = json.uploadUrl;
      if (!uploadUrl) throw new Error('Upload URL missing');

      setStatus('Uploading to Mux...');
      // Lazy-load tus client in the browser
      const tus = await import('tus-js-client');
      await new Promise<void>((resolve, reject) => {
        const uploader = new tus.Upload(file, {
          endpoint: uploadUrl, // Mux direct upload URL
          retryDelays: [0, 1000, 3000, 5000],
          metadata: {
            filename: file.name,
            filetype: file.type || 'video/mp4',
          },
          uploadSize: file.size,
          onError(err: unknown) { reject(err as any); },
          onSuccess() { resolve(); },
        } as any);
        uploader.start();
      });

      setStatus('Upload complete! Mux is processing your video...');
    } catch (e: any) {
      setStatus(e?.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <main className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-4">Legacy Creator Upload</h1>
      {user && isLegacyCreator === false && (
        <div className="text-neutral-300 mb-6">Your account is not enabled as a Legacy Creator. Contact support to request access.</div>
      )}
      {!user && (
        <div className="text-neutral-400 mb-6">Please sign in to upload.</div>
      )}
      <div className="space-y-4 border border-neutral-800 p-4 bg-neutral-950 rounded">
        <div>
          <label className="block text-sm mb-1 text-neutral-300">Title</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full bg-neutral-900 border border-neutral-800 px-3 py-2" placeholder="Sample Video" />
        </div>
        <div>
          <label className="block text-sm mb-1 text-neutral-300">Description</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="w-full bg-neutral-900 border border-neutral-800 px-3 py-2" rows={3} placeholder="Short description" />
        </div>
        <div className="flex items-center gap-2">
          <input id="isSample" type="checkbox" checked={isSample} onChange={(e) => setIsSample(e.target.checked)} />
          <label htmlFor="isSample" className="text-sm text-neutral-300">Mark as sample (visible to everyone)</label>
        </div>
        <div>
          <label className="block text-sm mb-1 text-neutral-300">Video File</label>
          <input type="file" accept="video/*" onChange={(e) => setFile(e.target.files?.[0] || null)} />
        </div>
        <div className="flex items-center gap-3">
          <button onClick={handleCreateUploadAndSend} disabled={!user || isLegacyCreator === false || uploading || !file} className="px-4 py-2 bg-white text-black border-2 border-ccaBlue disabled:opacity-50">{uploading ? 'Uploading...' : 'Create Upload & Send'}</button>
          {status && <span className="text-sm text-neutral-300">{status}</span>}
        </div>
      </div>
      <p className="text-xs text-neutral-500 mt-3">After processing completes, your video will appear on your legacy kit automatically.</p>
    </main>
  );
}


