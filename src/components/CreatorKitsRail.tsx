"use client";
import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@/contexts/AuthContext';
import { db, firebaseReady } from '@/lib/firebaseClient';
import { collection, getDocs, query, where, doc, getDoc, orderBy } from 'firebase/firestore';

type Creator = {
  id: string;
  displayName: string;
  handle?: string;
  bannerUrl?: string | null;
  kitSlug?: string;
  isSubscribed?: boolean;
};

type Props = {
  showAll?: boolean; // If true, show all creators (not just subscribed)
  showSamplesOnly?: boolean; // If true, only show creators with samples
};

export function CreatorKitsRail({ showAll = false, showSamplesOnly = false }: Props = {}) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [creators, setCreators] = useState<Creator[]>([]);

  useEffect(() => {
    const load = async () => {
      if (!firebaseReady || !db) { setCreators([]); setLoading(false); return; }
      try {
        if (showAll) {
          // Show all legacy creators
          const creatorsQ = query(collection(db, 'legacy_creators'), orderBy('order', 'asc'));
          const creatorsSnap = await getDocs(creatorsQ).catch(() => getDocs(collection(db, 'legacy_creators')));
          const subscribedIds = new Set<string>();
          if (user) {
            const subsQ = query(collection(db, 'legacySubscriptions'), where('userId', '==', user.uid), where('status', 'in', ['active', 'trialing']));
            const subsSnap = await getDocs(subsQ);
            subsSnap.docs.forEach(d => {
              const cId = (d.data() as any).creatorId;
              if (cId) subscribedIds.add(String(cId));
            });
          }
          const results: Creator[] = [];
          for (const d of creatorsSnap.docs) {
            const data = d.data();
            if (showSamplesOnly) {
              // Check if creator has at least 3 sample videos
              const samplesRef = collection(db, `legacy_creators/${d.id}/videos`);
              const samplesQ = query(samplesRef, where('isSample', '==', true));
              const samplesSnap = await getDocs(samplesQ);
              if (samplesSnap.size < 3) continue;
            }
            results.push({
              id: d.id,
              displayName: data.displayName || data.handle || 'Creator',
              handle: data.handle,
              bannerUrl: data.bannerUrl || null,
              kitSlug: data.kitSlug || d.id,
              isSubscribed: subscribedIds.has(d.id),
            });
          }
          setCreators(results);
        } else {
          // Show only subscribed creators (original behavior)
          if (!user) { setCreators([]); setLoading(false); return; }
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
                isSubscribed: true,
              });
            }
          }
          setCreators(results);
        }
      } catch (e) {
        setCreators([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user, showAll, showSamplesOnly]);

  if (loading) return null;
  if (creators.length === 0) return null;

  return (
    <div className="mt-10">
      <div className="text-center text-neutral-300 mb-6">
        {showAll ? 'Creator Kits' : 'Your Creator Kits'}
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {creators.map((c) => (
          <Link key={c.id} href={`/creator-kits/${c.kitSlug}`} className="block rounded-xl overflow-hidden border border-neutral-800 bg-neutral-950 hover:border-ccaBlue/50 transition">
            <div className="relative h-56 bg-neutral-900">
              {c.bannerUrl && (
                <Image src={c.bannerUrl} alt={c.displayName} fill sizes="(max-width:768px) 100vw, 33vw" className="object-cover" />
              )}
            </div>
            <div className="p-4">
              <div className="flex items-center justify-between mb-1">
                <div className="text-lg font-semibold text-white">{c.displayName}</div>
                {c.isSubscribed && (
                  <span className="px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded">Subscribed</span>
                )}
              </div>
              {c.handle && <div className="text-sm text-neutral-400">@{c.handle}</div>}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
