"use client";
import { useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';

function SuccessContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const listingId = searchParams.get('listingId') || '';

  useEffect(() => {
    const t = setTimeout(() => router.prefetch('/orders'), 0);
    return () => clearTimeout(t);
  }, [router]);

  return (
    <main className="min-h-screen max-w-xl mx-auto px-4 py-16 text-center">
      <h1 className="text-3xl font-bold mb-2">Payment successful</h1>
      <p className="text-neutral-400 mb-6">Thanks for your purchase.</p>
      {listingId ? (
        <p className="text-sm text-neutral-400 mb-8">Listing ID: <span className="font-mono">{listingId}</span></p>
      ) : null}
      <div className="flex items-center justify-center gap-3">
        <Link href="/orders" className="px-5 py-2 bg-white text-black border-2 border-ccaBlue">View your order</Link>
        <Link href="/marketplace" className="px-5 py-2 bg-neutral-900 border border-neutral-700 text-white">Back to marketplace</Link>
      </div>
    </main>
  );
}

export default function CheckoutSuccessPage() {
  return (
    <Suspense fallback={<main className="min-h-screen max-w-xl mx-auto px-4 py-16 text-center"><p className="text-neutral-400">Loading…</p></main>}>
      <SuccessContent />
    </Suspense>
  );
}


