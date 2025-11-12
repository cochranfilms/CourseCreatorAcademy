"use client";
import Image from 'next/image';
import { useState } from 'react';
import { Trustbar } from '@/components/Trustbar';
import { FAQ } from '@/components/FAQ';
import { StickyCTA } from '@/components/StickyCTA';
import { useAuth } from '@/contexts/AuthContext';
import { PricingModal } from '@/components/PricingModal';
import { StripeEmbeddedCheckout } from '@/components/StripeEmbeddedCheckout';

export default function Page() {
  const [activeTab, setActiveTab] = useState<'learn' | 'community' | 'opportunities' | 'marketplace'>('learn');
  const { user } = useAuth();
  const [showPricing, setShowPricing] = useState(false);
  const [checkoutPlan, setCheckoutPlan] = useState<null | 'monthly37' | 'membership87'>(null);

  const openPricing = () => setShowPricing(true);

  const startMonthly = () => setCheckoutPlan('monthly37');

  const startAllAccess = () => setCheckoutPlan('membership87');

  const categories = ['Lighting','Composition','Cinematography','Editing','Audio','Business','YouTube','Weddings','Real Estate','Commercial','Travel','Photo','Color','FPV','After Effects','Gear'];
  const perks = ['Software Discounts','Private Community','Case Studies','Mentorship Calls','Video Contests','Budget Calculator','100+ Custom SFX','Keyboard Shortcuts','Access to Future Content'];

  const testimonials = [
    {
      quote: "This platform LITERALLY pays for itself.",
      author: "Emily S",
      role: "CCA Member",
      revenue: "$100K+"
    },
    {
      quote: "Officially at 100k/mo recurring with our agency at 18 years old.",
      author: "Xavier C",
      role: "XC Productions",
      revenue: "$100K/mo"
    },
    {
      quote: "We hit 500k in revenue for 2024 in the 2 areas we service.",
      author: "Tyler F",
      role: "Owner, TFREP Media",
      revenue: "$500K+"
    },
    {
      quote: "FTF has been one of the best investments I have made.",
      author: "Trevor M",
      role: "Creator, Filmmaker",
      revenue: null
    }
  ];

  return (
    <main className="min-h-screen w-full overflow-x-hidden">
      {/* Hero Section */}
      <section className="relative max-w-7xl mx-auto px-4 sm:px-6 pt-16 pb-24 w-full">
        <div className="relative z-10 text-center max-w-5xl mx-auto">
          <div className="inline-block px-4 py-2 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 text-white text-sm font-medium mb-6">
            Learn from Creators. Land Gigs. Save on Gear & Software.
          </div>
          <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-extrabold leading-[1.1] mb-6 tracking-tight text-white drop-shadow-2xl">
            YOUR CREATIVE<br />
            <span className="text-white">HOME BASE</span>
          </h1>
          <p className="text-xl sm:text-2xl text-neutral-300 mb-8 max-w-3xl mx-auto">
            Course Creator Academy is a creator-powered community hub where creators of all skill levels can learn, collaborate, grow their network, and stay creatively active.
          </p>
          
          {/* Video Player */}
          <div className="mt-12 mb-8 w-full max-w-5xl mx-auto">
            <div className="relative aspect-video rounded-2xl overflow-hidden border-2 border-neutral-800 bg-black shadow-2xl">
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

          {/* Testimonial Quote */}
          <div className="mt-8 mb-6">
            <p className="text-lg text-neutral-300 italic">"This platform LITERALLY pays for itself."</p>
            <p className="text-sm text-neutral-500 mt-2">— Emily S, CCA Member</p>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mt-10">
            <button className="cta-button text-lg px-8 py-4" onClick={openPricing}>Sign Up Now</button>
            <a className="px-8 py-4 rounded-lg border-2 border-neutral-700 hover:border-neutral-600 text-lg font-medium transition" href="#pricing">See Pricing</a>
          </div>
          <div className="mt-6 text-sm text-neutral-400">14‑day refund policy • Instant access • Rated Excellent</div>
        </div>
      </section>

      {/* Trust Bar removed per request */}

      {/* Platform Overview - Tabbed Section */}
      <section className="relative max-w-7xl mx-auto px-4 sm:px-6 py-24 w-full">
        <div className="text-center mb-16">
          <h2 className="text-4xl sm:text-5xl md:text-6xl font-extrabold mb-4 text-white drop-shadow-lg">
            EVERYTHING CREATORS NEED.<br />
            <span className="text-white">ALL IN ONE SLEEK PLATFORM.</span>
          </h2>
          <p className="text-xl text-neutral-400 max-w-3xl mx-auto">
            Course Creator Academy 2.0 is a creator-powered community hub where creators of all skill levels can learn, collaborate, grow their network, and stay creative.
          </p>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap justify-center gap-4 mb-12 border-b border-neutral-800 pb-4">
          {[
            { id: 'learn', label: 'Learning' },
            { id: 'community', label: 'Community' },
            { id: 'opportunities', label: 'Job Board' },
            { id: 'marketplace', label: 'Marketplace' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-6 py-3 rounded-lg font-semibold transition-all ${
                activeTab === tab.id
                  ? 'bg-gradient-to-r from-ccaBlue to-purple-500 text-white'
                  : 'bg-neutral-900 text-neutral-400 hover:text-white hover:bg-neutral-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="min-h-[400px]">
          {activeTab === 'learn' && (
            <div className="bg-gradient-to-br from-neutral-950 to-neutral-900 rounded-2xl border border-neutral-800 p-8 md:p-12">
              <div className="grid md:grid-cols-2 gap-12 items-center">
                <div>
                  <div className="text-xs text-ccaBlue font-semibold mb-4">FILM SCHOOL FOR ALL</div>
                  <h3 className="text-3xl sm:text-4xl font-bold mb-4">Unlock 800+ Videos and Hundreds of Hours</h3>
                  <p className="text-lg text-neutral-300 mb-6">
                    Expert-led training covering everything from filmmaking fundamentals to advanced techniques and business strategies. Discover professional-level skills across all categories.
                  </p>
                  <button className="inline-flex items-center gap-2 text-ccaBlue font-semibold hover:gap-3 transition-all">
                    Discover More
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {categories.slice(0, 6).map((cat) => (
                    <div key={cat} className="aspect-video bg-neutral-900 rounded-xl border border-neutral-800 flex items-center justify-center p-4 hover:border-ccaBlue/50 transition">
                      <span className="text-sm font-medium text-center">{cat}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'community' && (
            <div className="bg-gradient-to-br from-neutral-950 to-neutral-900 rounded-2xl border border-neutral-800 p-8 md:p-12">
              <div className="grid md:grid-cols-2 gap-12 items-center">
                <div>
                  <div className="text-xs text-purple-400 font-semibold mb-4">THE CCA COMMUNITY</div>
                  <h3 className="text-3xl sm:text-4xl font-bold mb-4">Join a Thriving Community</h3>
                  <p className="text-lg text-neutral-300 mb-6">
                    Connect with thousands of creators to network, collaborate, troubleshoot, and get feedback on your work. Build real connections with like-minded peers.
                  </p>
                  <button className="inline-flex items-center gap-2 text-purple-400 font-semibold hover:gap-3 transition-all">
                    Discover More
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
                <div className="space-y-4">
                  <div className="bg-neutral-900 rounded-xl border border-neutral-800 p-6">
                    <div className="text-4xl font-bold text-white mb-2">25,000+</div>
                    <div className="text-neutral-400">Active Members</div>
                  </div>
                  <div className="bg-neutral-900 rounded-xl border border-neutral-800 p-6">
                    <div className="text-4xl font-bold text-white mb-2">Live</div>
                    <div className="text-neutral-400">Weekly Q&A Sessions</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'opportunities' && (
            <div className="bg-gradient-to-br from-neutral-950 to-neutral-900 rounded-2xl border border-neutral-800 p-8 md:p-12">
              <div className="grid md:grid-cols-2 gap-12 items-center">
                <div>
                  <div className="text-xs text-orange-400 font-semibold mb-4">INTEGRATED JOB BOARD</div>
                  <h3 className="text-3xl sm:text-4xl font-bold mb-4">Find Paid Gigs or Hire Talent</h3>
                  <p className="text-lg text-neutral-300 mb-6">
                    Whether you're building your team or booking your next client, the job board makes it easy to connect and collaborate, with curated listings and AI-generated summaries.
                  </p>
                  <button className="inline-flex items-center gap-2 text-orange-400 font-semibold hover:gap-3 transition-all">
                    Discover More
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
                <div className="space-y-4">
                  <div className="bg-neutral-900 rounded-xl border border-neutral-800 p-6">
                    <div className="text-4xl font-bold text-white mb-2">$2.3M+</div>
                    <div className="text-neutral-400">Total Deals Closed in 2024</div>
                  </div>
                  <div className="bg-neutral-900 rounded-xl border border-neutral-800 p-6">
                    <div className="text-4xl font-bold text-white mb-2">$150K</div>
                    <div className="text-neutral-400">Biggest Deal Closed</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'marketplace' && (
            <div className="bg-gradient-to-br from-neutral-950 to-neutral-900 rounded-2xl border border-neutral-800 p-8 md:p-12">
              <div className="grid md:grid-cols-2 gap-12 items-center">
                <div>
                  <div className="text-xs text-pink-400 font-semibold mb-4">TRADE GEAR WITH CREATORS</div>
                  <h3 className="text-3xl sm:text-4xl font-bold mb-4">Buy and Sell Gear Directly</h3>
                  <p className="text-lg text-neutral-300 mb-6">
                    An easy, trusted way for creators to trade equipment, upgrade their setup, and support each other's growth. All within the community.
                  </p>
                  <button className="inline-flex items-center gap-2 text-pink-400 font-semibold hover:gap-3 transition-all">
                    Discover More
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {['Cameras', 'Lenses', 'Lighting', 'Audio'].map((item) => (
                    <div key={item} className="aspect-square bg-neutral-900 rounded-xl border border-neutral-800 flex items-center justify-center p-4 hover:border-pink-400/50 transition">
                      <span className="text-sm font-medium text-center">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Pricing Section - moved up above Creator Kits */}
      <section id="pricing" className="relative max-w-7xl mx-auto px-4 sm:px-6 py-24 pb-safe w-full">
        <div className="text-center mb-16">
          <h2 className="text-4xl sm:text-5xl md:text-6xl font-extrabold mb-4 text-white drop-shadow-lg">
            A SIMPLE PLAN THAT<br />
            <span className="text-white">UNLOCKS EVERYTHING</span>
          </h2>
          <p className="text-xl text-neutral-400 max-w-3xl mx-auto">
            Join over 50,000 members who have been growing with us since 2017.
          </p>
        </div>

        <div className="max-w-4xl mx-auto grid md:grid-cols-2 gap-8 items-stretch">
          <div className="bg-gradient-to-br from-neutral-950 to-neutral-900 rounded-2xl border border-neutral-800 p-8 h-full flex flex-col">
            <div className="text-neutral-400 text-sm font-semibold mb-2">MONTHLY MEMBERSHIP</div>
            <div className="text-6xl font-extrabold mt-2">$37<span className="text-2xl font-semibold">/month</span></div>
            <ul className="mt-6 text-neutral-300 space-y-3 flex-1">
              <li className="flex items-center gap-3">
                <svg className="w-5 h-5 text-ccaBlue" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Stream all videos
              </li>
              <li className="flex items-center gap-3">
                <svg className="w-5 h-5 text-ccaBlue" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Access future content
              </li>
              <li className="flex items-center gap-3">
                <svg className="w-5 h-5 text-ccaBlue" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Community + downloads
              </li>
            </ul>
          <div className="flex-1" />
          <button className="cta-button mt-8 w-full text-lg py-4" onClick={startMonthly}>Join Now</button>
          </div>

          <div className="bg-gradient-to-br from-ccaBlue/20 via-purple-500/20 to-pink-500/20 rounded-2xl border-2 border-ccaBlue p-8 relative overflow-hidden h-full flex flex-col">
            <div className="absolute top-4 right-4 px-3 py-1 rounded-full bg-ccaBlue text-white text-xs font-bold">POPULAR</div>
            <div className="text-neutral-300 text-sm font-semibold mb-2">ALL‑ACCESS MEMBERSHIP</div>
            <div className="text-6xl font-extrabold mt-2">$87<span className="text-2xl font-semibold">/month</span></div>
            <div className="text-neutral-400 text-sm mt-2 mb-6">Site‑wide access to every Legacy+ creator</div>
            <ul className="text-neutral-200 space-y-3 flex-1">
              <li className="flex items-center gap-3">
                <svg className="w-5 h-5 text-ccaBlue" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Complete access to all Legacy Creator profiles
              </li>
              <li className="flex items-center gap-3">
                <svg className="w-5 h-5 text-ccaBlue" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                All assets, job opportunities, and marketplace access
              </li>
              <li className="flex items-center gap-3">
                <svg className="w-5 h-5 text-ccaBlue" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Includes everything in Monthly Membership
              </li>
            </ul>
            <button className="cta-button mt-8 w-full text-lg py-4" onClick={startAllAccess}>Join All‑Access</button>
          </div>
        </div>
        <div className="mt-8 text-center text-sm text-neutral-400">14‑day refund policy • 96% satisfaction rating • Instant access</div>
      </section>

      {/* Creator Kits Section */}
      <section className="relative max-w-7xl mx-auto px-4 sm:px-6 py-24 w-full">
        <div className="text-center mb-16">
          <h2 className="text-4xl sm:text-5xl md:text-6xl font-extrabold mb-4 text-white drop-shadow-lg">
            BRINGING THE<br />
            <span className="text-white">A-CREW TO SET</span>
          </h2>
          <p className="text-xl text-neutral-400 max-w-3xl mx-auto">
            Say hello to Creator Kits — exclusive content drops by the industry's top creators which you won't find anywhere else.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mb-12">
          {[
            { title: 'EXCLUSIVE CONTENT', desc: 'Learn directly from top industry creators through exclusive content created specifically for this platform.', icon: '🎬' },
            { title: 'ASSETS', desc: 'Get access to the exact assets top creators use - including LUTs, presets, overlays, transitions, SFX, and plugins.', icon: '🎨' },
            { title: 'GEAR', desc: 'Explore the exact gear top creators rely on for their professional work - from photography to lighting setups.', icon: '📷' }
          ].map((kit) => (
            <div key={kit.title} className="bg-gradient-to-br from-neutral-950 to-neutral-900 rounded-2xl border border-neutral-800 p-8 hover:border-ccaBlue/50 transition">
              <div className="text-4xl mb-4">{kit.icon}</div>
              <h3 className="text-xl font-bold mb-3">{kit.title}</h3>
              <p className="text-neutral-400">{kit.desc}</p>
            </div>
          ))}
        </div>

        {/* All Creator Kits (shows all creators with at least 3 samples) */}
        {typeof window !== 'undefined' && (() => {
          const C = require('@/components/CreatorKitsRail').CreatorKitsRail; 
          return <C showAll={true} showSamplesOnly={true} />;
        })()}

        {/* Personalized Creator Kits rail (only for subscribed kits) */}
        {typeof window !== 'undefined' && (() => {
          const C = require('@/components/CreatorKitsRail').CreatorKitsRail; 
          return <C showAll={false} />;
        })()}
      </section>

      {/* Testimonials Section */}
      <section className="relative max-w-7xl mx-auto px-4 sm:px-6 py-24 w-full">
        <div className="text-center mb-16">
          <h2 className="text-4xl sm:text-5xl md:text-6xl font-extrabold mb-4 text-white drop-shadow-lg">HEAR FROM OUR MEMBERS</h2>
          <p className="text-xl text-neutral-400">We've helped hundreds of our members grow and turn filmmaking into their fulltime career.</p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-12">
          {testimonials.map((testimonial, idx) => (
            <div key={idx} className="bg-gradient-to-br from-neutral-950 to-neutral-900 rounded-2xl border border-neutral-800 p-8 hover:border-ccaBlue/50 transition">
              {testimonial.revenue && (
                <div className="text-3xl font-bold text-ccaBlue mb-4">{testimonial.revenue}</div>
              )}
              <p className="text-lg text-neutral-200 mb-4 italic">"{testimonial.quote}"</p>
              <div>
                <div className="font-semibold text-white">{testimonial.author}</div>
                <div className="text-sm text-neutral-400">{testimonial.role}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="grid md:grid-cols-3 gap-6 text-center">
          <div className="bg-gradient-to-br from-neutral-950 to-neutral-900 rounded-2xl border border-neutral-800 p-8">
            <div className="text-4xl font-bold text-ccaBlue mb-2">$150K</div>
            <div className="text-neutral-400">Biggest Deal Closed By Members in 2024</div>
          </div>
          <div className="bg-gradient-to-br from-neutral-950 to-neutral-900 rounded-2xl border border-neutral-800 p-8">
            <div className="text-4xl font-bold text-ccaBlue mb-2">$2.3M</div>
            <div className="text-neutral-400">Total Deal Closed By Members in 2024</div>
          </div>
          <div className="bg-gradient-to-br from-neutral-950 to-neutral-900 rounded-2xl border border-neutral-800 p-8">
            <div className="text-4xl font-bold text-ccaBlue mb-2">&lt;1 YEAR</div>
            <div className="text-neutral-400">Time it took 46% of the community to 10X ROI</div>
          </div>
        </div>
      </section>

      {/* What's Inside Section */}
      <section id="curriculum" className="relative max-w-7xl mx-auto px-4 sm:px-6 py-24 w-full">
        <div className="text-center mb-12">
          <h2 className="text-4xl sm:text-5xl md:text-6xl font-extrabold mb-4 text-white drop-shadow-lg">WHAT'S INSIDE</h2>
          <p className="text-xl text-neutral-400">A complete curriculum for creators.</p>
        </div>
        <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {categories.map((c) => (
            <div key={c} className="px-6 py-4 rounded-xl border border-neutral-800 bg-gradient-to-br from-neutral-950 to-neutral-900 text-sm font-medium hover:border-ccaBlue/50 hover:bg-neutral-900 transition">
              {c}
            </div>
          ))}
        </div>
      </section>

      {/* Pricing Section moved above */}

      {/* Included Perks */}
      <section className="relative max-w-7xl mx-auto px-4 sm:px-6 py-24 w-full">
        <div className="text-center mb-12">
          <h2 className="text-4xl sm:text-5xl md:text-6xl font-extrabold mb-4 text-white drop-shadow-lg">INCLUDED BONUS PERKS</h2>
        </div>
        <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
          {perks.map((p) => (
            <div key={p} className="rounded-2xl border border-neutral-800 bg-gradient-to-br from-neutral-950 to-neutral-900 p-6 text-neutral-200 hover:border-ccaBlue/50 transition">
              <div className="flex items-center gap-3">
                <svg className="w-5 h-5 text-ccaBlue flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="font-medium">{p}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ Section */}
      <section className="relative max-w-4xl mx-auto px-4 sm:px-6 py-24 w-full">
        <div className="text-center mb-12">
          <h2 className="text-4xl sm:text-5xl md:text-6xl font-extrabold mb-4 text-white drop-shadow-lg">FREQUENTLY ASKED QUESTIONS</h2>
        </div>
        <div>
          <FAQ items={[
            { q: 'How fast do I get access?', a: 'Instant access after successful checkout. You\'ll be able to start learning immediately.' },
            { q: 'Can I cancel?', a: 'Yes, cancel any time from your account portal. No questions asked, no hidden fees.' },
            { q: 'Do you offer refunds?', a: 'Full refunds within 14 days of purchase. We want you to be completely satisfied.' },
            { q: 'What if I\'m a beginner?', a: 'Perfect! Our curriculum is designed for all skill levels, from complete beginners to advanced creators.' },
            { q: 'How often is new content added?', a: 'We add new content monthly, including tutorials, creator kits, and exclusive resources.' }
          ]} />
        </div>
      </section>

      {/* Final CTA */}
      <section className="relative max-w-7xl mx-auto px-4 sm:px-6 py-24 w-full">
        <div className="bg-white/10 backdrop-blur-sm rounded-3xl border-2 border-white/20 p-12 md:p-16 text-center">
          <h2 className="text-4xl sm:text-5xl md:text-6xl font-extrabold mb-6 text-white">
            ACCESS YOUR<br />
            <span className="text-white">CREATIVE HOMEBASE</span>
          </h2>
          <p className="text-xl text-neutral-300 mb-8 max-w-2xl mx-auto">
            Learn from your favorite creators, save on the tools you already use, and supercharge your network so you can keep creating.
          </p>
          <button className="cta-button text-lg px-10 py-5" onClick={openPricing}>Sign Up Now</button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 py-10 text-center text-neutral-400 bg-black/40 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <p>© {new Date().getFullYear()} Course Creator Academy. All rights reserved.</p>
        </div>
      </footer>

      <div className="hidden sm:block">
        <StickyCTA />
      </div>
      <PricingModal isOpen={showPricing} onClose={() => setShowPricing(false)} />
      <StripeEmbeddedCheckout plan={checkoutPlan} isOpen={!!checkoutPlan} onClose={() => setCheckoutPlan(null)} />
    </main>
  );
}
