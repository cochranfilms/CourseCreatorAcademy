"use client";
import { useState } from 'react';
import { StripeEmbeddedCheckout } from './StripeEmbeddedCheckout';

export function PricingModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [loading, setLoading] = useState<string | null>(null);
  const [checkoutPlan, setCheckoutPlan] = useState<null | 'monthly37' | 'membership87'>(null);

  if (!isOpen) return null;

  const startCheckout = async (plan: 'monthly37' | 'membership87') => {
    setLoading(plan);
    setCheckoutPlan(plan);
    setLoading(null);
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative w-full max-w-5xl mx-4 bg-neutral-950 border border-neutral-800 rounded-2xl p-6 sm:p-8 shadow-2xl">
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <div className="text-2xl font-bold text-white">Choose your plan</div>
            <div className="text-sm text-neutral-400">Get instant access. Cancel anytime.</div>
          </div>
          <button className="text-neutral-400 hover:text-white" onClick={onClose} aria-label="Close">
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Monthly */}
          <div className="bg-gradient-to-br from-neutral-950 to-neutral-900 rounded-2xl border border-neutral-800 p-6 sm:p-8 h-full flex flex-col">
            <div className="text-neutral-400 text-sm font-semibold mb-2">MONTHLY MEMBERSHIP</div>
            <div className="text-5xl sm:text-6xl font-extrabold mt-2">$37<span className="text-2xl font-semibold">/month</span></div>
            <div className="mt-6 text-neutral-300 space-y-3 flex-1">
              <div className="flex items-center gap-3"><svg className="w-5 h-5 text-ccaBlue" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/></svg>Stream all videos</div>
              <div className="flex items-center gap-3"><svg className="w-5 h-5 text-ccaBlue" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/></svg>Access future content</div>
              <div className="flex items-center gap-3"><svg className="w-5 h-5 text-ccaBlue" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/></svg>Community + downloads</div>
            </div>
            <button
              className="cta-button mt-8 w-full text-lg py-4"
              onClick={() => startCheckout('monthly37')}
              disabled={loading !== null}
            >{loading === 'monthly37' ? 'Redirecting...' : 'Join Now'}</button>
          </div>

          {/* All-Access */}
          <div className="bg-gradient-to-br from-ccaBlue/20 via-purple-500/20 to-pink-500/20 rounded-2xl border-2 border-ccaBlue p-6 sm:p-8 relative overflow-hidden h-full flex flex-col">
            <div className="absolute top-4 right-4 px-3 py-1 rounded-full bg-ccaBlue text-white text-xs font-bold">POPULAR</div>
            <div className="text-neutral-300 text-sm font-semibold mb-2">ALL‑ACCESS MEMBERSHIP</div>
            <div className="text-5xl sm:text-6xl font-extrabold mt-2">$87<span className="text-2xl font-semibold">/month</span></div>
            <div className="text-neutral-400 text-sm mt-2 mb-6">Site‑wide access to every Legacy+ creator</div>
            <div className="text-neutral-200 space-y-3 flex-1">
              <div className="flex items-center gap-3"><svg className="w-5 h-5 text-ccaBlue" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/></svg>Complete access to all Legacy Creator profiles</div>
              <div className="flex items-center gap-3"><svg className="w-5 h-5 text-ccaBlue" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/></svg>All assets, job opportunities, and marketplace access</div>
              <div className="flex items-center gap-3"><svg className="w-5 h-5 text-ccaBlue" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/></svg>Includes everything in Monthly Membership</div>
            </div>
            <button
              className="cta-button mt-8 w-full text-lg py-4"
              onClick={() => startCheckout('membership87')}
              disabled={loading !== null}
            >{loading === 'membership87' ? 'Redirecting...' : 'Join All‑Access'}</button>
          </div>
        </div>

        <div className="mt-6 text-center text-sm text-neutral-400">14‑day refund policy • 96% satisfaction rating • Instant access</div>
      </div>
      <StripeEmbeddedCheckout plan={checkoutPlan} isOpen={!!checkoutPlan} onClose={() => setCheckoutPlan(null)} />
    </div>
  );
}


