"use client";

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

const PASSWORD = 'cca2026';
const STORAGE_KEY = 'cca_password_verified';

export default function BlueprintPage() {
  const pathname = usePathname();
  const [isVerified, setIsVerified] = useState<boolean | null>(null);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    // Check if password is already verified in sessionStorage
    const verified = sessionStorage.getItem(STORAGE_KEY) === 'true';
    setIsVerified(verified);
  }, [pathname]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password === PASSWORD) {
      sessionStorage.setItem(STORAGE_KEY, 'true');
      setIsVerified(true);
    } else {
      setError('Incorrect password. Please try again.');
      setPassword('');
    }
  };

  // Show loading state while checking
  if (isVerified === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-neutral-950 to-black">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-ccaBlue mb-4"></div>
          <p className="text-neutral-400">Loading...</p>
        </div>
      </div>
    );
  }

  // Show password prompt if not verified
  if (!isVerified) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-neutral-950 to-black px-4">
        <div className="max-w-md w-full bg-gradient-to-br from-neutral-900 to-neutral-950 rounded-2xl border border-neutral-800 p-8 shadow-2xl">
          <div className="text-center mb-8">
            <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2">
              Course Creator Academy
            </h1>
            <p className="text-neutral-400">Enter password to access the blueprint</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-neutral-300 mb-2">
                Password
              </label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError('');
                }}
                className="w-full px-4 py-3 rounded-lg bg-neutral-900 border border-neutral-700 text-white placeholder-neutral-500 focus:outline-none focus:border-ccaBlue focus:ring-2 focus:ring-ccaBlue/20 transition"
                placeholder="Enter password"
                autoFocus
              />
            </div>

            {error && (
              <div className="px-4 py-3 rounded-lg bg-red-500/20 border border-red-500/50 text-red-300 text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              className="w-full cta-button text-base sm:text-lg px-6 sm:px-8 py-3 sm:py-4 rounded-lg font-semibold touch-manipulation"
            >
              Access Blueprint
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Show blueprint content
  return (
    <main className="min-h-screen text-white py-12 px-4">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-12 text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-ccaBlue to-blue-400 bg-clip-text text-transparent">
            Website Blueprint
          </h1>
          <p className="text-xl text-neutral-400 max-w-2xl mx-auto">
            A complete guide to all features, integrations, and how the Course Creator Academy platform works
          </p>
        </div>

        {/* Table of Contents */}
        <div className="mb-12 bg-gradient-to-br from-neutral-900 to-neutral-950 rounded-2xl border border-neutral-800 p-6">
          <h2 className="text-2xl font-bold mb-4 text-ccaBlue">Table of Contents</h2>
          <ul className="space-y-2 text-neutral-300">
            <li><a href="#subscriptions" className="hover:text-ccaBlue transition">1. Subscription Tiers & Membership Plans</a></li>
            <li><a href="#marketplace" className="hover:text-ccaBlue transition">2. Marketplace Features</a></li>
            <li><a href="#job-board" className="hover:text-ccaBlue transition">3. Job Board & Opportunities</a></li>
            <li><a href="#learning" className="hover:text-ccaBlue transition">4. Learning Hub & Courses</a></li>
            <li><a href="#legacy" className="hover:text-ccaBlue transition">5. Legacy+ Creator Features</a></li>
            <li><a href="#message-board" className="hover:text-ccaBlue transition">6. Message Board & Community</a></li>
            <li><a href="#assets" className="hover:text-ccaBlue transition">7. Assets Library (LUTs, Presets, Overlays, SFX)</a></li>
            <li><a href="#messaging" className="hover:text-ccaBlue transition">8. Direct Messaging System</a></li>
            <li><a href="#integrations" className="hover:text-ccaBlue transition">9. Third-Party Integrations</a></li>
            <li><a href="#user-features" className="hover:text-ccaBlue transition">10. User Profile & Dashboard Features</a></li>
          </ul>
        </div>

        {/* Section 1: Subscription Tiers */}
        <section id="subscriptions" className="mb-16">
          <div className="bg-gradient-to-br from-neutral-900 to-neutral-950 rounded-2xl border border-neutral-800 p-8">
            <h2 className="text-3xl font-bold mb-6 text-ccaBlue">1. Subscription Tiers & Membership Plans</h2>
            
            <div className="space-y-6">
              <div className="bg-neutral-900/50 rounded-lg p-6 border border-neutral-800">
                <h3 className="text-xl font-semibold mb-3 text-white">Monthly Membership - $37/month</h3>
                <p className="text-neutral-300 mb-4">Basic membership tier with full platform access</p>
                <ul className="space-y-2 text-neutral-300">
                  <li className="flex items-start">
                    <span className="text-ccaBlue mr-2">✓</span>
                    <span>Stream all video courses (800+ videos)</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-ccaBlue mr-2">✓</span>
                    <span>Access to all future content as it's released</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-ccaBlue mr-2">✓</span>
                    <span>Community access + downloadable resources</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-ccaBlue mr-2">✓</span>
                    <span>Full marketplace access (buy and sell)</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-ccaBlue mr-2">✓</span>
                    <span>Job board access (apply and post opportunities)</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-red-400 mr-2">✗</span>
                    <span>3% platform fee on marketplace sales</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-red-400 mr-2">✗</span>
                    <span>3% platform fee on job listing deposits</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-red-400 mr-2">✗</span>
                    <span>No access to Legacy Creator profiles</span>
                  </li>
                </ul>
              </div>

              <div className="bg-neutral-900/50 rounded-lg p-6 border border-neutral-800 border-green-500/30">
                <h3 className="text-xl font-semibold mb-3 text-white">No-Fees Membership - $60/month ⭐ Popular</h3>
                <p className="text-neutral-300 mb-4">Best for active sellers and frequent job posters</p>
                <ul className="space-y-2 text-neutral-300">
                  <li className="flex items-start">
                    <span className="text-green-400 mr-2">✓</span>
                    <span>Everything included in Monthly Membership</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-green-400 mr-2">✓</span>
                    <span><strong>0% platform fee</strong> on marketplace sales (you keep 100% minus Stripe fees)</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-green-400 mr-2">✓</span>
                    <span><strong>0% platform fee</strong> on job listings (deposit and final payment)</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-red-400 mr-2">✗</span>
                    <span>No access to Legacy Creator profiles</span>
                  </li>
                  <li className="text-sm text-neutral-400 mt-3">
                    <strong>Break-even point:</strong> If you make more than ~$767/month in sales or job deposits, this plan pays for itself
                  </li>
                </ul>
              </div>

              <div className="bg-neutral-900/50 rounded-lg p-6 border border-neutral-800 border-purple-500/30">
                <h3 className="text-xl font-semibold mb-3 text-white">All-Access Membership - $87/month</h3>
                <p className="text-neutral-300 mb-4">Complete access to everything on the platform</p>
                <ul className="space-y-2 text-neutral-300">
                  <li className="flex items-start">
                    <span className="text-purple-400 mr-2">✓</span>
                    <span>Everything included in Monthly Membership</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-purple-400 mr-2">✓</span>
                    <span><strong>Complete access to all Legacy Creator profiles</strong> (exclusive content from top creators)</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-purple-400 mr-2">✓</span>
                    <span><strong>0% platform fee</strong> on marketplace sales</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-purple-400 mr-2">✓</span>
                    <span><strong>0% platform fee</strong> on job listings</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-purple-400 mr-2">✓</span>
                    <span>All assets, job opportunities, and marketplace access</span>
                  </li>
                </ul>
              </div>
            </div>

            <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
              <p className="text-sm text-neutral-300">
                <strong>Note:</strong> All plans require Stripe Connect account setup to sell on marketplace or post paid job opportunities. 
                Platform fees are separate from Stripe processing fees (~2.9% + $0.30 per transaction).
              </p>
            </div>
          </div>
        </section>

        {/* Section 2: Marketplace */}
        <section id="marketplace" className="mb-16">
          <div className="bg-gradient-to-br from-neutral-900 to-neutral-950 rounded-2xl border border-neutral-800 p-8">
            <h2 className="text-3xl font-bold mb-6 text-ccaBlue">2. Marketplace Features</h2>
            
            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-semibold mb-3 text-white">For Buyers:</h3>
                <ul className="space-y-2 text-neutral-300 ml-4">
                  <li>• Browse marketplace listings (gear, equipment, digital products)</li>
                  <li>• Search and filter by condition, location, price range</li>
                  <li>• View detailed listings with multiple photos and descriptions</li>
                  <li>• Save/favorite listings for later</li>
                  <li>• Direct message sellers to ask questions</li>
                  <li>• Purchase items securely through Stripe Checkout</li>
                  <li>• Track orders in dashboard (pending, delivered, disputes)</li>
                  <li>• Receive order updates and tracking information</li>
                  <li>• File disputes if issues arise with orders</li>
                </ul>
              </div>

              <div>
                <h3 className="text-xl font-semibold mb-3 text-white">For Sellers:</h3>
                <ul className="space-y-2 text-neutral-300 ml-4">
                  <li>• Create listings with photos, descriptions, pricing, and shipping costs</li>
                  <li>• Set item condition (New, Like New, Excellent, Good, Fair)</li>
                  <li>• Specify location (United States, Canada, International)</li>
                  <li>• Manage multiple listings from dashboard</li>
                  <li>• Edit or delete listings anytime</li>
                  <li>• Receive notifications when someone messages about your listing</li>
                  <li>• Get notified when orders are placed</li>
                  <li>• Mark orders as delivered and update tracking</li>
                  <li>• Receive payouts directly to Stripe Connect account</li>
                  <li>• View sales analytics (orders count, gross revenue, platform fees, net earnings)</li>
                  <li>• Platform fee depends on membership tier (0% for No-Fees/All-Access, 3% for Monthly)</li>
                </ul>
              </div>

              <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                <p className="text-sm text-neutral-300">
                  <strong>Important:</strong> Sellers must complete Stripe Connect onboarding before they can receive payouts. 
                  Buyers can purchase immediately, but sellers won't receive funds until Connect account is verified.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Section 3: Job Board */}
        <section id="job-board" className="mb-16">
          <div className="bg-gradient-to-br from-neutral-900 to-neutral-950 rounded-2xl border border-neutral-800 p-8">
            <h2 className="text-3xl font-bold mb-6 text-ccaBlue">3. Job Board & Opportunities</h2>
            
            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-semibold mb-3 text-white">For Job Seekers:</h3>
                <ul className="space-y-2 text-neutral-300 ml-4">
                  <li>• Browse job opportunities posted by other creators/companies</li>
                  <li>• Search and filter by job type (Full Time, Part Time, Contract, Freelance, Internship)</li>
                  <li>• Filter by location and compensation range</li>
                  <li>• View detailed job descriptions with requirements and compensation</li>
                  <li>• Apply directly through external application links</li>
                  <li>• Save/favorite opportunities for later</li>
                  <li>• Get notified about new opportunities matching your preferences</li>
                </ul>
              </div>

              <div>
                <h3 className="text-xl font-semibold mb-3 text-white">For Employers (Posting Jobs):</h3>
                <ul className="space-y-2 text-neutral-300 ml-4">
                  <li>• Post job opportunities with title, company, location, type, and description</li>
                  <li>• Set compensation range (hourly rate or project fee)</li>
                  <li>• Add application link (external URL or email)</li>
                  <li>• Option to require deposit payment for job listings (paid opportunities)</li>
                  <li>• Receive applications and manage hiring process</li>
                  <li>• For paid jobs: Set deposit amount and final payment amount</li>
                  <li>• Applicants pay deposit when applying (held in escrow)</li>
                  <li>• Release final payment when job is completed</li>
                  <li>• Platform fee on deposits only (0% for No-Fees/All-Access, 3% for Monthly)</li>
                  <li>• Manage job postings from dashboard</li>
                  <li>• Mark jobs as filled or close listings</li>
                </ul>
              </div>

              <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
                <p className="text-sm text-neutral-300">
                  <strong>Note:</strong> Job board supports both free listings (with external application links) and paid opportunities 
                  (where applicants pay a deposit that goes toward the final payment). Paid opportunities require Stripe Connect setup.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Section 4: Learning Hub */}
        <section id="learning" className="mb-16">
          <div className="bg-gradient-to-br from-neutral-900 to-neutral-950 rounded-2xl border border-neutral-800 p-8">
            <h2 className="text-3xl font-bold mb-6 text-ccaBlue">4. Learning Hub & Courses</h2>
            
            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-semibold mb-3 text-white">Course Library:</h3>
                <ul className="space-y-2 text-neutral-300 ml-4">
                  <li>• Access to 800+ expert-led video courses</li>
                  <li>• Courses organized by categories (16+ categories covering filmmaking, editing, business, etc.)</li>
                  <li>• Browse courses by category, difficulty level, instructor</li>
                  <li>• Save/favorite courses for later viewing</li>
                  <li>• Course detail pages with curriculum overview</li>
                  <li>• Each course contains modules, and modules contain lessons</li>
                </ul>
              </div>

              <div>
                <h3 className="text-xl font-semibold mb-3 text-white">Video Player Features:</h3>
                <ul className="space-y-2 text-neutral-300 ml-4">
                  <li>• Secure video streaming via Mux (adaptive bitrate, signed URLs)</li>
                  <li>• High-quality video playback with automatic quality adjustment</li>
                  <li>• Lesson progress tracking (automatically saves where you left off)</li>
                  <li>• Course completion tracking (see overall progress percentage)</li>
                  <li>• Navigate between lessons using sidebar</li>
                  <li>• Video controls (play, pause, seek, volume, fullscreen)</li>
                  <li>• Downloadable resources attached to lessons</li>
                  <li>• Video transcripts and captions (when available)</li>
                </ul>
              </div>

              <div>
                <h3 className="text-xl font-semibold mb-3 text-white">Learning Experience:</h3>
                <ul className="space-y-2 text-neutral-300 ml-4">
                  <li>• All courses included with membership (no additional purchase needed)</li>
                  <li>• Access to all future content as it's released</li>
                  <li>• Track your learning progress across all courses</li>
                  <li>• View recently watched lessons</li>
                  <li>• Community discussions within course channels</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* Section 5: Legacy+ Creators */}
        <section id="legacy" className="mb-16">
          <div className="bg-gradient-to-br from-neutral-900 to-neutral-950 rounded-2xl border border-neutral-800 p-8">
            <h2 className="text-3xl font-bold mb-6 text-ccaBlue">5. Legacy+ Creator Features</h2>
            
            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-semibold mb-3 text-white">What is Legacy+?</h3>
                <p className="text-neutral-300 mb-4">
                  Legacy+ allows users to subscribe to individual creators for $10/month, unlocking exclusive video content 
                  from those creators. This is separate from the main CCA membership.
                </p>
              </div>

              <div>
                <h3 className="text-xl font-semibold mb-3 text-white">For Subscribers:</h3>
                <ul className="space-y-2 text-neutral-300 ml-4">
                  <li>• Browse Legacy Creator profiles (featured creators like Peter McKinnon, etc.)</li>
                  <li>• View creator kits with sample videos (3 free samples per creator)</li>
                  <li>• Subscribe to individual creators for $10/month per creator</li>
                  <li>• Access exclusive video content from subscribed creators</li>
                  <li>• Manage all Legacy+ subscriptions from dashboard</li>
                  <li>• Cancel subscriptions anytime</li>
                  <li>• All-Access members ($87/month) get access to ALL Legacy Creator profiles included</li>
                </ul>
              </div>

              <div>
                <h3 className="text-xl font-semibold mb-3 text-white">For Legacy Creators:</h3>
                <ul className="space-y-2 text-neutral-300 ml-4">
                  <li>• Create and manage creator profile with bio, avatar, banner</li>
                  <li>• Upload sample videos (visible to all users, max 3 shown)</li>
                  <li>• Upload exclusive videos (only visible to subscribers)</li>
                  <li>• Videos uploaded via Mux direct upload</li>
                  <li>• Receive subscription payments directly via Stripe Connect</li>
                  <li>• View subscription analytics and subscriber count</li>
                  <li>• Manage video library (add, edit, delete videos)</li>
                  <li>• Set custom URL slug for creator kit page</li>
                </ul>
              </div>

              <div className="p-4 bg-purple-500/10 border border-purple-500/30 rounded-lg">
                <p className="text-sm text-neutral-300">
                  <strong>Content Gating:</strong> Sample videos are visible to everyone, exclusive videos are only visible to active subscribers. 
                  Non-subscribers see an upgrade prompt when viewing exclusive content sections.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Section 6: Message Board */}
        <section id="message-board" className="mb-16">
          <div className="bg-gradient-to-br from-neutral-900 to-neutral-950 rounded-2xl border border-neutral-800 p-8">
            <h2 className="text-3xl font-bold mb-6 text-ccaBlue">6. Message Board & Community</h2>
            
            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-semibold mb-3 text-white">Posting Features:</h3>
                <ul className="space-y-2 text-neutral-300 ml-4">
                  <li>• Create posts with text, images, and videos</li>
                  <li>• Add hashtags to posts for discoverability</li>
                  <li>• Mention other users with @username</li>
                  <li>• Attach marketplace listings or job opportunities to posts</li>
                  <li>• Embed YouTube, Vimeo, Instagram videos</li>
                  <li>• Link posts to your portfolio projects</li>
                  <li>• Categorize posts (Showcase, Question, Collaboration, Feedback, etc.)</li>
                  <li>• Edit posts after publishing</li>
                  <li>• Delete your own posts</li>
                </ul>
              </div>

              <div>
                <h3 className="text-xl font-semibold mb-3 text-white">Engagement Features:</h3>
                <ul className="space-y-2 text-neutral-300 ml-4">
                  <li>• Like/react to posts</li>
                  <li>• Comment on posts</li>
                  <li>• Reply to comments (nested comment threads)</li>
                  <li>• Bookmark posts to save for later</li>
                  <li>• Follow other creators to see their posts</li>
                  <li>• View posts from followed creators only</li>
                  <li>• Share posts (copy link)</li>
                </ul>
              </div>

              <div>
                <h3 className="text-xl font-semibold mb-3 text-white">Discovery Features:</h3>
                <ul className="space-y-2 text-neutral-300 ml-4">
                  <li>• Browse all posts or filter by category</li>
                  <li>• Search posts by keywords</li>
                  <li>• Sort by newest, most reactions, or most comments</li>
                  <li>• View bookmarked posts</li>
                  <li>• See notifications when someone mentions you, comments, or reacts</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* Section 7: Assets */}
        <section id="assets" className="mb-16">
          <div className="bg-gradient-to-br from-neutral-900 to-neutral-950 rounded-2xl border border-neutral-800 p-8">
            <h2 className="text-3xl font-bold mb-6 text-ccaBlue">7. Assets Library (LUTs, Presets, Overlays, SFX)</h2>
            
            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-semibold mb-3 text-white">Available Asset Categories:</h3>
                <ul className="space-y-2 text-neutral-300 ml-4">
                  <li>• <strong>LUTs & Presets:</strong> Color grading LUTs and editing presets</li>
                  <li>• <strong>Overlays & Transitions:</strong> Video overlays (flares, light leaks) and transition effects</li>
                  <li>• <strong>SFX & Plugins:</strong> Sound effects and audio plugins</li>
                  <li>• <strong>Templates:</strong> Video editing templates (After Effects, Premiere Pro, etc.)</li>
                </ul>
              </div>

              <div>
                <h3 className="text-xl font-semibold mb-3 text-white">For Users:</h3>
                <ul className="space-y-2 text-neutral-300 ml-4">
                  <li>• Browse assets by category and subcategory</li>
                  <li>• View asset previews (images, videos, audio samples)</li>
                  <li>• Preview LUTs with before/after video examples</li>
                  <li>• Preview overlays and transitions with video players</li>
                  <li>• Listen to sound effect samples</li>
                  <li>• Download assets directly (ZIP files)</li>
                  <li>• Save/favorite assets for later</li>
                  <li>• All assets included with membership (no additional cost)</li>
                </ul>
              </div>

              <div>
                <h3 className="text-xl font-semibold mb-3 text-white">Asset Details:</h3>
                <ul className="space-y-2 text-neutral-300 ml-4">
                  <li>• Each asset pack contains multiple files</li>
                  <li>• LUTs come with preview videos showing color grading results</li>
                  <li>• Overlays include 720p preview videos</li>
                  <li>• Sound effects can be previewed before downloading</li>
                  <li>• Templates include instructions and example files</li>
                  <li>• Downloads are secure (signed URLs from Firebase Storage)</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* Section 8: Messaging */}
        <section id="messaging" className="mb-16">
          <div className="bg-gradient-to-br from-neutral-900 to-neutral-950 rounded-2xl border border-neutral-800 p-8">
            <h2 className="text-3xl font-bold mb-6 text-ccaBlue">8. Direct Messaging System</h2>
            
            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-semibold mb-3 text-white">Messaging Features:</h3>
                <ul className="space-y-2 text-neutral-300 ml-4">
                  <li>• Send direct messages to other creators</li>
                  <li>• Start conversations from user profiles, marketplace listings, or job postings</li>
                  <li>• Real-time message delivery</li>
                  <li>• Read receipts (see when messages are read)</li>
                  <li>• Typing indicators (see when someone is typing)</li>
                  <li>• View conversation history</li>
                  <li>• Search for users to message</li>
                  <li>• Message notifications</li>
                </ul>
              </div>

              <div>
                <h3 className="text-xl font-semibold mb-3 text-white">Use Cases:</h3>
                <ul className="space-y-2 text-neutral-300 ml-4">
                  <li>• Ask sellers questions about marketplace listings</li>
                  <li>• Discuss job opportunities with employers</li>
                  <li>• Collaborate with other creators</li>
                  <li>• Network and build relationships</li>
                  <li>• Get help and support from community</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* Section 9: Integrations */}
        <section id="integrations" className="mb-16">
          <div className="bg-gradient-to-br from-neutral-900 to-neutral-950 rounded-2xl border border-neutral-800 p-8">
            <h2 className="text-3xl font-bold mb-6 text-ccaBlue">9. Third-Party Integrations</h2>
            
            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-semibold mb-3 text-white">Stripe (Payments):</h3>
                <ul className="space-y-2 text-neutral-300 ml-4">
                  <li>• Stripe Checkout for membership subscriptions</li>
                  <li>• Stripe Connect for marketplace sellers and job posters</li>
                  <li>• Secure payment processing</li>
                  <li>• Automatic payouts to seller Stripe Connect accounts</li>
                  <li>• Webhook handling for payment events (subscriptions, orders, payouts)</li>
                  <li>• Support for one-time payments and recurring subscriptions</li>
                </ul>
              </div>

              <div>
                <h3 className="text-xl font-semibold mb-3 text-white">Mux (Video Streaming):</h3>
                <ul className="space-y-2 text-neutral-300 ml-4">
                  <li>• Secure video hosting and streaming</li>
                  <li>• Adaptive bitrate streaming (automatic quality adjustment)</li>
                  <li>• Signed playback URLs for content protection</li>
                  <li>• Direct upload support for Legacy Creator videos</li>
                  <li>• Video processing and transcoding</li>
                  <li>• Thumbnail generation</li>
                  <li>• Webhook integration for upload completion</li>
                </ul>
              </div>

              <div>
                <h3 className="text-xl font-semibold mb-3 text-white">Firebase (Backend):</h3>
                <ul className="space-y-2 text-neutral-300 ml-4">
                  <li>• Firebase Authentication (email/password)</li>
                  <li>• Firestore database (user data, posts, orders, courses, etc.)</li>
                  <li>• Firebase Storage (images, videos, asset files)</li>
                  <li>• Real-time data synchronization</li>
                  <li>• Security rules for data access control</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* Section 10: User Features */}
        <section id="user-features" className="mb-16">
          <div className="bg-gradient-to-br from-neutral-900 to-neutral-950 rounded-2xl border border-neutral-800 p-8">
            <h2 className="text-3xl font-bold mb-6 text-ccaBlue">10. User Profile & Dashboard Features</h2>
            
            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-semibold mb-3 text-white">Profile Management:</h3>
                <ul className="space-y-2 text-neutral-300 ml-4">
                  <li>• Customize profile with display name, handle, title, bio</li>
                  <li>• Upload profile picture and banner image</li>
                  <li>• Add skills and specialties</li>
                  <li>• Add location</li>
                  <li>• Link social media profiles (LinkedIn, Instagram, YouTube)</li>
                  <li>• Set profile visibility (public or private)</li>
                  <li>• Share profile link</li>
                </ul>
              </div>

              <div>
                <h3 className="text-xl font-semibold mb-3 text-white">Portfolio Projects:</h3>
                <ul className="space-y-2 text-neutral-300 ml-4">
                  <li>• Create portfolio projects showcasing your work</li>
                  <li>• Add project title, description, images, and links</li>
                  <li>• Tag projects with skills</li>
                  <li>• Link projects to message board posts</li>
                  <li>• Display projects on your public profile</li>
                </ul>
              </div>

              <div>
                <h3 className="text-xl font-semibold mb-3 text-white">Dashboard Tabs:</h3>
                <ul className="space-y-2 text-neutral-300 ml-4">
                  <li>• <strong>Projects:</strong> Manage portfolio projects</li>
                  <li>• <strong>Orders:</strong> View marketplace orders (as buyer and seller)</li>
                  <li>• <strong>Legacy+ Subscriptions:</strong> Manage Legacy Creator subscriptions</li>
                  <li>• <strong>Jobs:</strong> View job applications and posted opportunities</li>
                  <li>• <strong>Onboarding:</strong> Complete Stripe Connect setup</li>
                  <li>• <strong>Social:</strong> Manage social media links</li>
                  <li>• <strong>Email:</strong> Email notification preferences</li>
                  <li>• <strong>Privacy:</strong> Profile visibility and account settings</li>
                </ul>
              </div>

              <div>
                <h3 className="text-xl font-semibold mb-3 text-white">Notifications:</h3>
                <ul className="space-y-2 text-neutral-300 ml-4">
                  <li>• Notification bell in header showing unread count</li>
                  <li>• Notifications for: orders, job applications, messages, payouts, membership updates</li>
                  <li>• Mark notifications as read</li>
                  <li>• Filter notifications by type</li>
                  <li>• Click notifications to navigate to relevant pages</li>
                </ul>
              </div>

              <div>
                <h3 className="text-xl font-semibold mb-3 text-white">Account Settings:</h3>
                <ul className="space-y-2 text-neutral-300 ml-4">
                  <li>• Change email address</li>
                  <li>• Change password</li>
                  <li>• Email preferences (job opportunities, marketplace updates)</li>
                  <li>• View account creation date</li>
                  <li>• Logout</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <div className="text-center text-neutral-400 text-sm mt-12 pb-8">
          <p>Last updated: {new Date().toLocaleDateString()}</p>
          <p className="mt-2">This blueprint document provides a comprehensive overview of all features and functionality on the Course Creator Academy platform.</p>
        </div>
      </div>
    </main>
  );
}

