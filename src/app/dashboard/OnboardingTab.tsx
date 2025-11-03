"use client";
import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { db, firebaseReady } from '@/lib/firebaseClient';
import { doc, getDoc, setDoc } from 'firebase/firestore';

export default function OnboardingTab() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<any>(null);
  const [connectAccountId, setConnectAccountId] = useState<string | null>(null);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date | null>(null);
  const isTestMode = typeof process !== 'undefined' && (process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '').startsWith('pk_test_');
  const [notifPrefs, setNotifPrefs] = useState<{ orderPlaced: boolean; disputeCreated: boolean; payoutPaid: boolean } | null>(null);

  useEffect(() => {
    const load = async () => {
      if (!firebaseReady || !db || !user) return;
      const uref = doc(db, 'users', user.uid);
      const snap = await getDoc(uref);
      const data = snap.data() as any;
      if (data?.notificationPrefs) {
        setNotifPrefs({
          orderPlaced: Boolean(data.notificationPrefs.orderPlaced ?? true),
          disputeCreated: Boolean(data.notificationPrefs.disputeCreated ?? true),
          payoutPaid: Boolean(data.notificationPrefs.payoutPaid ?? true),
        });
      }
      if (data?.connectAccountId) {
        setConnectAccountId(data.connectAccountId);
        try {
          const res = await fetch(`/api/stripe/connect/status?accountId=${data.connectAccountId}`);
          const json = await res.json();
          setStatus(json);
          setLastRefreshedAt(new Date());
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
      setLastRefreshedAt(new Date());
    } catch {}
    setLoading(false);
  };

  const manageInStripe = () => {
    if (status?.loginLinkUrl) window.open(status.loginLinkUrl, '_blank');
  };

  // Show the onboarding/resume button only when action is required
  const needsAction = Boolean(
    !connectAccountId ||
    !status?.details_submitted ||
    !status?.charges_enabled ||
    (status?.requirements?.currently_due?.length || 0) > 0 ||
    (status?.requirements?.past_due?.length || 0) > 0 ||
    (status?.requirements?.eventually_due?.length || 0) > 0
  );

  const handleDisconnect = async () => {
    if (!user) return;
    if (!confirm('Disconnect your Stripe account from CCA? You can reconnect later.')) return;
    try {
      await setDoc(doc(db!, 'users', user.uid), { connectAccountId: null, updatedAt: new Date() }, { merge: true });
      setConnectAccountId(null);
      setStatus(null);
    } catch (e: any) {
      alert(e.message || 'Failed to disconnect.');
    }
  };

  const updateNotif = async (key: 'orderPlaced'|'disputeCreated'|'payoutPaid', value: boolean) => {
    if (!user) return;
    const next = { ...(notifPrefs || { orderPlaced: true, disputeCreated: true, payoutPaid: true }), [key]: value };
    setNotifPrefs(next);
    try {
      await setDoc(doc(db!, 'users', user.uid), { notificationPrefs: next, updatedAt: new Date() }, { merge: true });
    } catch {}
  };

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-semibold">Creator Onboarding</h2>
        <span className={`px-2 py-1 text-xs border ${isTestMode ? 'border-yellow-500 text-yellow-400' : 'border-green-600 text-green-400'}`}>
          {isTestMode ? 'Test Mode' : 'Live Mode'}
        </span>
      </div>
      {!user && <p className="text-neutral-400">Sign in to connect your Stripe account.</p>}
      {user && (
        <div className="space-y-4 border border-neutral-800 p-4 bg-neutral-950">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-neutral-400">Stripe Account</div>
              <div className="text-white font-mono text-sm">{connectAccountId || 'Not connected'}</div>
            </div>
            {needsAction && (
              <button onClick={startOnboarding} disabled={loading} className="px-4 py-2 bg-white text-black border-2 border-ccaBlue hover:bg-neutral-100 disabled:opacity-50">
                {connectAccountId ? 'Resume/Update in Stripe' : 'Connect Stripe'}
              </button>
            )}
          </div>

          {/* Status chips + last refreshed */}
          {status && (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className={`px-2 py-1 border ${status.charges_enabled ? 'border-green-600 text-green-400' : 'border-neutral-600 text-neutral-300'}`}>charges_enabled: {String(status.charges_enabled)}</span>
              <span className={`px-2 py-1 border ${status.payouts_enabled ? 'border-green-600 text-green-400' : 'border-neutral-600 text-neutral-300'}`}>payouts_enabled: {String(status.payouts_enabled)}</span>
              <span className={`px-2 py-1 border ${status.details_submitted ? 'border-green-600 text-green-400' : 'border-neutral-600 text-neutral-300'}`}>details_submitted: {String(status.details_submitted)}</span>
              {lastRefreshedAt && <span className="px-2 py-1 border border-neutral-700 text-neutral-400">last check: {lastRefreshedAt.toLocaleString()}</span>}
            </div>
          )}

          {connectAccountId && (
            <div className="flex items-center gap-3">
              <button onClick={refreshStatus} disabled={loading} className="px-3 py-2 bg-neutral-900 border border-neutral-700 text-neutral-200 hover:bg-neutral-800">Refresh Status</button>
              {status?.loginLinkUrl && (
                <button onClick={manageInStripe} className="px-3 py-2 bg-neutral-900 border border-neutral-700 text-neutral-200 hover:bg-neutral-800">Open Stripe Dashboard</button>
              )}
              {connectAccountId && <button onClick={handleDisconnect} className="px-3 py-2 bg-neutral-900 border border-neutral-700 text-neutral-300 hover:bg-neutral-800">Disconnect</button>}
            </div>
          )}

          {status && needsAction && (
            <div className="text-sm text-neutral-200 bg-yellow-500/10 border border-yellow-600 p-3">
              <div className="font-medium mb-1">Action needed to start selling</div>
              {status?.requirements?.disabled_reason && (
                <div className="text-xs text-yellow-400 mb-2">Reason: {status.requirements.disabled_reason}</div>
              )}
              <div className="flex flex-wrap gap-2 text-xs">
                {(status?.requirements?.currently_due || []).map((f: string) => (
                  <span key={`cur-${f}`} className="px-2 py-1 border border-yellow-600 text-yellow-300">{f}</span>
                ))}
                {(status?.requirements?.past_due || []).map((f: string) => (
                  <span key={`past-${f}`} className="px-2 py-1 border border-red-600 text-red-400">{f}</span>
                ))}
              </div>
            </div>
          )}

          {status?.payoutSchedule && (
            <div className="text-xs text-neutral-400">
              Payout schedule: {status.payoutSchedule.interval || '—'}
              {status.payoutSchedule.interval === 'weekly' && status.payoutSchedule.weekly_anchor ? ` (${status.payoutSchedule.weekly_anchor})` : ''}
              {status.payoutSchedule.interval === 'monthly' && status.payoutSchedule.monthly_anchor ? ` (day ${status.payoutSchedule.monthly_anchor})` : ''}
            </div>
          )}

          <div className="text-xs text-neutral-500">
            Note: Payouts go directly to your Stripe Express account. CCA collects a 3% fee per sale.
          </div>

          {/* Start Selling CTA when ready */}
          {status?.charges_enabled && status?.payouts_enabled && (
            <div className="pt-2">
              <a href="/marketplace" className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white">
                Start Selling
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
              </a>
            </div>
          )}

          {/* Notification preferences */}
          <div className="mt-4 border-t border-neutral-800 pt-4">
            <div className="text-sm font-medium mb-2">Notifications</div>
            <div className="flex flex-col gap-2 text-sm">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={Boolean(notifPrefs?.orderPlaced ?? true)} onChange={(e) => updateNotif('orderPlaced', e.target.checked)} />
                Order placed
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={Boolean(notifPrefs?.disputeCreated ?? true)} onChange={(e) => updateNotif('disputeCreated', e.target.checked)} />
                Dispute created
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={Boolean(notifPrefs?.payoutPaid ?? true)} onChange={(e) => updateNotif('payoutPaid', e.target.checked)} />
                Payout paid
              </label>
            </div>
          </div>

          {/* Help links (white footer section) */}
          <div className="mt-4 -mx-4 -mb-4 border-t border-neutral-800">
            <div className="bg-white text-black p-4 text-sm space-y-2">
              <div><a className="text-ccaBlue hover:underline" href="/docs/fees" target="_blank">How fees work (3%)</a></div>
              <div><a className="text-ccaBlue hover:underline" href="/docs/payouts" target="_blank">Payout timing</a></div>
              <div><a className="text-ccaBlue hover:underline" href="/docs/disputes" target="_blank">Disputes</a></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


