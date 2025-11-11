"use client";
import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { db, firebaseReady } from '@/lib/firebaseClient';
import { doc, getDoc } from 'firebase/firestore';
import { ProtectedRoute } from '@/components/ProtectedRoute';

export default function AdminImportPage() {
  return (
    <ProtectedRoute>
      <Importer />
    </ProtectedRoute>
  );
}

function Importer() {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dryRun, setDryRun] = useState(true);
  const [logs, setLogs] = useState<string[]>([]);
  const [running, setRunning] = useState(false);

  async function checkAdmin() {
    if (!user || !firebaseReady || !db) { setIsAdmin(false); return; }
    try {
      const snap = await getDoc(doc(db, 'users', user.uid));
      const data = snap.data() as any;
      const admin = Boolean(data?.roles?.admin || data?.isAdmin);
      setIsAdmin(admin);
    } catch {
      setIsAdmin(false);
    }
  }

  if (isAdmin === null) {
    checkAdmin();
    return (
      <main className="max-w-3xl mx-auto px-4 py-8">
        <div className="text-neutral-400">Verifying admin access...</div>
      </main>
    );
  }

  if (!isAdmin) {
    return (
      <main className="max-w-3xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-white mb-2">Admin Importer</h1>
        <p className="text-neutral-400">You do not have access to this page.</p>
      </main>
    );
  }

  const runImport = async () => {
    if (!file) { alert('Choose a CSV file first'); return; }
    setRunning(true);
    setLogs((l) => [...l, `Starting ${dryRun ? 'dry-run' : 'import'}...`]);
    try {
      const form = new FormData();
      form.append('mode', dryRun ? 'dry_run' : 'commit');
      form.append('file', file);
      const res = await fetch('/api/admin/import', {
        method: 'POST',
        body: form,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Import failed');
      setLogs((l) => [...l, JSON.stringify(json, null, 2)]);
    } catch (e: any) {
      setLogs((l) => [...l, String(e?.message || e || 'Failed')]);
    } finally {
      setRunning(false);
    }
  };

  return (
    <main className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-white mb-4">Admin CSV Importer</h1>
      <div className="space-y-4 bg-neutral-950 border border-neutral-800 p-4">
        <div>
          <label className="block text-sm mb-1 text-neutral-300">CSV File</label>
          <input type="file" accept=".csv,text/csv" onChange={(e) => setFile(e.target.files?.[0] || null)} />
        </div>
        <div className="flex items-center gap-2">
          <input id="dryrun" type="checkbox" checked={dryRun} onChange={(e) => setDryRun(e.target.checked)} />
          <label htmlFor="dryrun" className="text-sm text-neutral-300">Dry run (no writes)</label>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={runImport} disabled={!file || running} className="px-4 py-2 bg-white text-black border-2 border-ccaBlue disabled:opacity-50">
            {running ? 'Running...' : (dryRun ? 'Preview Import' : 'Run Import')}
          </button>
          <a href="https://example.com" onClick={(e)=>e.preventDefault()} className="text-sm text-neutral-400">CSV format documented in /docs</a>
        </div>
        <div className="mt-4 text-sm text-neutral-300 whitespace-pre-wrap">
          {logs.map((l, i) => (<div key={i} className="mb-2">{l}</div>))}
        </div>
      </div>
    </main>
  );
}


