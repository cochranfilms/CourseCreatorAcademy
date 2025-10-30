"use client";
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const links = [
  { href: '/home', label: "What's New" },
  { href: '/learn', label: 'Learn' },
  { href: '/show', label: 'FTF Show' },
  { href: '/opportunities', label: 'Opportunities' },
  { href: '/assets', label: 'Assets' },
  { href: '/marketplace', label: 'Marketplace' },
  { href: '/discounts', label: 'Discounts' }
];

export function SiteHeader() {
  const pathname = usePathname();
  return (
    <div className="sticky top-0 z-50 backdrop-blur supports-[backdrop-filter]:bg-black/60 border-b border-neutral-900">
      <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
        <Link href="/">
          <div className="flex items-center gap-3">
            <Image src="/logo-cca.png" alt="CCA" width={140} height={36} />
            <span className="hidden md:inline text-sm text-neutral-400">Course Creator Academy</span>
          </div>
        </Link>
        <nav className="hidden md:flex gap-2">
          {links.map((l) => {
            const active = pathname === l.href;
            return (
              <Link key={l.href} href={l.href as any} className={`px-3 py-1.5 rounded-full text-sm ${active ? 'bg-ccaBlue text-white' : 'bg-neutral-900 text-neutral-300 hover:bg-neutral-800'}`}>
                {l.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}


