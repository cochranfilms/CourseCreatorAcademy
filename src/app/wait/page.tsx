"use client";
import { useState } from 'react';
import { FAQ } from '@/components/FAQ';

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

  const categories = ['Lighting', 'Composition', 'Cinematography', 'Editing', 'Audio', 'Business', 'YouTube', 'Weddings', 'Real Estate', 'Commercial', 'Travel', 'Photo', 'Color', 'FPV', 'After Effects', 'Gear'];
  const perks = ['Software Discounts', 'Private Community', 'Case Studies', 'Mentorship Calls', 'Video Contests', 'Budget Calculator', '100+ Custom SFX', 'Keyboard Shortcuts', 'Access to Future Content'];

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

  const excitementOptions = [
    'Marketplace',
    'Opportunities',
    'Course Videos',
    'Assets',
    'Community',
    'Discounts',
    'All of the above'
  ];

  return (
    <main className="min-h-screen w-full overflow-x-hidden">
      {/* Hero Section */}
      <section className="relative max-w-7xl mx-auto px-3 sm:px-4 md:px-6 pt-12 sm:pt-16 pb-16 sm:pb-24 w-full pt-safe">
        <div className="relative z-10 text-center max-w-5xl mx-auto">
          <div className="inline-block px-3 sm:px-4 py-1.5 sm:py-2 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 text-white text-xs sm:text-sm font-medium mb-4 sm:mb-6">
            Join the Waitlist • Be First to Access
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl 2xl:text-8xl font-extrabold leading-[1.1] mb-4 sm:mb-6 tracking-tight text-white drop-shadow-2xl px-2">
            FROM BEGINNER TO<br />
            <span className="text-white">EXPERT CREATOR</span>
          </h1>
          <p className="text-base sm:text-lg md:text-xl lg:text-2xl text-neutral-300 mb-6 sm:mb-8 max-w-3xl mx-auto px-3 leading-relaxed">
            Course Creator Academy is launching soon! Join our waitlist to be the first to access our creator-powered platform where you can learn, collaborate, grow your network, and take your skills to the next level.
          </p>

          {/* Success Message */}
          {success && (
            <div className="mt-6 sm:mt-8 mb-4 sm:mb-6 px-4 py-4 rounded-xl bg-green-500/20 border border-green-500/50 text-green-300 max-w-2xl mx-auto">
              <p className="font-semibold mb-1">You're on the list! 🎉</p>
              <p className="text-sm">Check your email for confirmation. We'll notify you as soon as we launch.</p>
            </div>
          )}

          {/* Waitlist Form */}
          <div className="mt-8 sm:mt-12 mb-6 sm:mb-8 w-full max-w-2xl mx-auto px-2">
            <form onSubmit={handleSubmit} className="bg-gradient-to-br from-neutral-950 to-neutral-900 rounded-xl sm:rounded-2xl border border-neutral-800 p-4 sm:p-6 md:p-8">
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

      {/* Platform Overview - Tabbed Section */}
      <section className="relative max-w-7xl mx-auto px-3 sm:px-4 md:px-6 py-12 sm:py-16 md:py-24 w-full">
        <div className="text-center mb-8 sm:mb-12 md:mb-16 px-2">
          <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-extrabold mb-3 sm:mb-4 text-white drop-shadow-lg leading-tight">
            EVERYTHING CREATORS NEED.<br />
            <span className="text-white">ALL IN ONE SLEEK PLATFORM.</span>
          </h2>
          <p className="text-sm sm:text-base md:text-lg lg:text-xl text-neutral-400 max-w-3xl mx-auto leading-relaxed">
            Course Creator Academy 2.0 is a creator-powered community hub where creators of all skill levels can learn, collaborate, grow their network, and stay creative.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6 md:gap-8 px-2">
          {[
            {
              title: 'Learning',
              desc: '800+ videos covering everything from fundamentals to advanced techniques',
              icon: '🎓',
              color: 'ccaBlue'
            },
            {
              title: 'Community',
              desc: 'Connect with thousands of creators, network, and collaborate',
              icon: '👥',
              color: 'purple-400'
            },
            {
              title: 'Job Board',
              desc: 'Find paid gigs or hire talent with our integrated opportunities board',
              icon: '💼',
              color: 'orange-400'
            },
            {
              title: 'Marketplace',
              desc: 'Buy and sell gear directly with trusted creators',
              icon: '🛒',
              color: 'pink-400'
            },
            {
              title: 'Assets',
              desc: 'Access LUTs, presets, overlays, transitions, SFX, and plugins',
              icon: '🎨',
              color: 'green-400'
            },
            {
              title: 'Discounts',
              desc: 'Exclusive software discounts and partner deals',
              icon: '💰',
              color: 'yellow-400'
            }
          ].map((feature) => (
            <div key={feature.title} className="bg-gradient-to-br from-neutral-950 to-neutral-900 rounded-xl sm:rounded-2xl border border-neutral-800 p-5 sm:p-6 md:p-8 active:border-ccaBlue/50 hover:border-ccaBlue/50 transition touch-manipulation">
              <div className="text-4xl sm:text-5xl mb-3 sm:mb-4">{feature.icon}</div>
              <h3 className="text-xl sm:text-2xl font-bold mb-2 sm:mb-3 text-white">{feature.title}</h3>
              <p className="text-sm sm:text-base text-neutral-400 leading-relaxed">{feature.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* What's Inside Section */}
      <section id="curriculum" className="relative max-w-7xl mx-auto px-3 sm:px-4 md:px-6 py-12 sm:py-16 md:py-24 w-full">
        <div className="text-center mb-6 sm:mb-8 md:mb-12 px-2">
          <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-extrabold mb-3 sm:mb-4 text-white drop-shadow-lg leading-tight">WHAT'S INSIDE</h2>
          <p className="text-sm sm:text-base md:text-lg lg:text-xl text-neutral-400 leading-relaxed">A complete curriculum for creators.</p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3 md:gap-4 px-2">
          {categories.map((c) => (
            <div key={c} className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 rounded-lg sm:rounded-xl border border-neutral-800 bg-gradient-to-br from-neutral-950 to-neutral-900 text-xs sm:text-sm font-medium active:border-ccaBlue/50 hover:border-ccaBlue/50 active:bg-neutral-900 hover:bg-neutral-900 transition touch-manipulation text-center">
              {c}
            </div>
          ))}
        </div>
      </section>

      {/* Included Perks */}
      <section className="relative max-w-7xl mx-auto px-3 sm:px-4 md:px-6 py-12 sm:py-16 md:py-24 w-full">
        <div className="text-center mb-6 sm:mb-8 md:mb-12 px-2">
          <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-extrabold mb-3 sm:mb-4 text-white drop-shadow-lg leading-tight">INCLUDED BONUS PERKS</h2>
        </div>
        <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4 px-2">
          {perks.map((p) => (
            <div key={p} className="rounded-xl sm:rounded-2xl border border-neutral-800 bg-gradient-to-br from-neutral-950 to-neutral-900 p-4 sm:p-5 md:p-6 text-neutral-200 active:border-ccaBlue/50 hover:border-ccaBlue/50 transition touch-manipulation">
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
          <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-extrabold mb-3 sm:mb-4 text-white drop-shadow-lg leading-tight">HEAR FROM OUR MEMBERS</h2>
          <p className="text-sm sm:text-base md:text-lg lg:text-xl text-neutral-400 leading-relaxed">We've helped hundreds of our members grow and turn filmmaking into their fulltime career.</p>
        </div>

        <div className="grid sm:grid-cols-2 gap-4 sm:gap-5 md:gap-6 mb-8 sm:mb-10 md:mb-12 px-2">
          {testimonials.map((testimonial, idx) => (
            <div key={idx} className="bg-gradient-to-br from-neutral-950 to-neutral-900 rounded-xl sm:rounded-2xl border border-neutral-800 p-5 sm:p-6 md:p-8 active:border-ccaBlue/50 hover:border-ccaBlue/50 transition touch-manipulation">
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

        <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-5 md:gap-6 text-center px-2">
          <div className="bg-gradient-to-br from-neutral-950 to-neutral-900 rounded-xl sm:rounded-2xl border border-neutral-800 p-5 sm:p-6 md:p-8">
            <div className="text-3xl sm:text-4xl font-bold text-ccaBlue mb-2">$150K</div>
            <div className="text-xs sm:text-sm text-neutral-400">Biggest Deal Closed By Members in 2024</div>
          </div>
          <div className="bg-gradient-to-br from-neutral-950 to-neutral-900 rounded-xl sm:rounded-2xl border border-neutral-800 p-5 sm:p-6 md:p-8">
            <div className="text-3xl sm:text-4xl font-bold text-ccaBlue mb-2">$2.3M</div>
            <div className="text-xs sm:text-sm text-neutral-400">Total Deal Closed By Members in 2024</div>
          </div>
          <div className="bg-gradient-to-br from-neutral-950 to-neutral-900 rounded-xl sm:rounded-2xl border border-neutral-800 p-5 sm:p-6 md:p-8 sm:col-span-2 md:col-span-1">
            <div className="text-3xl sm:text-4xl font-bold text-ccaBlue mb-2">&lt;1 YEAR</div>
            <div className="text-xs sm:text-sm text-neutral-400">Time it took 46% of the community to 10X ROI</div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="relative max-w-4xl mx-auto px-3 sm:px-4 md:px-6 py-12 sm:py-16 md:py-24 w-full">
        <div className="text-center mb-6 sm:mb-8 md:mb-12 px-2">
          <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-extrabold mb-3 sm:mb-4 text-white drop-shadow-lg leading-tight">FREQUENTLY ASKED QUESTIONS</h2>
        </div>
        <div>
          <FAQ items={[
            { q: 'When will the platform launch?', a: 'We\'re putting the finishing touches on Course Creator Academy 2.0. Join the waitlist to be notified as soon as we go live!' },
            { q: 'What will I get access to?', a: 'Everything! Learning content, community features, job board, marketplace, assets, discounts, and more. All features will be available from day one.' },
            { q: 'Is there a cost to join the waitlist?', a: 'No, joining the waitlist is completely free. You\'ll just need to sign up when we launch.' },
            { q: 'What if I\'m a beginner?', a: 'Perfect! Our platform is designed for all skill levels, from complete beginners to advanced creators. We have content and resources for everyone.' },
            { q: 'How will I know when you launch?', a: 'We\'ll send you an email notification as soon as we go live, so you can be among the first to access the platform.' }
          ]} />
        </div>
      </section>

      {/* Final CTA */}
      <section className="relative max-w-7xl mx-auto px-3 sm:px-4 md:px-6 py-12 sm:py-16 md:py-24 w-full">
        <div className="bg-white/10 backdrop-blur-sm rounded-2xl sm:rounded-3xl border-2 border-white/20 p-6 sm:p-8 md:p-12 lg:p-16 text-center">
          <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-extrabold mb-4 sm:mb-6 text-white leading-tight">
            READY TO LEVEL UP?<br />
            <span className="text-white">JOIN THE WAITLIST</span>
          </h2>
          <p className="text-sm sm:text-base md:text-lg lg:text-xl text-neutral-300 mb-6 sm:mb-8 max-w-2xl mx-auto leading-relaxed">
            Be the first to access Course Creator Academy 2.0 and start your journey from beginner to expert creator.
          </p>
          <a href="#top" className="cta-button text-base sm:text-lg px-6 sm:px-8 md:px-10 py-3 sm:py-4 md:py-5 touch-manipulation inline-block">
            Join the Waitlist
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 py-10 text-center text-neutral-400 bg-black/40 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <p>© {new Date().getFullYear()} Course Creator Academy. All rights reserved.</p>
        </div>
      </footer>
    </main>
  );
}

