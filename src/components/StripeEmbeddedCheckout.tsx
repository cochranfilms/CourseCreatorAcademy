"use client";
import { useEffect, useRef, useState } from 'react';

type PlanKey = 'membership87' | 'monthly37';

export function StripeEmbeddedCheckout({
  plan,
  isOpen,
  onClose
}: {
  plan: PlanKey | null;
  isOpen: boolean;
  onClose: () => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [mounting, setMounting] = useState(false);

  useEffect(() => {
    let checkout: any | null = null;
    let cancelled = false;
    async function mount() {
      if (!isOpen || !plan) return;
      setMounting(true);
      try {
        const endpoint = plan === 'membership87' ? '/api/subscribe/membership' : '/api/subscribe/monthly';
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ embedded: true })
        });
        const json = await res.json();
        const clientSecret = json?.clientSecret;
        if (!clientSecret || cancelled) return;

        const { loadStripe } = await import('@stripe/stripe-js');
        const stripe = await loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY as string);
        if (!stripe || cancelled) return;
        checkout = await (stripe as any).initEmbeddedCheckout({ clientSecret });
        if (containerRef.current && !cancelled) {
          checkout.mount(containerRef.current);
        }
      } finally {
        if (!cancelled) setMounting(false);
      }
    }
    mount();
    return () => {
      cancelled = true;
      try { checkout?.destroy?.(); } catch {}
    };
  }, [isOpen, plan]);

  if (!isOpen || !plan) return null;

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative w-full max-w-2xl sm:max-w-3xl md:max-w-4xl h-[85vh] max-h-[92vh] bg-neutral-950 border border-neutral-800 rounded-2xl shadow-2xl overflow-y-auto overscroll-contain">
        <div className="absolute top-3 right-3 z-10">
          <button className="text-neutral-400 hover:text-white" onClick={onClose} aria-label="Close">
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>
        <div ref={containerRef} className="w-full h-full bg-black" />
        {mounting && (
          <div className="absolute inset-0 flex items-center justify-center text-neutral-400">Loading checkout…</div>
        )}
      </div>
    </div>
  );
}


