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
  const [checkoutPlan, setCheckoutPlan] = useState<null | 'monthly37' | 'noFees60' | 'membership87'>(null);

  const openPricing = () => setShowPricing(true);

  const startMonthly = () => setCheckoutPlan('monthly37');
  const startNoFees = () => setCheckoutPlan('noFees60');
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

  const earningWays = [
    {
      title: "Land High-Paying Gigs",
      description: "Access exclusive job opportunities from brands and agencies. Our members have closed over $2.3M in deals this year alone.",
      icon: "💼",
      stat: "$150K",
      statLabel: "Biggest Single Deal",
      gradient: "from-orange-500/20 to-red-500/20",
      borderColor: "border-orange-500/50"
    },
    {
      title: "Sell Your Assets",
      description: "Monetize your LUTs, presets, overlays, and templates. Build passive income selling to thousands of creators.",
      icon: "🎨",
      stat: "0% Fees",
      statLabel: "On No-Fees Plan",
      gradient: "from-pink-500/20 to-rose-500/20",
      borderColor: "border-pink-500/50"
    },
    {
      title: "Trade Gear Profitably",
      description: "Buy and sell equipment directly with trusted creators. Upgrade your setup while building your network.",
      icon: "📷",
      stat: "Trusted",
      statLabel: "Creator Network",
      gradient: "from-purple-500/20 to-indigo-500/20",
      borderColor: "border-purple-500/50"
    },
    {
      title: "Save on Everything",
      description: "Exclusive discounts on software, gear, and services. The savings alone can cover your membership.",
      icon: "💰",
      stat: "Exclusive",
      statLabel: "Partner Deals",
      gradient: "from-green-500/20 to-emerald-500/20",
      borderColor: "border-green-500/50"
    }
  ];

  const platformFeatures = [
    {
      title: "Learn",
      subtitle: "800+ Expert-Led Videos",
      description: "Master professional skills from industry leaders. From fundamentals to advanced techniques across 16 categories.",
      icon: "🎓",
      color: "ccaBlue",
      link: "/learn"
    },
    {
      title: "Earn",
      subtitle: "Multiple Income Streams",
      description: "Job board, marketplace, asset sales. Our members have generated millions in revenue through the platform.",
      icon: "💵",
      color: "green-500",
      link: "/opportunities"
    },
    {
      title: "Connect",
      subtitle: "25,000+ Active Creators",
      description: "Join a thriving community. Network, collaborate, get feedback, and build relationships that last.",
      icon: "🤝",
      color: "purple-500",
      link: "/home"
    },
    {
      title: "Access",
      subtitle: "Exclusive Resources",
      description: "Assets, discounts, creator kits, and tools. Everything you need to level up your creative business.",
      icon: "🔑",
      color: "pink-500",
      link: "/marketplace"
    }
  ];

  return (
    <>
      {/* Structured Data for SEO */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "EducationalOrganization",
            "name": "Course Creator Academy",
            "description": "The #1 platform for creators to learn, earn, and grow. Join 50,000+ members accessing exclusive opportunities, courses, and resources.",
            "url": "https://coursecreatoracademy.com",
            "logo": "https://coursecreatoracademy.com/logo-cca.png",
            "sameAs": [
              "https://www.youtube.com/@coursecreatoracademy"
            ],
            "offers": {
              "@type": "Offer",
              "name": "Monthly Membership",
              "price": "37",
              "priceCurrency": "USD",
              "availability": "https://schema.org/InStock"
            },
            "aggregateRating": {
              "@type": "AggregateRating",
              "ratingValue": "4.8",
              "reviewCount": "1250"
            }
          })
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Course",
            "name": "Course Creator Academy",
            "description": "800+ expert-led video courses covering filmmaking, video production, cinematography, editing, and business strategies for creators.",
            "provider": {
              "@type": "Organization",
              "name": "Course Creator Academy",
              "sameAs": "https://coursecreatoracademy.com"
            },
            "courseCode": "CCA",
            "educationalLevel": "Beginner to Advanced",
            "numberOfCredits": "800+",
            "timeRequired": "P500H"
          })
        }}
      />

      <main className="min-h-screen w-full overflow-x-hidden">
        {/* Hero Section - Your Creative Home Base */}
        <section className="relative max-w-7xl mx-auto px-3 sm:px-4 md:px-6 pt-12 sm:pt-16 pb-16 sm:pb-24 w-full pt-safe">
          <div className="relative z-10 text-center max-w-5xl mx-auto">
            <div className="inline-block px-3 sm:px-4 py-1.5 sm:py-2 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 text-white text-xs sm:text-sm font-medium mb-4 sm:mb-6 animate-fade-in">
              Learn from Creators. Land Gigs. Save on Gear & Software.
            </div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl 2xl:text-8xl font-extrabold leading-[1.1] mb-4 sm:mb-6 tracking-tight text-white drop-shadow-2xl px-2">
              YOUR CREATIVE<br />
              <span className="text-white">HOME BASE</span>
            </h1>
            <p className="text-base sm:text-lg md:text-xl lg:text-2xl text-neutral-300 mb-6 sm:mb-8 max-w-3xl mx-auto px-3 leading-relaxed">
              This isn't just another course. This is your <span className="font-semibold text-white">real money-making opportunity</span> to learn from top creators, land high-paying gigs, and build a thriving creative business—all in one powerful platform.
            </p>
            
            {/* Video Player */}
            <div className="mt-8 sm:mt-12 mb-6 sm:mb-8 w-full max-w-5xl mx-auto px-2">
              <div className="relative aspect-video rounded-xl sm:rounded-2xl overflow-hidden border-2 border-neutral-800 bg-black shadow-2xl transform transition-transform hover:scale-[1.01]">
                <iframe
                  className="w-full h-full"
                  src="https://www.youtube.com/embed/3-msojt4yuk?start=9&rel=0&modestbranding=1"
                  title="Course Creator Academy - Your Creative Home Base"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  referrerPolicy="strict-origin-when-cross-origin"
                  allowFullScreen
                />
              </div>
            </div>

            {/* Testimonial Quote */}
            <div className="mt-6 sm:mt-8 mb-4 sm:mb-6 px-3">
              <p className="text-base sm:text-lg text-neutral-300 italic">"This platform LITERALLY pays for itself."</p>
              <p className="text-xs sm:text-sm text-neutral-500 mt-2">— Emily S, CCA Member</p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center items-center mt-8 sm:mt-10 px-3">
              <button className="cta-button text-base sm:text-lg px-6 sm:px-8 py-3 sm:py-4 w-full sm:w-auto touch-manipulation transform hover:scale-105 transition-transform" onClick={openPricing}>Start Your Opportunity</button>
              <a className="px-6 sm:px-8 py-3 sm:py-4 rounded-lg border-2 border-neutral-700 active:border-neutral-600 hover:border-neutral-600 text-base sm:text-lg font-medium transition w-full sm:w-auto text-center touch-manipulation" href="#pricing">See Plans</a>
            </div>
            <div className="mt-4 sm:mt-6 text-xs sm:text-sm text-neutral-400 px-3">14‑day refund policy • Instant access • Rated Excellent</div>
          </div>
        </section>

        {/* Money-Making Stats Section */}
        <section className="relative max-w-7xl mx-auto px-3 sm:px-4 md:px-6 py-12 sm:py-16 md:py-24 w-full">
          <div className="text-center mb-8 sm:mb-12 md:mb-16 px-2">
            <div className="inline-block px-4 py-2 rounded-full bg-green-500/20 border border-green-500/50 text-green-400 text-xs sm:text-sm font-semibold mb-6 sm:mb-8">
              REAL RESULTS FROM REAL CREATORS
            </div>
            <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-extrabold mb-3 sm:mb-4 text-white drop-shadow-lg leading-tight">
              THIS ISN'T JUST LEARNING.<br />
              <span className="bg-gradient-to-r from-green-400 via-emerald-400 to-teal-400 bg-clip-text text-transparent">THIS IS REAL MONEY.</span>
            </h2>
            <p className="text-sm sm:text-base md:text-lg lg:text-xl text-neutral-400 max-w-3xl mx-auto leading-relaxed">
              Our members aren't just watching videos—they're closing deals, building businesses, and transforming their careers.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 px-2">
            {[
              { value: "$2.3M+", label: "Total Deals Closed in 2024", icon: "💼", color: "from-green-500/20 to-emerald-500/20" },
              { value: "$150K", label: "Biggest Single Deal", icon: "🎯", color: "from-blue-500/20 to-cyan-500/20" },
              { value: "46%", label: "10X ROI in Under 1 Year", icon: "📈", color: "from-purple-500/20 to-pink-500/20" },
              { value: "50K+", label: "Active Members Since 2017", icon: "👥", color: "from-orange-500/20 to-red-500/20" }
            ].map((stat, idx) => (
              <div
                key={idx}
                className="bg-gradient-to-br from-neutral-950/90 to-neutral-900/90 backdrop-blur-sm rounded-xl sm:rounded-2xl border border-neutral-800 p-5 sm:p-6 md:p-8 text-center hover:border-ccaBlue/50 transition-all duration-300 hover:shadow-lg hover:shadow-ccaBlue/20 hover:-translate-y-1"
              >
                <div className="text-3xl sm:text-4xl mb-3">{stat.icon}</div>
                <div className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-ccaBlue mb-2">
                  {stat.value}
                </div>
                <div className="text-xs sm:text-sm text-neutral-400 font-medium">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* How Creators Earn Section */}
        <section className="relative max-w-7xl mx-auto px-3 sm:px-4 md:px-6 py-12 sm:py-16 md:py-24 w-full">
          <div className="text-center mb-8 sm:mb-12 md:mb-16 px-2">
            <div className="inline-block px-4 py-2 rounded-full bg-ccaBlue/20 border border-ccaBlue/50 text-ccaBlue text-xs sm:text-sm font-semibold mb-6 sm:mb-8">
              MULTIPLE WAYS TO EARN
            </div>
            <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-extrabold mb-3 sm:mb-4 text-white drop-shadow-lg leading-tight">
              HOW CREATORS MAKE<br />
              <span className="text-white">REAL MONEY HERE</span>
            </h2>
            <p className="text-sm sm:text-base md:text-lg lg:text-xl text-neutral-400 max-w-3xl mx-auto leading-relaxed">
              This platform isn't about passive learning—it's about active earning. Here's how our members turn opportunity into income.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-4 sm:gap-6 md:gap-8 px-2">
            {earningWays.map((way, idx) => (
              <div
                key={idx}
                className={`bg-gradient-to-br ${way.gradient} rounded-xl sm:rounded-2xl border-2 ${way.borderColor} p-6 sm:p-8 md:p-10 hover:shadow-xl hover:shadow-${way.borderColor.split('/')[0]}/20 transition-all duration-300 hover:-translate-y-1`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="text-4xl sm:text-5xl">{way.icon}</div>
                  <div className="text-right">
                    <div className="text-2xl sm:text-3xl font-bold text-white">{way.stat}</div>
                    <div className="text-xs sm:text-sm text-neutral-300">{way.statLabel}</div>
                  </div>
                </div>
                <h3 className="text-xl sm:text-2xl md:text-3xl font-bold text-white mb-3">{way.title}</h3>
                <p className="text-sm sm:text-base text-neutral-200 leading-relaxed">{way.description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Platform Features - Learn, Earn, Connect, Access */}
        <section className="relative max-w-7xl mx-auto px-3 sm:px-4 md:px-6 py-12 sm:py-16 md:py-24 w-full">
          <div className="text-center mb-8 sm:mb-12 md:mb-16 px-2">
            <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-extrabold mb-3 sm:mb-4 text-white drop-shadow-lg leading-tight">
              EVERYTHING YOU NEED TO<br />
              <span className="bg-gradient-to-r from-ccaBlue via-purple-500 to-pink-500 bg-clip-text text-transparent">SUCCEED AS A CREATOR</span>
            </h2>
            <p className="text-sm sm:text-base md:text-lg lg:text-xl text-neutral-400 max-w-3xl mx-auto leading-relaxed">
              One platform. Four pillars. Unlimited opportunity.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 px-2">
            {platformFeatures.map((feature, idx) => (
              <div
                key={idx}
                className="group bg-gradient-to-br from-neutral-950 to-neutral-900 rounded-xl sm:rounded-2xl border border-neutral-800 p-6 sm:p-8 hover:border-ccaBlue/50 transition-all duration-300 hover:shadow-lg hover:shadow-ccaBlue/20 hover:-translate-y-1"
              >
                <div className="text-4xl sm:text-5xl mb-4 transform group-hover:scale-110 transition-transform">{feature.icon}</div>
                <div className={`text-xs sm:text-sm font-semibold mb-2 text-${feature.color}`}>{feature.subtitle}</div>
                <h3 className="text-xl sm:text-2xl font-bold text-white mb-3">{feature.title}</h3>
                <p className="text-sm sm:text-base text-neutral-400 leading-relaxed mb-4">{feature.description}</p>
                <a href={feature.link} className="inline-flex items-center gap-2 text-ccaBlue font-semibold hover:gap-3 transition-all text-sm sm:text-base">
                  Explore
                  <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </a>
              </div>
            ))}
          </div>
        </section>

        {/* Pricing Section - A Simple Plan That Unlocks Everything */}
        <section id="pricing" className="relative max-w-7xl mx-auto px-3 sm:px-4 md:px-6 py-12 sm:py-16 md:py-24 pb-safe w-full">
          <div className="text-center mb-8 sm:mb-12 md:mb-16 px-2">
            <div className="inline-block px-4 py-2 rounded-full bg-white/10 border border-white/20 text-white text-xs sm:text-sm font-semibold mb-6 sm:mb-8">
              CHOOSE YOUR PATH
            </div>
            <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-extrabold mb-3 sm:mb-4 text-white drop-shadow-lg leading-tight">
              A SIMPLE PLAN THAT<br />
              <span className="text-white">UNLOCKS EVERYTHING</span>
            </h2>
            <p className="text-sm sm:text-base md:text-lg lg:text-xl text-neutral-400 max-w-3xl mx-auto leading-relaxed">
              Join over 50,000 members who have been growing with us since 2017. Start earning from day one.
            </p>
          </div>

          <div className="max-w-6xl mx-auto grid md:grid-cols-3 gap-4 sm:gap-6 md:gap-8 items-stretch px-2">
            <div className="bg-gradient-to-br from-neutral-950 to-neutral-900 rounded-xl sm:rounded-2xl border border-neutral-800 p-5 sm:p-6 md:p-8 h-full flex flex-col">
              <div className="text-neutral-400 text-xs sm:text-sm font-semibold mb-2">MONTHLY MEMBERSHIP</div>
              <div className="text-4xl sm:text-5xl md:text-6xl font-extrabold mt-2">$37<span className="text-lg sm:text-xl md:text-2xl font-semibold">/month</span></div>
              <ul className="mt-4 sm:mt-6 text-neutral-300 space-y-2 sm:space-y-3 flex-1 text-sm sm:text-base">
                <li className="flex items-center gap-2 sm:gap-3">
                  <svg className="w-4 h-4 sm:w-5 sm:h-5 text-ccaBlue flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Stream all videos
                </li>
                <li className="flex items-center gap-2 sm:gap-3">
                  <svg className="w-4 h-4 sm:w-5 sm:h-5 text-ccaBlue flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Access future content
                </li>
                <li className="flex items-center gap-2 sm:gap-3">
                  <svg className="w-4 h-4 sm:w-5 sm:h-5 text-ccaBlue flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Community + downloads
                </li>
                <li className="flex items-center gap-2 sm:gap-3">
                  <svg className="w-4 h-4 sm:w-5 sm:h-5 text-ccaBlue flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Job board & marketplace access
                </li>
              </ul>
              <div className="flex-1" />
              <button className="cta-button mt-6 sm:mt-8 w-full text-base sm:text-lg py-3 sm:py-4 touch-manipulation transform hover:scale-105 transition-transform" onClick={startMonthly}>Join Now</button>
            </div>

            <div className="bg-gradient-to-br from-green-500/20 via-emerald-500/20 to-teal-500/20 rounded-xl sm:rounded-2xl border-2 border-green-500/50 p-5 sm:p-6 md:p-8 relative overflow-hidden h-full flex flex-col">
              <div className="absolute top-3 sm:top-4 right-3 sm:right-4 px-2 sm:px-3 py-0.5 sm:py-1 rounded-full bg-green-500 text-white text-[10px] sm:text-xs font-bold">BEST VALUE</div>
              <div className="text-neutral-300 text-xs sm:text-sm font-semibold mb-2">NO-FEES MEMBERSHIP</div>
              <div className="text-4xl sm:text-5xl md:text-6xl font-extrabold mt-2">$60<span className="text-lg sm:text-xl md:text-2xl font-semibold">/month</span></div>
              <div className="text-neutral-400 text-xs sm:text-sm mt-2 mb-4 sm:mb-6">Skip all platform fees</div>
              <ul className="text-neutral-200 space-y-2 sm:space-y-3 flex-1 text-sm sm:text-base">
                <li className="flex items-start gap-2 sm:gap-3">
                  <svg className="w-4 h-4 sm:w-5 sm:h-5 text-green-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Includes everything in Monthly Membership
                </li>
                <li className="flex items-start gap-2 sm:gap-3">
                  <svg className="w-4 h-4 sm:w-5 sm:h-5 text-green-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="font-semibold">0% platform fee</span> on marketplace sales
                </li>
                <li className="flex items-start gap-2 sm:gap-3">
                  <svg className="w-4 h-4 sm:w-5 sm:h-5 text-green-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="font-semibold">0% platform fee</span> on job listings
                </li>
                <li className="flex items-start gap-2 sm:gap-3 text-xs text-neutral-400 mt-2">
                  <svg className="w-3 h-3 sm:w-4 sm:h-4 text-neutral-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  </svg>
                  You still pay Stripe processing fees (~2.9% + $0.30)
                </li>
              </ul>
              <button className="cta-button mt-6 sm:mt-8 w-full text-base sm:text-lg py-3 sm:py-4 touch-manipulation bg-green-600 hover:bg-green-700 transform hover:scale-105 transition-transform" onClick={startNoFees}>Join No-Fees</button>
            </div>

            <div className="bg-gradient-to-br from-ccaBlue/20 via-purple-500/20 to-pink-500/20 rounded-xl sm:rounded-2xl border-2 border-ccaBlue p-5 sm:p-6 md:p-8 relative overflow-hidden h-full flex flex-col">
              <div className="absolute top-3 sm:top-4 right-3 sm:right-4 px-2 sm:px-3 py-0.5 sm:py-1 rounded-full bg-ccaBlue text-white text-[10px] sm:text-xs font-bold">POPULAR</div>
              <div className="text-neutral-300 text-xs sm:text-sm font-semibold mb-2">ALL‑ACCESS MEMBERSHIP</div>
              <div className="text-4xl sm:text-5xl md:text-6xl font-extrabold mt-2">$87<span className="text-lg sm:text-xl md:text-2xl font-semibold">/month</span></div>
              <div className="text-neutral-400 text-xs sm:text-sm mt-2 mb-4 sm:mb-6">Site‑wide access to every Legacy+ creator</div>
              <ul className="text-neutral-200 space-y-2 sm:space-y-3 flex-1 text-sm sm:text-base">
                <li className="flex items-start gap-2 sm:gap-3">
                  <svg className="w-4 h-4 sm:w-5 sm:h-5 text-ccaBlue flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Complete access to all Legacy Creator profiles
                </li>
                <li className="flex items-start gap-2 sm:gap-3">
                  <svg className="w-4 h-4 sm:w-5 sm:h-5 text-ccaBlue flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="font-semibold">0% platform fee</span> on marketplace & job listings
                </li>
                <li className="flex items-start gap-2 sm:gap-3">
                  <svg className="w-4 h-4 sm:w-5 sm:h-5 text-ccaBlue flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  All assets, job opportunities, and marketplace access
                </li>
                <li className="flex items-start gap-2 sm:gap-3">
                  <svg className="w-4 h-4 sm:w-5 sm:h-5 text-ccaBlue flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Includes everything in Monthly Membership
                </li>
              </ul>
              <button className="cta-button mt-6 sm:mt-8 w-full text-base sm:text-lg py-3 sm:py-4 touch-manipulation transform hover:scale-105 transition-transform" onClick={startAllAccess}>Join All‑Access</button>
            </div>
          </div>
          <div className="mt-6 sm:mt-8 text-center text-xs sm:text-sm text-neutral-400 px-3">14‑day refund policy • 96% satisfaction rating • Instant access</div>
        </section>

        {/* What's Inside - Learning Content */}
        <section id="curriculum" className="relative max-w-7xl mx-auto px-3 sm:px-4 md:px-6 py-12 sm:py-16 md:py-24 w-full overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-ccaBlue/5 to-transparent pointer-events-none" />
          
          <div className="relative z-10 text-center mb-8 sm:mb-12 md:mb-16 px-2">
            <div className="inline-block px-4 py-1.5 rounded-full bg-ccaBlue/10 border border-ccaBlue/30 text-ccaBlue text-xs sm:text-sm font-semibold mb-4 sm:mb-6">
              COMPREHENSIVE CURRICULUM
            </div>
            <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-extrabold mb-4 sm:mb-6 text-white drop-shadow-2xl leading-tight">
              LEARN FROM THE BEST<br />
              <span className="bg-gradient-to-r from-ccaBlue via-purple-500 to-pink-500 bg-clip-text text-transparent">MASTER YOUR CRAFT</span>
            </h2>
            <p className="text-base sm:text-lg md:text-xl lg:text-2xl text-neutral-300 max-w-3xl mx-auto leading-relaxed">
              800+ expert-led videos across 16 categories. Learn the skills that turn creators into professionals.
            </p>
          </div>

          <div className="relative z-10 grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-5 px-2">
            {categories.map((category, index) => {
              const categoryIcons: { [key: string]: string } = {
                'Lighting': '💡',
                'Composition': '🎨',
                'Cinematography': '🎬',
                'Editing': '✂️',
                'Audio': '🎵',
                'Business': '💼',
                'YouTube': '📺',
                'Weddings': '💒',
                'Real Estate': '🏠',
                'Commercial': '📊',
                'Travel': '✈️',
                'Photo': '📸',
                'Color': '🌈',
                'FPV': '🚁',
                'After Effects': '⚡',
                'Gear': '📷'
              };

              const icon = categoryIcons[category] || '🎯';
              
              return (
                <div
                  key={category}
                  className="group relative overflow-hidden rounded-xl sm:rounded-2xl border border-neutral-800 bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950 p-4 sm:p-5 md:p-6 transition-all duration-300 hover:border-ccaBlue/60 hover:shadow-lg hover:shadow-ccaBlue/20 hover:-translate-y-1 active:scale-95 touch-manipulation cursor-pointer"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-ccaBlue/0 via-ccaBlue/0 to-purple-500/0 group-hover:from-ccaBlue/10 group-hover:via-purple-500/5 group-hover:to-pink-500/5 transition-all duration-300 opacity-0 group-hover:opacity-100" />
                  
                  <div className="relative z-10 flex flex-col items-center justify-center text-center min-h-[100px] sm:min-h-[120px]">
                    <div className="text-3xl sm:text-4xl md:text-5xl mb-2 sm:mb-3 transform group-hover:scale-110 transition-transform duration-300">
                      {icon}
                    </div>
                    <div className="text-xs sm:text-sm md:text-base font-semibold text-white group-hover:text-ccaBlue transition-colors duration-300">
                      {category}
                    </div>
                    <div className="mt-2 sm:mt-3 w-8 h-0.5 bg-gradient-to-r from-transparent via-ccaBlue/0 to-transparent group-hover:via-ccaBlue group-hover:w-12 transition-all duration-300" />
                  </div>

                  <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                </div>
              );
            })}
          </div>

          <div className="relative z-10 mt-8 sm:mt-12 md:mt-16 grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 px-2">
            {[
              { value: '800+', label: 'Video Lessons' },
              { value: '500+', label: 'Hours of Content' },
              { value: '16', label: 'Categories' },
              { value: '100%', label: 'Expert-Led' }
            ].map((stat, idx) => (
              <div
                key={idx}
                className="bg-gradient-to-br from-neutral-950/80 to-neutral-900/80 backdrop-blur-sm rounded-xl sm:rounded-2xl border border-neutral-800/50 p-4 sm:p-5 md:p-6 text-center hover:border-ccaBlue/50 transition-all duration-300"
              >
                <div className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-ccaBlue mb-1 sm:mb-2">
                  {stat.value}
                </div>
                <div className="text-xs sm:text-sm text-neutral-400 font-medium">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Included Perks */}
        <section className="relative max-w-7xl mx-auto px-3 sm:px-4 md:px-6 py-12 sm:py-16 md:py-24 w-full">
          <div className="text-center mb-6 sm:mb-8 md:mb-12 px-2">
            <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-extrabold mb-3 sm:mb-4 text-white drop-shadow-lg leading-tight">INCLUDED BONUS PERKS</h2>
            <p className="text-sm sm:text-base md:text-lg text-neutral-400 max-w-2xl mx-auto">Everything you need to succeed, included at no extra cost.</p>
          </div>
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4 px-2">
            {perks.map((p) => (
              <div key={p} className="rounded-xl sm:rounded-2xl border border-neutral-800 bg-gradient-to-br from-neutral-950 to-neutral-900 p-4 sm:p-5 md:p-6 text-neutral-200 active:border-ccaBlue/50 hover:border-ccaBlue/50 transition touch-manipulation hover:shadow-lg hover:shadow-ccaBlue/20">
                <div className="flex items-center gap-2 sm:gap-3">
                  <svg className="w-4 h-4 sm:w-5 sm:h-5 text-ccaBlue flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="font-medium text-sm sm:text-base">{p}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Testimonials Section */}
        <section className="relative max-w-7xl mx-auto px-3 sm:px-4 md:px-6 py-12 sm:py-16 md:py-24 w-full">
          <div className="text-center mb-8 sm:mb-12 md:mb-16 px-2">
            <div className="inline-block px-4 py-2 rounded-full bg-purple-500/20 border border-purple-500/50 text-purple-400 text-xs sm:text-sm font-semibold mb-6 sm:mb-8">
              REAL STORIES FROM REAL CREATORS
            </div>
            <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-extrabold mb-3 sm:mb-4 text-white drop-shadow-lg leading-tight">HEAR FROM OUR MEMBERS</h2>
            <p className="text-sm sm:text-base md:text-lg lg:text-xl text-neutral-400 leading-relaxed">We've helped hundreds of our members grow and turn filmmaking into their fulltime career.</p>
          </div>

          <div className="grid sm:grid-cols-2 gap-4 sm:gap-5 md:gap-6 mb-8 sm:mb-10 md:mb-12 px-2">
            {testimonials.map((testimonial, idx) => (
              <div key={idx} className="bg-gradient-to-br from-neutral-950 to-neutral-900 rounded-xl sm:rounded-2xl border border-neutral-800 p-5 sm:p-6 md:p-8 active:border-ccaBlue/50 hover:border-ccaBlue/50 transition touch-manipulation hover:shadow-lg hover:shadow-ccaBlue/20">
                {testimonial.revenue && (
                  <div className="text-2xl sm:text-3xl font-bold text-ccaBlue mb-3 sm:mb-4">{testimonial.revenue}</div>
                )}
                <p className="text-base sm:text-lg text-neutral-200 mb-3 sm:mb-4 italic leading-relaxed">"{testimonial.quote}"</p>
                <div>
                  <div className="font-semibold text-white text-sm sm:text-base">{testimonial.author}</div>
                  <div className="text-xs sm:text-sm text-neutral-400">{testimonial.role}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* FAQ Section */}
        <section className="relative max-w-4xl mx-auto px-3 sm:px-4 md:px-6 py-12 sm:py-16 md:py-24 w-full">
          <div className="text-center mb-6 sm:mb-8 md:mb-12 px-2">
            <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-extrabold mb-3 sm:mb-4 text-white drop-shadow-lg leading-tight">FREQUENTLY ASKED QUESTIONS</h2>
          </div>
          <div>
            <FAQ items={[
              { q: 'How fast do I get access?', a: 'Instant access after successful checkout. You\'ll be able to start learning and earning immediately.' },
              { q: 'Can I cancel?', a: 'Yes, cancel any time from your account portal. No questions asked, no hidden fees.' },
              { q: 'Do you offer refunds?', a: 'Full refunds within 14 days of purchase. We want you to be completely satisfied.' },
              { q: 'What if I\'m a beginner?', a: 'Perfect! Our curriculum is designed for all skill levels, from complete beginners to advanced creators. Plus, our community is here to help.' },
              { q: 'How often is new content added?', a: 'We add new content monthly, including tutorials, creator kits, exclusive resources, and new job opportunities.' },
              { q: 'Can I really make money through the platform?', a: 'Absolutely! Our members have closed over $2.3M in deals this year through our job board, marketplace, and asset sales. Many members report the platform pays for itself through savings and earnings.' }
            ]} />
          </div>
        </section>

        {/* Final CTA */}
        <section className="relative max-w-7xl mx-auto px-3 sm:px-4 md:px-6 py-12 sm:py-16 md:py-24 w-full">
          <div className="bg-gradient-to-br from-ccaBlue/20 via-purple-500/20 to-pink-500/20 backdrop-blur-sm rounded-2xl sm:rounded-3xl border-2 border-ccaBlue/50 p-6 sm:p-8 md:p-12 lg:p-16 text-center">
            <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-extrabold mb-4 sm:mb-6 text-white leading-tight">
              READY TO TURN YOUR<br />
              <span className="bg-gradient-to-r from-white via-neutral-100 to-white bg-clip-text text-transparent">CREATIVITY INTO INCOME?</span>
            </h2>
            <p className="text-sm sm:text-base md:text-lg lg:text-xl text-neutral-200 mb-6 sm:mb-8 max-w-2xl mx-auto leading-relaxed">
              Join 50,000+ creators who are learning, earning, and growing together. Start your opportunity today.
            </p>
            <button className="cta-button text-base sm:text-lg px-6 sm:px-8 md:px-10 py-3 sm:py-4 md:py-5 touch-manipulation transform hover:scale-105 transition-transform shadow-lg shadow-ccaBlue/50" onClick={openPricing}>Start Your Opportunity</button>
            <div className="mt-4 sm:mt-6 text-xs sm:text-sm text-neutral-300">14‑day refund policy • Instant access • Join thousands of successful creators</div>
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
    </>
  );
}
