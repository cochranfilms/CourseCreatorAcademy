"use client";
import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';
import Image from 'next/image';

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

  useEffect(() => {
    const load = async () => {
      if (!user) {
        setSubscriptions([]);
        setLoading(false);
        return;
      }

      try {
        const res = await fetch(`/api/legacy/subscriptions?userId=${user.uid}`);
        const json = await res.json();
        setSubscriptions(json.subscriptions || []);
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

  if (subscriptions.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-neutral-400 mb-4">You don't have any active Legacy+ subscriptions.</p>
        <Link href="/" className="text-ccaBlue hover:underline">Browse Creator Kits</Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
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
                href={`/creator-kits/${sub.creator.id}`}
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

