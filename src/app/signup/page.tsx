"use client";
import { useState } from 'react';
import Link from 'next/link';
import { StripeEmbeddedCheckout } from '@/components/StripeEmbeddedCheckout';

export default function SignupPage() {
  const [open, setOpen] = useState(false);
  const [plan, setPlan] = useState<'membership87' | 'monthly37' | null>(null);

  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-12 -mt-16">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">Join Creator Collective</h1>
          <p className="text-neutral-400">Choose a plan to get started. Your account is created at checkout.</p>
        </div>

        <div className="bg-neutral-950 border border-neutral-800 p-8">
          <div className="space-y-4">
            <button
              onClick={() => { setPlan('membership87'); setOpen(true); }}
              className="w-full bg-ccaBlue text-white py-3 font-semibold hover:opacity-90 transition"
            >
              Start Membership — $87/mo
            </button>
            <button
              onClick={() => { setPlan('monthly37'); setOpen(true); }}
              className="w-full bg-neutral-900 text-white py-3 font-semibold hover:bg-neutral-800 transition border border-neutral-700"
            >
              Start Monthly Plan — $37/mo
            </button>
          </div>

          <div className="mt-6 pt-6 border-t border-neutral-800 text-sm text-neutral-400 text-center">
            Already have an account?{' '}
            <Link href="/login" className="text-ccaBlue hover:text-ccaBlue/80 font-medium">
              Sign in
            </Link>
          </div>
        </div>
      </div>

      <StripeEmbeddedCheckout
        plan={plan}
        isOpen={open && Boolean(plan)}
        onClose={() => setOpen(false)}
      />
    </div>
  );
}
