import Link from 'next/link';

export default function LegacyCanceledPage() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="max-w-xl w-full bg-neutral-900 border border-neutral-800 rounded-xl p-8 text-center">
        <div className="mx-auto mb-4 w-12 h-12 rounded-full bg-red-600/20 text-red-400 flex items-center justify-center">×</div>
        <h1 className="text-2xl font-bold text-white mb-2">Checkout canceled</h1>
        <p className="text-neutral-400 mb-6">Your Legacy+ subscription was not completed.</p>
        <div className="flex items-center justify-center gap-3">
          <Link href="/" className="px-5 py-2.5 rounded-lg border border-neutral-700 text-white hover:bg-neutral-800">Back to home</Link>
        </div>
      </div>
    </div>
  );
}

export const dynamic = 'force-dynamic';


