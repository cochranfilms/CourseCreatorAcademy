"use client";
import { useState } from 'react';
import Link from 'next/link';
import { StripeEmbeddedCheckout } from '@/components/StripeEmbeddedCheckout';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from '@/lib/firebaseClient';

export default function SignupPage() {
  const [open, setOpen] = useState(false);
  const [plan, setPlan] = useState<'membership87' | 'monthly37' | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleStartCheckout = async (selectedPlan: 'membership87' | 'monthly37') => {
    setError('');
    
    // Validate form
    if (!email || !email.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }
    
    if (!password || password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }
    
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      // Create Firebase account with email/password BEFORE checkout
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const userId = userCredential.user.uid;
      
      // Store credentials in sessionStorage for post-checkout sign-in
      sessionStorage.setItem('signup_email', email);
      sessionStorage.setItem('signup_password', password);
      sessionStorage.setItem('signup_userId', userId);
      
      // Set plan and open checkout
      setPlan(selectedPlan);
      setOpen(true);
    } catch (err: any) {
      console.error('Account creation error:', err);
      
      // Handle specific Firebase errors
      if (err.code === 'auth/email-already-in-use') {
        setError('An account with this email already exists. Please sign in instead.');
      } else if (err.code === 'auth/invalid-email') {
        setError('Invalid email address format.');
      } else if (err.code === 'auth/weak-password') {
        setError('Password is too weak. Please choose a stronger password.');
      } else {
        setError(err.message || 'Failed to create account. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-12 -mt-16">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">Join Creator Collective</h1>
          <p className="text-neutral-400">Create your account and choose a plan to get started.</p>
        </div>

        <div className="bg-neutral-950 border border-neutral-800 p-8">
          {error && (
            <div className="mb-4 p-4 bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-lg">
              {error}
            </div>
          )}

          <div className="space-y-4 mb-6">
            <div>
              <label htmlFor="email" className="block text-sm font-medium mb-2 text-neutral-300">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
                className="w-full bg-neutral-900 border border-neutral-800 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-ccaBlue focus:border-transparent disabled:opacity-50"
                placeholder="your@email.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium mb-2 text-neutral-300">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
                className="w-full bg-neutral-900 border border-neutral-800 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-ccaBlue focus:border-transparent disabled:opacity-50"
                placeholder="••••••••"
                minLength={6}
              />
              <p className="mt-1 text-xs text-neutral-500">Must be at least 6 characters</p>
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium mb-2 text-neutral-300">
                Confirm Password
              </label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                disabled={loading}
                className="w-full bg-neutral-900 border border-neutral-800 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-ccaBlue focus:border-transparent disabled:opacity-50"
                placeholder="••••••••"
                minLength={6}
              />
            </div>
          </div>

          <div className="space-y-4">
            <button
              onClick={() => handleStartCheckout('membership87')}
              disabled={loading}
              className="w-full bg-ccaBlue text-white py-3 font-semibold hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Creating Account...' : 'Start Membership — $87/mo'}
            </button>
            <button
              onClick={() => handleStartCheckout('monthly37')}
              disabled={loading}
              className="w-full bg-neutral-900 text-white py-3 font-semibold hover:bg-neutral-800 transition border border-neutral-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Creating Account...' : 'Start Monthly Plan — $37/mo'}
            </button>
          </div>

          <div className="mt-6 pt-6 border-t border-neutral-800 text-sm text-neutral-400 text-center">
            Already have an account?{' '}
            <Link href="/login" className="text-ccaBlue hover:text-ccaBlue/80 font-medium">
              Sign in
            </Link>
          </div>
        </div>
      </div>

      <StripeEmbeddedCheckout
        plan={plan}
        isOpen={open && Boolean(plan)}
        onClose={() => {
          setOpen(false);
          // Clear stored credentials if checkout is closed
          sessionStorage.removeItem('signup_email');
          sessionStorage.removeItem('signup_password');
          sessionStorage.removeItem('signup_userId');
        }}
      />
    </div>
  );
}
