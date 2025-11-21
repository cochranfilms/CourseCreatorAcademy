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
            Creator Collective is launching soon! Join our waitlist to be the first to access our creator-powered platform where you can learn, collaborate, grow your network, and take your skills to the next level.
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

      {/* Platform Overview - Enhanced Section */}
      <section className="relative max-w-7xl mx-auto px-3 sm:px-4 md:px-6 py-16 sm:py-20 md:py-32 w-full">
        <div className="text-center mb-12 sm:mb-16 md:mb-20 px-2">
          <div className="inline-block px-4 py-2 rounded-full bg-ccaBlue/20 border border-ccaBlue/50 text-ccaBlue text-xs sm:text-sm font-semibold mb-6 sm:mb-8">
            YOUR CREATIVE HOME BASE
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-extrabold mb-4 sm:mb-6 text-white drop-shadow-2xl leading-tight">
            EVERYTHING CREATORS NEED.<br />
            <span className="bg-gradient-to-r from-ccaBlue via-purple-500 to-pink-500 bg-clip-text text-transparent">ALL IN ONE SLEEK PLATFORM.</span>
          </h2>
          <p className="text-base sm:text-lg md:text-xl lg:text-2xl text-neutral-300 max-w-4xl mx-auto leading-relaxed mt-6">
            Course Creator Academy 2.0 is a creator-powered community hub where creators of all skill levels can learn, collaborate, grow their network, and stay creative.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8 md:gap-10 px-2">
          {features.map((feature, index) => (
            <div 
              key={feature.title} 
              className="group relative bg-gradient-to-br from-neutral-950 to-neutral-900 rounded-2xl sm:rounded-3xl border-2 border-neutral-800 p-6 sm:p-8 md:p-10 hover:border-ccaBlue/50 transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:shadow-ccaBlue/20"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              {/* Gradient overlay on hover */}
              <div className={`absolute inset-0 bg-gradient-to-br ${feature.gradient} opacity-0 group-hover:opacity-10 rounded-2xl sm:rounded-3xl transition-opacity duration-300`}></div>
              
              <div className="relative z-10">
                <div className="text-5xl sm:text-6xl md:text-7xl mb-4 sm:mb-6 transform group-hover:scale-110 transition-transform duration-300">
                  {feature.icon}
                </div>
                <h3 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-3 sm:mb-4 text-white group-hover:text-ccaBlue transition-colors duration-300">
                  {feature.title}
                </h3>
                <p className="text-sm sm:text-base md:text-lg text-neutral-400 leading-relaxed group-hover:text-neutral-300 transition-colors duration-300">
                  {feature.desc}
                </p>
              </div>
              
              {/* Shine effect */}
              <div className="absolute inset-0 rounded-2xl sm:rounded-3xl bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
            </div>
          ))}
        </div>

        {/* Call to action below features */}
        <div className="mt-16 sm:mt-20 md:mt-24 text-center">
          <div className="inline-block px-6 sm:px-8 py-3 sm:py-4 rounded-xl bg-gradient-to-r from-ccaBlue/20 via-purple-500/20 to-pink-500/20 border-2 border-ccaBlue/50 backdrop-blur-sm">
            <p className="text-base sm:text-lg md:text-xl text-white font-semibold">
              Ready to level up? <span className="text-ccaBlue">Join the waitlist above!</span>
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
