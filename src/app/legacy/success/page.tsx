import Link from 'next/link';

type PageProps = {
  searchParams: Promise<{ creatorId?: string } | Record<string, any>>;
};

async function getCreator(creatorId?: string) {
  if (!creatorId) return null;
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || ''}/api/legacy/creators/${encodeURIComponent(creatorId)}`, { cache: 'no-store' });
    if (!res.ok) return null;
    const json = await res.json();
    return json?.creator || null;
  } catch {
    return null;
  }
}

export default async function LegacySuccessPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const creatorId = (sp as any)?.creatorId as string | undefined;
  const creator = await getCreator(creatorId);

  const title = creator ? `You’re subscribed to ${creator.displayName}!` : 'Subscription successful!';
  const subtitle = creator ? `Thanks for supporting ${creator.displayName}.` : 'Thanks for supporting our creators!';
  const kitHref = creator ? `/creator-kits/${encodeURIComponent(creator.kitSlug || creator.id)}` : '/creator-kits';

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="max-w-xl w-full bg-neutral-900 border border-neutral-800 rounded-xl p-8 text-center">
        <div className="mx-auto mb-4 w-12 h-12 rounded-full bg-green-600/20 text-green-400 flex items-center justify-center">✓</div>
        <h1 className="text-2xl font-bold text-white mb-2">{title}</h1>
        <p className="text-neutral-400 mb-6">{subtitle}</p>
        <div className="flex items-center justify-center gap-3">
          <Link href={kitHref} className="px-5 py-2.5 rounded-lg bg-ccaBlue text-white hover:bg-ccaBlue/90">Go to creator kit</Link>
          <Link href="/" className="px-5 py-2.5 rounded-lg border border-neutral-700 text-white hover:bg-neutral-800">Back to home</Link>
        </div>
      </div>
    </div>
  );
}

export const dynamic = 'force-dynamic';


