"use client";
import { useEffect, useState } from 'react';
import { collection, onSnapshot, orderBy, query, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth, firebaseReady } from '@/lib/firebaseClient';

type Job = { id: string; title: string; company: string; location: string; type: string; posted?: any };

export default function OpportunitiesPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [title, setTitle] = useState('');
  const [company, setCompany] = useState('');
  const [location, setLocation] = useState('');
  const [type, setType] = useState('Full Time');

  useEffect(() => {
    if (!firebaseReady || !db) return;
    const q = query(collection(db, 'opportunities'), orderBy('posted', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setJobs(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Job[]);
    });
    return () => unsub();
  }, []);

  const addJob = async () => {
    if (!auth.currentUser) {
      alert('Please sign in to post an opportunity.');
      return;
    }
    if (!title || !company) return;
    if (!firebaseReady || !db) {
      alert('Firebase is not configured. Add your NEXT_PUBLIC_FIREBASE_* keys.');
      return;
    }
    await addDoc(collection(db, 'opportunities'), {
      title,
      company,
      location,
      type,
      posted: serverTimestamp(),
      posterId: auth.currentUser.uid
    });
    setTitle(''); setCompany(''); setLocation(''); setType('Full Time');
  };

  return (
    <main className="max-w-7xl mx-auto px-6 py-8">
      <h1 className="text-3xl md:text-4xl font-bold">Find Your Next Creative Opportunity</h1>
      {!firebaseReady && (
        <div className="mt-4 p-4 rounded-lg border border-yellow-500/30 bg-yellow-500/10 text-yellow-300 text-sm">
          Firebase is not configured. Add your client keys in `.env.local` (see docs/ENV-EXAMPLE.txt), then restart the dev server.
        </div>
      )}
      <div className="mt-6 flex flex-wrap gap-3">
        <input className="flex-1 min-w-[240px] bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2" placeholder="Search jobs..." />
        <button className="px-4 py-2 rounded-lg bg-neutral-900 border border-neutral-800">Filters</button>
        <button className="px-4 py-2 rounded-lg bg-ccaBlue" onClick={addJob}>Post on Opportunity</button>
      </div>

      <div className="mt-6 p-4 rounded-xl border border-neutral-800 bg-neutral-950">
        <div className="text-sm text-neutral-300 mb-2">Post Opportunity (dev)</div>
        <div className="grid md:grid-cols-5 gap-3">
          <input value={title} onChange={(e)=>setTitle(e.target.value)} placeholder="Title" className="bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2" />
          <input value={company} onChange={(e)=>setCompany(e.target.value)} placeholder="Company" className="bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2" />
          <input value={location} onChange={(e)=>setLocation(e.target.value)} placeholder="Location" className="bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2" />
          <select value={type} onChange={(e)=>setType(e.target.value)} className="bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2">
            {['Full Time','Part Time','Contract','Freelance','Internship'].map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <button className="cta-button" onClick={addJob}>Add</button>
        </div>
      </div>

      <div className="mt-6 grid gap-4">
        {jobs.map((j) => (
          <div key={j.id} className="rounded-xl border border-neutral-800 bg-neutral-950 p-4 flex items-start justify-between">
            <div>
              <div className="font-semibold text-lg">{j.title}</div>
              <div className="text-sm text-neutral-400">{j.company} • {j.location}</div>
              <div className="text-xs text-neutral-500 mt-1">{j.type}</div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs px-2 py-1 rounded-full bg-neutral-900 border border-neutral-800">{j.type}</span>
              <button className="px-4 py-2 rounded-lg bg-ccaBlue">Apply Now</button>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}


