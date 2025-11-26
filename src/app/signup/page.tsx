"use client";
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { StripeEmbeddedCheckout } from '@/components/StripeEmbeddedCheckout';
import { createUserWithEmailAndPassword, fetchSignInMethodsForEmail } from 'firebase/auth';
import { auth } from '@/lib/firebaseClient';
import { useAuth } from '@/contexts/AuthContext';

export default function SignupPage() {
  const router = useRouter();
  const { user, signInWithGoogle } = useAuth();
  const [open, setOpen] = useState(false);
  const [plan, setPlan] = useState<'membership87' | 'monthly37' | 'noFees60' | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isGoogleOnlyAccount, setIsGoogleOnlyAccount] = useState(false);
  const [pendingPlan, setPendingPlan] = useState<'membership87' | 'monthly37' | 'noFees60' | null>(null);

  const handleStartCheckout = async (selectedPlan: 'membership87' | 'monthly37' | 'noFees60') => {
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
        // Check if this account was created with Google OAuth
        try {
          const signInMethods = await fetchSignInMethodsForEmail(auth, email);
          const hasGoogleProvider = signInMethods.includes('google.com');
          const hasPasswordProvider = signInMethods.includes('password');
          
          if (hasGoogleProvider && !hasPasswordProvider) {
            // Account exists with Google only - automatically sign in with Google
            setIsGoogleOnlyAccount(true);
            setPendingPlan(selectedPlan);
            setError('This email is registered with Google. Signing you in...');
            
            // Automatically sign in with Google and proceed to checkout
            // Pass the plan directly to avoid React state timing issues
            // Use setTimeout to allow error state to update UI first
            setTimeout(async () => {
              try {
                await handleGoogleSignInForCheckout(selectedPlan);
              } catch (autoSignInError: any) {
                console.error('Auto sign-in error:', autoSignInError);
                // If auto sign-in fails, show the manual button option
                setError('This email is already registered with Google. Please sign in with Google to continue with your purchase.');
              }
            }, 100);
            return; // Exit early, checkout will open via handleGoogleSignInForCheckout
          } else {
            // Account exists with password or other providers
            setError('An account with this email already exists. Please sign in instead.');
          }
        } catch (checkError) {
          // If we can't check, show generic error
          console.error('Error checking sign-in methods:', checkError);
          setError('An account with this email already exists. Please sign in instead.');
        }
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

  // Handle Google sign-in for existing Google-only accounts
  const handleGoogleSignInForCheckout = async (planToUse?: 'membership87' | 'monthly37' | 'noFees60') => {
    const plan = planToUse || pendingPlan;
    if (!plan) return;
    
    setError('');
    setLoading(true);
    try {
      // Set flag to allow checkout flow even without membership
      // Set it BEFORE calling signInWithGoogle so it's available during the auth flow
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('signup_checkout_flow', 'true');
        console.log('[Signup] Set signup_checkout_flow flag to true');
      }
      
      await signInWithGoogle(true); // Pass true to allow checkout flow
      // After Google sign-in, user will be authenticated
      // Open checkout with the plan
      setPlan(plan);
      setOpen(true);
      setIsGoogleOnlyAccount(false);
      setPendingPlan(null);
      
      // Don't clear the flag yet - keep it until checkout completes
      // It will be cleared when checkout closes or completes
    } catch (err: any) {
      console.error('Google sign-in error:', err);
      
      if (err.message?.includes('Membership required')) {
        // User signed in but doesn't have membership - that's fine, proceed to checkout
        // The flag should still be set, so checkout can proceed
        setPlan(plan);
        setOpen(true);
        setIsGoogleOnlyAccount(false);
        setPendingPlan(null);
      } else {
        // Clear flag on other errors
        if (typeof window !== 'undefined') {
          sessionStorage.removeItem('signup_checkout_flow');
        }
        setError(err.message || 'Failed to sign in with Google. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  // If user is already signed in and we have a pending plan, open checkout
  useEffect(() => {
    if (user && pendingPlan && !open) {
      setPlan(pendingPlan);
      setOpen(true);
      setIsGoogleOnlyAccount(false);
      setPendingPlan(null);
    }
  }, [user, pendingPlan, open]);

  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-12 pt-safe">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">Join Creator Collective</h1>
          <p className="text-neutral-400">Create your account and choose a plan to get started.</p>
        </div>

        <div className="bg-neutral-950 border border-neutral-800 p-8">
          {error && (
            <div className="mb-4 p-4 bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-lg">
              {error}
              {isGoogleOnlyAccount && (
                <button
                  onClick={handleGoogleSignInForCheckout}
                  disabled={loading}
                  className="mt-3 w-full bg-white text-black py-2 px-4 rounded-lg font-semibold hover:bg-gray-100 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  Sign in with Google to Continue
                </button>
              )}
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
              {loading ? 'Creating Account...' : 'Start All-Access — $87/mo'}
            </button>
            <button
              onClick={() => handleStartCheckout('noFees60')}
              disabled={loading}
              className="w-full bg-green-600 text-white py-3 font-semibold hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Creating Account...' : 'Start No-Fees — $60/mo'}
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
          sessionStorage.removeItem('signup_checkout_flow');
        }}
      />
    </div>
  );
}
