"use client";
import { useState } from 'react';

export default function WaitlistPage() {
  const [formData, setFormData] = useState({
    email: '',
    name: '',
    phone: '',
    link: '',
    excitement: '',
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await fetch('/api/waitlist/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to join waitlist');
      }

      setSuccess(true);
      setFormData({
        email: '',
        name: '',
        phone: '',
        link: '',
        excitement: '',
      });
    } catch (err: any) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
    setError(null);
  };

  const excitementOptions = [
    'Marketplace',
    'Opportunities',
    'Course Videos',
    'Assets',
    'Community',
    'Discounts',
    'All of the above'
  ];

  const features = [
    {
      title: 'Learning',
      desc: '800+ videos covering everything from fundamentals to advanced techniques',
      icon: '🎓',
      gradient: 'from-blue-600 to-purple-600'
    },
    {
      title: 'Community',
      desc: 'Connect with thousands of creators, network, and collaborate',
      icon: '👥',
      gradient: 'from-purple-600 to-pink-600'
    },
    {
      title: 'Job Board',
      desc: 'Find paid gigs or hire talent with our integrated opportunities board',
      icon: '💼',
      gradient: 'from-orange-600 to-red-600'
    },
    {
      title: 'Marketplace',
      desc: 'Buy and sell gear directly with trusted creators',
      icon: '🛒',
      gradient: 'from-pink-600 to-rose-600'
    },
    {
      title: 'Assets',
      desc: 'Access LUTs, presets, overlays, transitions, SFX, and plugins',
      icon: '🎨',
      gradient: 'from-green-600 to-emerald-600'
    },
    {
      title: 'Discounts',
      desc: 'Exclusive software discounts and partner deals',
      icon: '💰',
      gradient: 'from-yellow-600 to-amber-600'
    }
  ];

  const earningWays = [
    {
      title: "Land High-Paying Gigs",
      description: "Access exclusive job opportunities from brands and agencies. Our members have closed over $2.3M in deals this year alone.",
      icon: "💼",
      stat: "$1,000+",
      statLabel: "Local Trusted Jobs",
      gradient: "from-orange-500/20 to-red-500/20",
      borderColor: "border-orange-500/50"
    },
    {
      title: "Download All Assets",
      description: "Gain Access to Industry Assets such as LUTs, SFX, Overlays, and Templates.",
      icon: "🗃️",
      stat: "300+ Assets",
      statLabel: "Instant Download",
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

  return (
    <>
      {/* Structured Data for SEO */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebPage",
            "name": "Join the Waitlist | Course Creator Academy",
            "description": "Join the waitlist for Course Creator Academy - the #1 creator platform for learning, earning, and growing. Access 800+ video courses, exclusive job opportunities, marketplace, assets, discounts, and a thriving community.",
            "url": "https://coursecreatoracademy.com/wait",
            "inLanguage": "en-US",
            "isPartOf": {
              "@type": "WebSite",
              "name": "Course Creator Academy",
              "url": "https://coursecreatoracademy.com"
            },
            "about": {
              "@type": "EducationalOrganization",
              "name": "Course Creator Academy",
              "description": "A creator-powered platform offering video production courses, job opportunities, marketplace, and community for filmmakers and content creators."
            },
            "mainEntity": {
              "@type": "Event",
              "name": "Course Creator Academy Platform Launch",
              "description": "Join the waitlist to be notified when Course Creator Academy launches. Get early access to 800+ video courses, exclusive job opportunities, marketplace, assets, and community features.",
              "eventStatus": "https://schema.org/EventScheduled",
              "eventAttendanceMode": "https://schema.org/OnlineEventAttendanceMode",
              "organizer": {
                "@type": "Organization",
                "name": "Course Creator Academy",
                "url": "https://coursecreatoracademy.com"
              }
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
            "name": "Course Creator Academy - Creator Platform",
            "description": "800+ expert-led video courses covering filmmaking, video production, cinematography, editing, business strategies, and creator opportunities. Join 50,000+ creators learning and earning together.",
            "provider": {
              "@type": "Organization",
              "name": "Course Creator Academy",
              "sameAs": "https://coursecreatoracademy.com"
            },
            "courseCode": "CCA",
            "educationalLevel": "Beginner to Advanced",
            "teaches": [
              "Video Production",
              "Filmmaking",
              "Cinematography",
              "Video Editing",
              "Content Creation",
              "Business for Creators",
              "Professional Video Skills"
            ],
            "audience": {
              "@type": "Audience",
              "audienceType": "Content Creators, Filmmakers, Video Producers"
            }
          })
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebApplication",
            "name": "Course Creator Academy",
            "applicationCategory": "EducationalApplication",
            "operatingSystem": "Web",
            "offers": {
              "@type": "Offer",
              "price": "37",
              "priceCurrency": "USD",
              "availability": "https://schema.org/PreOrder"
            },
            "aggregateRating": {
              "@type": "AggregateRating",
              "ratingValue": "4.8",
              "reviewCount": "1250"
            },
            "featureList": [
              "800+ Video Courses",
              "Job Board for Creators",
              "Marketplace",
              "Creator Assets (LUTs, Presets, SFX)",
              "Exclusive Discounts",
              "Community of 50,000+ Creators"
            ]
          })
        }}
      />

      <main className="min-h-screen w-full overflow-x-hidden" itemScope itemType="https://schema.org/WebPage">
        {/* Hero Section */}
        <section className="relative max-w-7xl mx-auto px-3 sm:px-4 md:px-6 pt-12 sm:pt-16 pb-8 sm:pb-12 w-full pt-safe" itemScope itemType="https://schema.org/Event">
        <div className="relative z-10 text-center max-w-5xl mx-auto">
          <div className="inline-block px-3 sm:px-4 py-1.5 sm:py-2 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 text-white text-xs sm:text-sm font-medium mb-4 sm:mb-6">
            Join the Waitlist • Be First to Access
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl 2xl:text-8xl font-extrabold leading-[1.1] mb-4 sm:mb-6 tracking-tight text-white drop-shadow-2xl px-2" itemProp="name">
            FROM BEGINNER TO<br />
            <span className="text-white">EXPERT CREATOR</span>
          </h1>
          <p className="text-base sm:text-lg md:text-xl lg:text-2xl text-neutral-300 mb-6 sm:mb-8 max-w-3xl mx-auto px-3 leading-relaxed" itemProp="description">
            Course Creator Academy is launching soon! Join our waitlist to be the first to access our creator-powered platform where you can learn from 800+ expert-led videos, land high-paying gigs through our job board, sell assets in our marketplace, access exclusive discounts, and connect with 50,000+ creators. Take your video production and filmmaking skills to the next level.
          </p>
        </div>
      </section>

      {/* How Creators Earn Section */}
      <section className="relative max-w-7xl mx-auto px-3 sm:px-4 md:px-6 py-8 sm:py-12 md:py-16 w-full">
        <div className="text-center mb-8 sm:mb-12 md:mb-16 px-2">
          <div className="inline-block px-4 py-2 rounded-full bg-green-500/20 border border-green-500/50 text-green-400 text-xs sm:text-sm font-semibold mb-6 sm:mb-8">
            MULTIPLE WAYS TO EARN
          </div>
          <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-extrabold mb-3 sm:mb-4 text-white drop-shadow-lg leading-tight">
            THIS ISN'T JUST LEARNING.<br />
            <span className="bg-gradient-to-r from-green-400 via-emerald-400 to-teal-400 bg-clip-text text-transparent">THIS IS REAL MONEY.</span>
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

      {/* Waitlist Form Section */}
      <section className="relative max-w-7xl mx-auto px-3 sm:px-4 md:px-6 py-8 sm:py-12 md:py-16 w-full">
        <div className="relative z-10 text-center max-w-5xl mx-auto">
          {/* Success Message */}
          {success && (
            <div className="mb-6 sm:mb-8 px-4 py-4 rounded-xl bg-green-500/20 border border-green-500/50 text-green-300 max-w-2xl mx-auto">
              <p className="font-semibold mb-1">You're on the list! 🎉</p>
              <p className="text-sm">Check your email for confirmation. We'll notify you as soon as we launch.</p>
            </div>
          )}

          {/* Waitlist Form */}
          <div className="w-full max-w-2xl mx-auto px-2">
            <form onSubmit={handleSubmit} className="bg-gradient-to-br from-neutral-950 to-neutral-900 rounded-xl sm:rounded-2xl border border-neutral-800 p-4 sm:p-6 md:p-8" itemScope itemType="https://schema.org/ContactPage">
              {error && (
                <div className="mb-4 px-4 py-3 rounded-lg bg-red-500/20 border border-red-500/50 text-red-300 text-sm">
                  {error}
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-neutral-300 mb-2">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    required
                    value={formData.email}
                    onChange={handleChange}
                    className="w-full px-4 py-3 rounded-lg bg-neutral-900 border border-neutral-700 text-white placeholder-neutral-500 focus:outline-none focus:border-ccaBlue focus:ring-2 focus:ring-ccaBlue/20 transition"
                    placeholder="your@email.com"
                  />
                </div>

                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-neutral-300 mb-2">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    required
                    value={formData.name}
                    onChange={handleChange}
                    className="w-full px-4 py-3 rounded-lg bg-neutral-900 border border-neutral-700 text-white placeholder-neutral-500 focus:outline-none focus:border-ccaBlue focus:ring-2 focus:ring-ccaBlue/20 transition"
                    placeholder="John Doe"
                  />
                </div>

                <div>
                  <label htmlFor="phone" className="block text-sm font-medium text-neutral-300 mb-2">
                    Phone Number *
                  </label>
                  <input
                    type="tel"
                    id="phone"
                    name="phone"
                    required
                    value={formData.phone}
                    onChange={handleChange}
                    className="w-full px-4 py-3 rounded-lg bg-neutral-900 border border-neutral-700 text-white placeholder-neutral-500 focus:outline-none focus:border-ccaBlue focus:ring-2 focus:ring-ccaBlue/20 transition"
                    placeholder="+1 (555) 123-4567"
                  />
                </div>

                <div>
                  <label htmlFor="link" className="block text-sm font-medium text-neutral-300 mb-2">
                    Social Media / Website / Portfolio Link *
                  </label>
                  <input
                    type="url"
                    id="link"
                    name="link"
                    required
                    value={formData.link}
                    onChange={handleChange}
                    className="w-full px-4 py-3 rounded-lg bg-neutral-900 border border-neutral-700 text-white placeholder-neutral-500 focus:outline-none focus:border-ccaBlue focus:ring-2 focus:ring-ccaBlue/20 transition"
                    placeholder="https://yourportfolio.com or https://instagram.com/yourhandle"
                  />
                </div>

                <div>
                  <label htmlFor="excitement" className="block text-sm font-medium text-neutral-300 mb-2">
                    What are you most excited about? *
                  </label>
                  <select
                    id="excitement"
                    name="excitement"
                    required
                    value={formData.excitement}
                    onChange={handleChange}
                    className="w-full px-4 py-3 rounded-lg bg-neutral-900 border border-neutral-700 text-white focus:outline-none focus:border-ccaBlue focus:ring-2 focus:ring-ccaBlue/20 transition"
                  >
                    <option value="">Select an option...</option>
                    {excitementOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  type="submit"
                  disabled={loading || success}
                  className="w-full cta-button text-base sm:text-lg px-6 sm:px-8 py-3 sm:py-4 rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation"
                >
                  {loading ? 'Joining Waitlist...' : success ? 'Joined!' : 'Join the Waitlist'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </section>

      {/* Platform Overview - Enhanced Section */}
      <section className="relative max-w-7xl mx-auto px-3 sm:px-4 md:px-6 py-8 sm:py-12 md:py-16 w-full" itemScope itemType="https://schema.org/ItemList">
        <div className="text-center mb-12 sm:mb-16 md:mb-20 px-2">
          <div className="inline-block px-4 py-2 rounded-full bg-ccaBlue/20 border border-ccaBlue/50 text-white text-xs sm:text-sm font-semibold mb-6 sm:mb-8">
            YOUR CREATIVE HOME BASE
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-extrabold mb-4 sm:mb-6 text-white drop-shadow-2xl leading-tight" itemProp="name">
            EVERYTHING CREATORS NEED.<br />
            <span className="bg-gradient-to-r from-ccaBlue via-purple-500 to-pink-500 bg-clip-text text-transparent">ALL IN ONE SLEEK PLATFORM.</span>
          </h2>
          <p className="text-base sm:text-lg md:text-xl lg:text-2xl text-neutral-300 max-w-4xl mx-auto leading-relaxed mt-6" itemProp="description">
            Course Creator Academy 2.0 is a creator-powered community hub where creators of all skill levels can learn from 800+ expert-led video courses, collaborate with 50,000+ members, access exclusive job opportunities and marketplace, grow their network, and transform their creative careers.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8 md:gap-10 px-2">
          {features.map((feature, index) => (
            <article 
              key={feature.title}
              itemScope
              itemType="https://schema.org/Service"
              className="group relative bg-gradient-to-br from-neutral-950 to-neutral-900 rounded-2xl sm:rounded-3xl border-2 border-neutral-800 p-6 sm:p-8 md:p-10 hover:border-ccaBlue/50 transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:shadow-ccaBlue/20"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              {/* Gradient overlay on hover */}
              <div className={`absolute inset-0 bg-gradient-to-br ${feature.gradient} opacity-0 group-hover:opacity-10 rounded-2xl sm:rounded-3xl transition-opacity duration-300`}></div>
              
              <div className="relative z-10">
                <div className="text-5xl sm:text-6xl md:text-7xl mb-4 sm:mb-6 transform group-hover:scale-110 transition-transform duration-300" aria-hidden="true">
                  {feature.icon}
                </div>
                <h3 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-3 sm:mb-4 text-white group-hover:text-ccaBlue transition-colors duration-300" itemProp="name">
                  {feature.title}
                </h3>
                <p className="text-sm sm:text-base md:text-lg text-neutral-400 leading-relaxed group-hover:text-neutral-300 transition-colors duration-300" itemProp="description">
                  {feature.desc}
                </p>
              </div>
              
              {/* Shine effect */}
              <div className="absolute inset-0 rounded-2xl sm:rounded-3xl bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
            </article>
          ))}
        </div>

        {/* Call to action below features */}
        <div className="mt-8 sm:mt-12 md:mt-16 text-center">
          <div className="inline-block px-6 sm:px-8 py-3 sm:py-4 rounded-xl bg-gradient-to-r from-ccaBlue/20 via-purple-500/20 to-pink-500/20 border-2 border-ccaBlue/50 backdrop-blur-sm">
            <p className="text-base sm:text-lg md:text-xl text-white font-semibold">
              Ready to level up? <span className="font-bold text-black">Join the waitlist above!</span>
            </p>
          </div>
        </div>
      </section>
    </main>
    </>
  );
}
