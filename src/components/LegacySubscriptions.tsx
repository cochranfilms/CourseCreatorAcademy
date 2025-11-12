"use client";
import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';
import Image from 'next/image';
import { db, firebaseReady } from '@/lib/firebaseClient';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';

type Subscription = {
  id: string;
  creatorId: string;
  subscriptionId: string;
  status: string;
  amount: number;
  currency: string;
  creator?: {
    id: string;
    displayName: string;
    handle?: string;
    avatarUrl?: string | null;
  };
};

export function LegacySubscriptions() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [membershipActive, setMembershipActive] = useState<boolean>(true);

  useEffect(() => {
    const load = async () => {
      if (!user) {
        setSubscriptions([]);
        setLoading(false);
        return;
      }

      try {
        let subs: Subscription[] | null = null;
      try {
        const res = await fetch(`/api/legacy/subscriptions?userId=${user.uid}`);
        const json = await res.json();
          if (res.ok && Array.isArray(json.subscriptions)) {
            subs = json.subscriptions as Subscription[];
          }
        } catch {}

        // Fallback: query directly from Firestore (client) if API not available locally
        if (!subs && firebaseReady && db) {
          try {
            const q = query(collection(db, 'legacySubscriptions'), where('userId', '==', user.uid));
            const snap = await getDocs(q);
            const raw = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
            const filtered = raw.filter((r: any) => ['active', 'trialing'].includes(String(r.status || '')));
            subs = filtered.map((r: any) => ({
              id: r.id,
              creatorId: String(r.creatorId || ''),
              subscriptionId: String(r.subscriptionId || ''),
              status: String(r.status || 'active'),
              amount: Number(r.amount || 1000),
              currency: String(r.currency || 'usd'),
            }));
          } catch {}
        }

        setSubscriptions(subs || []);

        // Attempt to read explicit membership flag from user profile (optional)
        if (firebaseReady && db) {
          try {
            const ref = doc(db, 'users', user.uid);
            const snap = await getDoc(ref);
            if (snap.exists()) {
              const data = snap.data() as any;
              if (typeof data?.membershipActive === 'boolean') {
                setMembershipActive(Boolean(data.membershipActive));
              } else if (typeof data?.member === 'boolean') {
                setMembershipActive(Boolean(data.member));
              }
            }
          } catch {
            // ignore; default stays true
          }
        }
      } catch (e) {
        setSubscriptions([]);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [user]);

  if (!user) return null;
  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-neutral-400">Loading subscriptions...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-neutral-950 border border-neutral-800 rounded-lg p-4 flex items-center justify-between">
        <div>
          <div className="font-semibold text-white">CCA Membership</div>
          <div className="text-sm text-neutral-400">Platform access to courses, community, and marketplace</div>
        </div>
        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${membershipActive ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
          {membershipActive ? 'Active' : 'Inactive'}
        </span>
      </div>

      {subscriptions.length === 0 ? (
        <div className="text-center py-6">
          <p className="text-neutral-400 mb-4">You don't have any active Legacy+ subscriptions.</p>
          <Link href="/learn" className="text-ccaBlue hover:underline">Browse Creator Kits</Link>
        </div>
      ) : null}

      {subscriptions.map((sub) => (
        <div
          key={sub.id}
          className="bg-neutral-950 border border-neutral-800 rounded-lg p-4 flex items-center justify-between"
        >
          <div className="flex items-center gap-4">
            {sub.creator?.avatarUrl && (
              <div className="relative w-12 h-12 rounded-full overflow-hidden bg-neutral-800 flex-shrink-0">
                <Image src={sub.creator.avatarUrl} alt={sub.creator.displayName} fill sizes="48px" className="object-cover" />
              </div>
            )}
            <div>
              <div className="font-semibold text-white">{sub.creator?.displayName || 'Creator'}</div>
              {sub.creator?.handle && <div className="text-sm text-neutral-400">@{sub.creator.handle}</div>}
              <div className="text-xs text-neutral-500 mt-1">
                ${(sub.amount / 100).toFixed(2)}/{sub.currency === 'usd' ? 'mo' : 'month'}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
              sub.status === 'active' 
                ? 'bg-green-500/20 text-green-400' 
                : 'bg-yellow-500/20 text-yellow-400'
            }`}>
              {sub.status === 'active' ? 'Active' : 'Trialing'}
            </span>
            {sub.creator && (
              <Link
                href={`/learn?section=creator-kits&kit=${encodeURIComponent(sub.creator.id)}`}
                className="px-4 py-2 bg-ccaBlue hover:bg-ccaBlue/90 text-white rounded-lg text-sm font-medium transition"
              >
                View Kit
              </Link>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

