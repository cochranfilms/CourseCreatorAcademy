"use client";
import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { db, firebaseReady } from '@/lib/firebaseClient';
import { doc, getDoc, setDoc } from 'firebase/firestore';

export default function CreatorOnboardingPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<any>(null);
  const [connectAccountId, setConnectAccountId] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      if (!firebaseReady || !db || !user) return;
      const uref = doc(db, 'users', user.uid);
      const snap = await getDoc(uref);
      const data = snap.data() as any;
      if (data?.connectAccountId) {
        setConnectAccountId(data.connectAccountId);
        try {
          const res = await fetch(`/api/stripe/connect/status?accountId=${data.connectAccountId}`);
          const json = await res.json();
          setStatus(json);
        } catch (e) {}
      }
    };
    load();
  }, [user]);

  const startOnboarding = async () => {
    if (!user) { alert('Sign in first.'); return; }
    setLoading(true);
    try {
      const res = await fetch('/api/stripe/connect/onboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId: connectAccountId || undefined })
      });
      const json = await res.json();
      if (json.accountId && firebaseReady && db) {
        await setDoc(doc(db, 'users', user.uid), { connectAccountId: json.accountId, updatedAt: new Date() }, { merge: true });
        setConnectAccountId(json.accountId);
      }
      if (json.url) {
        window.location.href = json.url;
      }
    } catch (e: any) {
      alert(e.message || 'Failed to start onboarding');
    } finally {
      setLoading(false);
    }
  };

  const refreshStatus = async () => {
    if (!connectAccountId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/stripe/connect/status?accountId=${connectAccountId}`);
      const json = await res.json();
      setStatus(json);
      // Auto-enable legacy creator once charges are enabled
      if (json?.charges_enabled) {
        try {
          const enableRes = await fetch('/api/legacy/creators/enable', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
          });
          const enableJson = await enableRes.json();
          if (!enableRes.ok && enableJson?.error) {
            console.warn('Enable legacy creator failed:', enableJson.error);
          }
        } catch (e) {}
      }
    } catch {}
    setLoading(false);
  };

  const manageInStripe = () => {
    if (status?.loginLinkUrl) {
      window.open(status.loginLinkUrl, '_blank');
    }
  };

  return (
    <main className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-4">Creator Onboarding</h1>

      {!user && (
        <p className="text-neutral-400">Sign in to connect your Stripe account.</p>
      )}

      {user && (
        <div className="space-y-4 border border-neutral-800 p-4 bg-neutral-950">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-neutral-400">Stripe Account</div>
              <div className="text-white font-mono text-sm">{connectAccountId || 'Not connected'}</div>
            </div>
            <button
              onClick={startOnboarding}
              disabled={loading}
              className="px-4 py-2 bg-white text-black border-2 border-ccaBlue hover:bg-neutral-100 disabled:opacity-50"
            >
              {connectAccountId ? 'Resume/Update in Stripe' : 'Connect Stripe'}
            </button>
          </div>

          {connectAccountId && (
            <div className="flex items-center gap-3">
              <button onClick={refreshStatus} disabled={loading} className="px-3 py-2 bg-neutral-900 border border-neutral-700 text-neutral-200 hover:bg-neutral-800">Refresh Status</button>
              {status?.loginLinkUrl && (
                <button onClick={manageInStripe} className="px-3 py-2 bg-neutral-900 border border-neutral-700 text-neutral-200 hover:bg-neutral-800">Open Stripe Dashboard</button>
              )}
            </div>
          )}

          {status && (
            <div className="text-sm text-neutral-300 space-y-1">
              <div>charges_enabled: <span className="font-mono">{String(status.charges_enabled)}</span></div>
              <div>details_submitted: <span className="font-mono">{String(status.details_submitted)}</span></div>
            </div>
          )}

          <div className="text-xs text-neutral-500">
            Note: Payouts go directly to your Stripe Express account. CCA collects a 3% fee per sale.
          </div>
        </div>
      )}
    </main>
  );
}


