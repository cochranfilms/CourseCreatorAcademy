"use client";
import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { collection, onSnapshot, query, where, orderBy, doc, updateDoc } from 'firebase/firestore';
import { db, firebaseReady } from '@/lib/firebaseClient';

type Order = {
  id: string;
  listingId?: string | null;
  listingTitle?: string | null;
  buyerId?: string | null;
  sellerId?: string | null;
  sellerAccountId?: string | null;
  amount?: number;
  currency?: string;
  status?: string;
  shippingDetails?: any;
  trackingNumber?: string;
  trackingCarrier?: string;
  trackingUrl?: string;
  trackingDeadlineAtMs?: number;
  deliveredAt?: any;
};

export default function OrdersTab() {
  const { user } = useAuth();
  const [sold, setSold] = useState<Order[]>([]);
  const [bought, setBought] = useState<Order[]>([]);

  useEffect(() => {
    if (!firebaseReady || !db || !user) { setSold([]); setBought([]); return; }

    const qSold = query(
      collection(db, 'orders'),
      where('sellerId', '==', user.uid),
      orderBy('trackingDeadlineAtMs', 'desc')
    );
    const qBought = query(
      collection(db, 'orders'),
      where('buyerId', '==', user.uid),
      orderBy('trackingDeadlineAtMs', 'desc')
    );

    const unsub1 = onSnapshot(qSold, (snap) => setSold(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }))));
    const unsub2 = onSnapshot(qBought, (snap) => setBought(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }))));
    return () => { unsub1(); unsub2(); };
  }, [user]);

  const submitTracking = async (order: Order, values: { trackingNumber: string; trackingCarrier?: string; trackingUrl?: string; }) => {
    if (!firebaseReady || !db) return;
    if (!user || order.sellerId !== user.uid) { alert('Only the seller can update tracking'); return; }
    try {
      await updateDoc(doc(db, 'orders', order.id), {
        trackingNumber: values.trackingNumber,
        trackingCarrier: values.trackingCarrier || null,
        trackingUrl: values.trackingUrl || null,
        status: 'shipped',
        shippedAt: new Date()
      } as any);
      alert('Tracking saved');
    } catch (e: any) {
      alert(e.message || 'Failed to save tracking');
    }
  };

  const markDelivered = async (order: Order) => {
    if (!firebaseReady || !db) return;
    if (!user || order.buyerId !== user.uid) { alert('Only the buyer can mark delivered'); return; }
    try {
      await updateDoc(doc(db, 'orders', order.id), {
        status: 'delivered',
        deliveredAt: new Date()
      } as any);
      alert('Marked as delivered');
    } catch (e: any) {
      alert(e.message || 'Failed to mark delivered');
    }
  };

  const formatAmount = (cents?: number, currency?: string) => {
    if (!cents) return '-';
    return `${(cents / 100).toFixed(2)} ${currency || 'usd'}`;
  };

  const formatMaybeTimestamp = (value: any): string => {
    if (!value) return '';
    try {
      const d = value?.toDate ? value.toDate() : new Date(value);
      if (isNaN(d.getTime())) return '';
      return d.toLocaleString();
    } catch {
      return '';
    }
  };

  const OverdueBadge = ({ order }: { order: Order }) => {
    const now = Date.now();
    const overdue = order.status === 'awaiting_tracking' && (order.trackingDeadlineAtMs || 0) < now;
    if (!overdue) return null;
    return <span className="ml-2 text-xs text-red-400">Overdue</span>;
  };

  return (
    <div className="grid md:grid-cols-2 gap-6">
      {/* Sold */}
      <div className="border border-neutral-800 bg-neutral-950 p-4">
        <h2 className="text-xl font-semibold mb-3">Sold</h2>
        {sold.length === 0 ? (
          <p className="text-neutral-400">No orders yet.</p>
        ) : (
          <div className="space-y-3">
            {sold.map(order => (
              <div key={order.id} className="border border-neutral-800 p-3 bg-neutral-900">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">{order.listingTitle || `Listing ${order.listingId || '-'}`}</div>
                    <div className="text-sm text-neutral-400">{formatAmount(order.amount, order.currency)}</div>
                    <div className="text-sm text-neutral-400">Status: {order.status}<OverdueBadge order={order} /></div>
                    {order.status === 'delivered' && order.deliveredAt && (
                      <div className="text-xs text-green-400">Delivered at {formatMaybeTimestamp(order.deliveredAt)}</div>
                    )}
                    {order.status !== 'delivered' && order.trackingDeadlineAtMs && (
                      <div className="text-xs text-neutral-500">Tracking due by {new Date(order.trackingDeadlineAtMs).toLocaleString()}</div>
                    )}
                  </div>
                </div>

                {order.status !== 'delivered' && (
                  <div className="mt-3 grid gap-2">
                    <input
                      placeholder="Carrier (e.g., UPS)"
                      defaultValue={order.trackingCarrier || ''}
                      className="bg-neutral-900 border border-neutral-700 px-3 py-2 text-white"
                      onChange={(e) => (order.trackingCarrier = e.target.value)}
                    />
                    <input
                      placeholder="Tracking number"
                      defaultValue={order.trackingNumber || ''}
                      className="bg-neutral-900 border border-neutral-700 px-3 py-2 text-white"
                      onChange={(e) => (order.trackingNumber = e.target.value)}
                    />
                    <input
                      placeholder="Tracking URL (optional)"
                      defaultValue={order.trackingUrl || ''}
                      className="bg-neutral-900 border border-neutral-700 px-3 py-2 text-white"
                      onChange={(e) => (order.trackingUrl = e.target.value)}
                    />
                    <button
                      className="justify-self-start px-4 py-2 bg-white text-black border-2 border-ccaBlue"
                      onClick={() => submitTracking(order, { trackingNumber: order.trackingNumber || '', trackingCarrier: order.trackingCarrier, trackingUrl: order.trackingUrl })}
                    >
                      Save Tracking
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bought */}
      <div className="border border-neutral-800 bg-neutral-950 p-4">
        <h2 className="text-xl font-semibold mb-3">Purchased</h2>
        {bought.length === 0 ? (
          <p className="text-neutral-400">No purchases yet.</p>
        ) : (
          <div className="space-y-3">
            {bought.map(order => (
              <div key={order.id} className="border border-neutral-800 p-3 bg-neutral-900">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">{order.listingTitle || `Listing ${order.listingId || '-'}`}</div>
                    <div className="text-sm text-neutral-400">{formatAmount(order.amount, order.currency)}</div>
                    <div className="text-sm text-neutral-400">Status: {order.status}</div>
                  </div>
                </div>
                {order.status === 'shipped' && user && order.buyerId === user.uid && (
                  <div className="mt-3">
                    <button
                      onClick={() => markDelivered(order)}
                      className="px-4 py-2 bg-white text-black border-2 border-ccaBlue"
                    >
                      Mark as Delivered
                    </button>
                  </div>
                )}
                {order.trackingNumber && (
                  <div className="mt-2 text-sm text-neutral-300">
                    Tracking: {order.trackingCarrier ? `${order.trackingCarrier} ` : ''}{order.trackingNumber}
                    {order.trackingUrl && (
                      <a className="ml-2 text-ccaBlue underline" href={order.trackingUrl} target="_blank">View</a>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}


