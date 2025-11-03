"use client";
import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';

type Creator = {
  id: string;
  handle: string;
  displayName: string;
  avatarUrl?: string | null;
  bannerUrl?: string | null;
  kitSlug?: string;
};

export function LegacyUpgradeModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [creators, setCreators] = useState<Creator[]>([]);

  useEffect(() => {
    if (!isOpen) return;
    const load = async () => {
      try {
        const res = await fetch('/api/legacy/creators', { cache: 'no-store' });
        const json = await res.json();
        setCreators(json.creators || []);
      } catch {}
    };
    load();
  }, [isOpen]);

  const startCheckout = async (creatorId: string) => {
    if (!user) { alert('Sign in to upgrade.'); return; }
    setLoading(true);
    try {
      const res = await fetch('/api/legacy/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ creatorId, buyerId: user.uid })
      });
      const json = await res.json();
      if (json.url) {
        window.location.href = json.url;
      } else if (json.error) {
        alert(json.error);
      }
    } catch (e: any) {
      alert(e?.message || 'Failed to start checkout');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative bg-neutral-950 border border-neutral-800 w-full max-w-lg mx-4">
        <div className="p-4 border-b border-neutral-800 flex items-center justify-between">
          <div className="text-lg font-semibold text-white">Upgrade to Legacy+</div>
          <button onClick={onClose} className="text-neutral-400 hover:text-white">✕</button>
        </div>
        <div className="p-4 space-y-3 max-h-[70vh] overflow-y-auto">
          <div className="text-sm text-neutral-400">Select a creator to support:</div>
          <div className="divide-y divide-neutral-800">
            {creators.map((c) => (
              <button
                key={c.id}
                onClick={() => startCheckout(c.id)}
                disabled={loading}
                className="w-full flex items-center gap-3 px-3 py-3 text-left hover:bg-neutral-900 transition"
              >
                <div className="w-10 h-10 rounded-full overflow-hidden bg-neutral-800 flex-shrink-0">
                  {c.avatarUrl ? (
                    <img src={c.avatarUrl} alt={c.displayName} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-sm text-neutral-400">@</div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-white truncate">{c.displayName}</div>
                  {c.handle && <div className="text-xs text-neutral-400 truncate">@{c.handle}</div>}
                </div>
                <div className="text-sm font-semibold text-white">$10/mo</div>
              </button>
            ))}
            {creators.length === 0 && (
              <div className="text-sm text-neutral-500 p-3">No legacy creators available yet.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}


