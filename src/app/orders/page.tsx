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
  customerEmail?: string | null;
  trackingNumber?: string;
  trackingCarrier?: string;
  trackingUrl?: string;
  trackingDeadlineAtMs?: number;
  deliveredAt?: any;
};

export default function OrdersPage() {
  const { user, auth } = useAuth();
  const [sold, setSold] = useState<Order[]>([]);
  const [bought, setBought] = useState<Order[]>([]);

  useEffect(() => {
    if (!firebaseReady || !db || !user) { setSold([]); setBought([]); return; }

    // Sold orders (as seller)
    const qSold = query(
      collection(db, 'orders'),
      where('sellerId', '==', user.uid),
      orderBy('trackingDeadlineAtMs', 'desc')
    );
    const unsub1 = onSnapshot(
      qSold,
      (snap) => setSold(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }))),
      () => {
        const fallback = query(collection(db, 'orders'), where('sellerId', '==', user.uid));
        onSnapshot(fallback, (snap) => {
          const rows = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Order[];
          const sorted = rows.sort((a, b) => (b.trackingDeadlineAtMs || 0) - (a.trackingDeadlineAtMs || 0));
          setSold(sorted);
        });
      }
    );

    // Bought orders (as buyer)
    const qBought = query(
      collection(db, 'orders'),
      where('buyerId', '==', user.uid),
      orderBy('trackingDeadlineAtMs', 'desc')
    );
    const unsub2 = onSnapshot(
      qBought,
      (snap) => {
        const byId = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })) as Order[];
        if (user.email) {
          const qByEmail = query(collection(db, 'orders'), where('customerEmail', '==', user.email), orderBy('trackingDeadlineAtMs', 'desc'));
          onSnapshot(
            qByEmail,
            (snap2) => {
              const byEmail = snap2.docs.map(d => ({ id: d.id, ...(d.data() as any) })) as Order[];
              const map = new Map<string, Order>();
              [...byId, ...byEmail].forEach((o) => map.set(o.id, o));
              setBought(Array.from(map.values()));
            },
            () => {
              const fbEmail = query(collection(db, 'orders'), where('customerEmail', '==', String(user.email)));
              onSnapshot(fbEmail, (snap3) => {
                const byEmail = snap3.docs.map(d => ({ id: d.id, ...(d.data() as any) })) as Order[];
                const map = new Map<string, Order>();
                [...byId, ...byEmail].forEach((o) => map.set(o.id, o));
                const merged = Array.from(map.values()).sort((a, b) => (b.trackingDeadlineAtMs || 0) - (a.trackingDeadlineAtMs || 0));
                setBought(merged);
              });
            }
          );
        } else {
          setBought(byId);
        }
      },
      () => {
        const fallback = query(collection(db, 'orders'), where('buyerId', '==', user.uid));
        onSnapshot(fallback, (snap) => {
          const byId = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })) as Order[];
          if (user.email) {
            const fbEmail = query(collection(db, 'orders'), where('customerEmail', '==', String(user.email)));
            onSnapshot(fbEmail, (snap2) => {
              const byEmail = snap2.docs.map(d => ({ id: d.id, ...(d.data() as any) })) as Order[];
              const map = new Map<string, Order>();
              [...byId, ...byEmail].forEach((o) => map.set(o.id, o));
              const merged = Array.from(map.values()).sort((a, b) => (b.trackingDeadlineAtMs || 0) - (a.trackingDeadlineAtMs || 0));
              setBought(merged);
            });
          } else {
            const sorted = byId.sort((a, b) => (b.trackingDeadlineAtMs || 0) - (a.trackingDeadlineAtMs || 0));
            setBought(sorted);
          }
        });
      }
    );

    return () => { unsub1(); unsub2(); };
  }, [user]);

  const submitTracking = async (order: Order, values: { trackingNumber: string; trackingCarrier?: string; trackingUrl?: string; }) => {
    if (!user || order.sellerId !== user.uid) { alert('Only the seller can update tracking'); return; }
    try {
      const idToken = await auth?.currentUser?.getIdToken();
      if (!idToken) {
        alert('Please sign in');
        return;
      }
      const response = await fetch('/api/orders/update-tracking', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({
          orderId: order.id,
          trackingNumber: values.trackingNumber,
          trackingCarrier: values.trackingCarrier,
          trackingUrl: values.trackingUrl,
        })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to update tracking');
      }
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
    <main className="max-w-5xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Orders</h1>

      {!user && <p className="text-neutral-400">Sign in to view orders.</p>}

      {user && (
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
      )}
    </main>
  );
}


