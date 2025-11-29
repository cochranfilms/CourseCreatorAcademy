import Link from 'next/link';

export default function CheckoutCanceledPage() {
  return (
    <main className="min-h-screen max-w-xl mx-auto px-4 py-16 text-center">
      <h1 className="text-3xl font-bold mb-2">Payment canceled</h1>
      <p className="text-neutral-400 mb-8">Your card was not charged.</p>
      <div className="flex items-center justify-center gap-3">
        <Link href="/marketplace" className="px-5 py-2 bg-neutral-900 border border-neutral-700 text-white">Back to marketplace</Link>
        <Link href="/orders" className="px-5 py-2 bg-neutral-900 border border-neutral-700 text-white">View orders</Link>
      </div>
    </main>
  );
}


