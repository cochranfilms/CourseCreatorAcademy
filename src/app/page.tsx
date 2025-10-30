"use client";
import Image from 'next/image';
import { Trustbar } from '@/components/Trustbar';
import { FAQ } from '@/components/FAQ';
import { StickyCTA } from '@/components/StickyCTA';

export default function Page() {
  const handleJoin = async () => {
    const res = await fetch('/api/checkout/course', { method: 'POST' });
    const data = await res.json();
    if (data.url) {
      window.location.href = data.url;
    }
  };

  const categories = ['Lighting','Composition','Cinematography','Editing','Audio','Business','YouTube','Weddings','Real Estate','Commercial','Travel','Photo','Color','FPV','After Effects','Gear'];
  const perks = ['Software Discounts','Private Community','Case Studies','Mentorship Calls','Video Contests','Budget Calculator','100+ Custom SFX','Keyboard Shortcuts','Access to Future Content'];

  return (
    <main className="min-h-screen">
      <header className="max-w-6xl mx-auto px-6 py-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Image src="/logo-cca.png" width={160} height={40} alt="Course Creator Academy" />
        </div>
        <button className="cta-button" onClick={handleJoin}>Join Now</button>
      </header>

      <section className="max-w-6xl mx-auto px-6 pt-10 pb-16 grid md:grid-cols-2 gap-8 items-center">
        <div>
          <div className="inline-block px-3 py-1 rounded-full bg-ccaBlue/15 text-ccaBlue text-sm mb-4">NEW: Creator Marketplace Included</div>
          <h1 className="text-5xl md:text-6xl font-extrabold leading-tight">The Ultimate Online Creator School</h1>
          <p className="mt-5 text-lg text-neutral-300">Plan, shoot, edit, and sell high‑quality courses. Join our community and marketplace.</p>
          <div className="mt-8 flex gap-4">
            <button className="cta-button" onClick={handleJoin}>Get Access</button>
            <a className="px-6 py-3 rounded-lg border border-neutral-700" href="#pricing">See Pricing</a>
          </div>
          <div className="mt-6 text-sm text-neutral-400">14‑day refund policy • Instant access</div>
        </div>
        <div className="flex justify-center">
          <div className="w-full max-w-[420px] aspect-[9/16] rounded-xl overflow-hidden border border-neutral-800 bg-black">
            <iframe
              className="w-full h-full"
              src="https://www.youtube.com/embed/3-msojt4yuk?start=9&rel=0&modestbranding=1"
              title="CCA Promo Video"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              referrerPolicy="strict-origin-when-cross-origin"
              allowFullScreen
            />
          </div>
        </div>
      </section>

      <Trustbar />

      <section id="curriculum" className="max-w-6xl mx-auto px-6 py-16">
        <h2 className="text-3xl font-bold">What's Inside</h2>
        <p className="text-neutral-300 mt-2">A complete curriculum for creators.</p>
        <div className="mt-8 grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {categories.map((c) => (
            <div key={c} className="px-4 py-3 rounded-xl border border-neutral-800 bg-neutral-950 text-sm">{c}</div>
          ))}
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 py-16">
        <h2 className="text-3xl font-bold">Included Bonus Perks</h2>
        <div className="mt-8 grid sm:grid-cols-2 md:grid-cols-3 gap-4">
          {perks.map((p) => (
            <div key={p} className="rounded-2xl border border-neutral-800 bg-neutral-950 p-5 text-neutral-200">{p}</div>
          ))}
        </div>
      </section>

      <section id="pricing" className="max-w-6xl mx-auto px-6 py-16">
        <h2 className="text-3xl font-bold">That's $5,000 of value for only</h2>
        <div className="mt-8 grid md:grid-cols-2 gap-6">
          <div className="rounded-2xl border border-neutral-800 bg-neutral-950 p-6">
            <div className="text-neutral-400 text-sm">MONTHLY MEMBERSHIP</div>
            <div className="text-5xl font-extrabold mt-2">$37<span className="text-xl font-semibold">/month</span></div>
            <ul className="mt-4 text-sm text-neutral-300 space-y-2 list-disc list-inside">
              <li>Stream all videos</li>
              <li>Access future content</li>
              <li>Community + downloads</li>
            </ul>
            <button className="cta-button mt-6 w-full" onClick={handleJoin}>Join Now</button>
          </div>
          <div className="rounded-2xl border border-ccaBlue bg-ccaBlue/10 p-6">
            <div className="text-neutral-300 text-sm">ANNUAL MEMBERSHIP</div>
            <div className="text-5xl font-extrabold mt-2">$25<span className="text-xl font-semibold">/month</span></div>
            <ul className="mt-4 text-sm text-neutral-200 space-y-2 list-disc list-inside">
              <li>Save 25% (billed annually)</li>
              <li>All monthly benefits</li>
            </ul>
            <button className="cta-button mt-6 w-full" onClick={handleJoin}>Join Annually</button>
          </div>
        </div>
        <div className="mt-4 text-sm text-neutral-400">14‑day refund policy • 96% satisfaction rating</div>
      </section>

      <section className="max-w-6xl mx-auto px-6 py-16">
        <h2 className="text-3xl font-bold">What our members say</h2>
        <div className="mt-8 grid sm:grid-cols-2 md:grid-cols-3 gap-4">
          {[1,2,3,4,5,6].map((i) => (
            <div key={i} className="rounded-2xl border border-neutral-800 bg-neutral-950 p-5 text-sm text-neutral-300">“This program changed how I create and sell.”</div>
          ))}
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 py-16">
        <h2 className="text-3xl font-bold">FAQ</h2>
        <div className="mt-6">
          <FAQ items={[
            { q: 'How fast do I get access?', a: 'Instant access after successful checkout.' },
            { q: 'Can I cancel?', a: 'Yes, cancel any time from your account portal.' },
            { q: 'Do you offer refunds?', a: 'Full refunds within 14 days of purchase.' }
          ]} />
        </div>
      </section>

      <footer className="border-t border-neutral-800 py-10 text-center text-neutral-400">© {new Date().getFullYear()} Course Creator Academy</footer>

      <StickyCTA />
    </main>
  );
}


