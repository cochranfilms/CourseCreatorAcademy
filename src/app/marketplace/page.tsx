"use client";
import { useEffect, useState } from 'react';
import { collection, onSnapshot, orderBy, query, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth, firebaseReady } from '@/lib/firebaseClient';

type Listing = { id: string; title: string; price: number; condition: string; createdAt?: any; };

export default function MarketplacePage() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [title, setTitle] = useState('');
  const [price, setPrice] = useState('');
  const [condition, setCondition] = useState('Excellent');

  useEffect(() => {
    if (!firebaseReady || !db) return;
    const q = query(collection(db, 'listings'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setListings(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Listing[]);
    });
    return () => unsub();
  }, []);

  const addListing = async () => {
    if (!auth.currentUser) {
      alert('Please sign in to create a listing.');
      return;
    }
    const n = Number(price);
    if (!title || isNaN(n)) return;
    if (!firebaseReady || !db) {
      alert('Firebase is not configured. Add your NEXT_PUBLIC_FIREBASE_* keys.');
      return;
    }
    await addDoc(collection(db, 'listings'), {
      title,
      price: n,
      condition,
      creatorId: auth.currentUser.uid,
      createdAt: serverTimestamp()
    });
    setTitle(''); setPrice(''); setCondition('Excellent');
  };

  return (
    <main className="max-w-7xl mx-auto px-6 py-8">
      <h1 className="text-3xl md:text-4xl font-bold">Marketplace</h1>
      {!firebaseReady && (
        <div className="mt-4 p-4 rounded-lg border border-yellow-500/30 bg-yellow-500/10 text-yellow-300 text-sm">
          Firebase is not configured. Add your client keys in `.env.local` (see docs/ENV-EXAMPLE.txt), then restart the dev server.
        </div>
      )}
      <div className="mt-6 flex flex-wrap gap-3 items-center">
        <input className="flex-1 min-w-[260px] bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2" placeholder="Search for gear, equipment..." />
        <button className="px-4 py-2 rounded-lg bg-neutral-900 border border-neutral-800">All Locations</button>
        <button className="px-4 py-2 rounded-lg bg-neutral-900 border border-neutral-800">Filters</button>
        <button className="px-4 py-2 rounded-lg bg-ccaBlue">My Listings</button>
        <button className="px-4 py-2 rounded-lg bg-neutral-900 border border-neutral-800" onClick={addListing}>Sell Item</button>
      </div>

      <div className="mt-6 p-4 rounded-xl border border-neutral-800 bg-neutral-950">
        <div className="text-sm text-neutral-300 mb-2">Create Listing (dev)</div>
        <div className="grid md:grid-cols-4 gap-3">
          <input value={title} onChange={(e)=>setTitle(e.target.value)} placeholder="Title" className="bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2" />
          <input value={price} onChange={(e)=>setPrice(e.target.value)} placeholder="Price" className="bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2" />
          <select value={condition} onChange={(e)=>setCondition(e.target.value)} className="bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2">
            {['Excellent','Good','Like New'].map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <button className="cta-button" onClick={addListing}>Add Listing</button>
        </div>
      </div>

      <div className="mt-6 grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {listings.map((l) => (
          <div key={l.id} className="rounded-2xl overflow-hidden border border-neutral-800 bg-neutral-950">
            <div className="h-44 bg-neutral-800" />
            <div className="p-4">
              <div className="font-semibold">{l.title}</div>
              <div className="text-sm text-neutral-400">{l.condition}</div>
              <div className="mt-2 text-ccaBlue font-bold">${'{'}l.price{'}'}</div>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}


