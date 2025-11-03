"use client";
import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@/contexts/AuthContext';
import { db, firebaseReady } from '@/lib/firebaseClient';
import { collection, getDocs, query, where, doc, getDoc } from 'firebase/firestore';

type Creator = {
  id: string;
  displayName: string;
  handle?: string;
  bannerUrl?: string | null;
  kitSlug?: string;
};

export function CreatorKitsRail() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [creators, setCreators] = useState<Creator[]>([]);

  useEffect(() => {
    const load = async () => {
      if (!firebaseReady || !db || !user) { setCreators([]); setLoading(false); return; }
      try {
        // Read user's active legacy subscriptions
        const subsQ = query(collection(db, 'legacySubscriptions'), where('userId', '==', user.uid), where('status', 'in', ['active', 'trialing']));
        const subsSnap = await getDocs(subsQ);
        const creatorIds = Array.from(new Set(subsSnap.docs.map(d => (d.data() as any).creatorId).filter(Boolean)));
        const results: Creator[] = [];
        for (const id of creatorIds) {
          const cDoc = await getDoc(doc(db, 'legacy_creators', String(id)));
          if (cDoc.exists()) {
            const data = cDoc.data() as any;
            results.push({
              id: cDoc.id,
              displayName: data.displayName || data.handle || 'Creator',
              handle: data.handle,
              bannerUrl: data.bannerUrl || null,
              kitSlug: data.kitSlug || cDoc.id,
            });
          }
        }
        setCreators(results);
      } catch (e) {
        setCreators([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user]);

  if (!user) return null; // only show when logged in
  if (loading) return null;
  if (creators.length === 0) return null;

  return (
    <div className="mt-10">
      <div className="text-center text-neutral-300 mb-6">Your Creator Kits</div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {creators.map((c) => (
          <Link key={c.id} href={`/creator-kits/${c.kitSlug}`} className="block rounded-xl overflow-hidden border border-neutral-800 bg-neutral-950 hover:border-ccaBlue/50 transition">
            <div className="relative h-56 bg-neutral-900">
              {c.bannerUrl && (
                <Image src={c.bannerUrl} alt={c.displayName} fill sizes="(max-width:768px) 100vw, 33vw" className="object-cover" />
              )}
            </div>
            <div className="p-4">
              <div className="text-lg font-semibold text-white">{c.displayName}</div>
              {c.handle && <div className="text-sm text-neutral-400">@{c.handle}</div>}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}


