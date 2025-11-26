"use client";
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Image from 'next/image';
import Link from 'next/link';

// Note: Console errors about "message channel closed" are harmless and come from
// browser extensions (password managers, ad blockers) trying to intercept page messages.
// These do not affect functionality and can be safely ignored.

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState<string | null>(null);
  const { signIn, signInWithGoogle, signInWithFacebook } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await signIn(email, password);
      router.push('/');
    } catch (err: any) {
      console.error('Login error:', err);
      
      // Provide user-friendly error messages based on Firebase error codes
      let errorMessage = 'Failed to sign in. Please check your credentials.';
      
      if (err.code) {
        switch (err.code) {
          case 'auth/user-not-found':
            errorMessage = 'No account found with this email address.';
            break;
          case 'auth/wrong-password':
            errorMessage = 'Incorrect password. Please try again or use "Forgot password?"';
            break;
          case 'auth/invalid-email':
            errorMessage = 'Invalid email address format.';
            break;
          case 'auth/user-disabled':
            errorMessage = 'This account has been disabled. Please contact support.';
            break;
          case 'auth/too-many-requests':
            errorMessage = 'Too many failed login attempts. Please try again later.';
            break;
          case 'auth/network-request-failed':
            errorMessage = 'Network error. Please check your connection and try again.';
            break;
          default:
            // Use the error message if available, otherwise use default
            errorMessage = err.message || errorMessage;
        }
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError('');
    setSocialLoading('google');
    try {
      await signInWithGoogle();
      router.push('/');
    } catch (err: any) {
      console.error('Google sign-in error:', err);
      // Provide more helpful error messages
      let errorMessage = err.message || 'Failed to sign in with Google. Please try again.';
      
      // If popup closed, provide specific guidance
      if (err.code === 'auth/popup-closed-by-user' || err.message?.includes('popup closed')) {
        errorMessage = err.message || 
          'Google sign-in popup closed. This may be a configuration issue. ' +
          'Please try email/password sign-in or contact support.';
      }
      
      setError(errorMessage);
    } finally {
      setSocialLoading(null);
    }
  };

  const handleFacebookSignIn = async () => {
    setError('');
    setSocialLoading('facebook');
    try {
      await signInWithFacebook();
      router.push('/');
    } catch (err: any) {
      setError(err.message || 'Failed to sign in with Facebook. Please try again.');
    } finally {
      setSocialLoading(null);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-3 sm:px-4 md:px-6 py-8 sm:py-12 -mt-16 pt-safe pb-safe">
      <div className="w-full max-w-md">
        <div className="text-center mb-6 sm:mb-8 px-2">
          <h1 className="text-2xl sm:text-3xl font-bold mb-2 leading-tight">Welcome Back</h1>
          <p className="text-sm sm:text-base text-neutral-400 leading-relaxed">Sign in to access your courses and marketplace</p>
        </div>

        <div className="bg-neutral-950 border border-neutral-800 p-4 sm:p-6 md:p-8 rounded-lg">
          {/* Social Login Buttons */}
          <div className="space-y-2 sm:space-y-3 mb-4 sm:mb-6">
            <button
              onClick={handleGoogleSignIn}
              disabled={loading || socialLoading !== null}
              className="w-full flex items-center justify-center gap-2 sm:gap-3 bg-white text-neutral-900 py-2.5 sm:py-3 font-semibold text-sm sm:text-base active:bg-neutral-100 hover:bg-neutral-100 transition disabled:opacity-50 disabled:cursor-not-allowed rounded-lg touch-manipulation"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              {socialLoading === 'google' ? 'Signing in...' : 'Sign in with Google'}
            </button>

            <button
              onClick={handleFacebookSignIn}
              disabled={loading || socialLoading !== null}
              className="w-full flex items-center justify-center gap-2 sm:gap-3 bg-[#1877F2] text-white py-2.5 sm:py-3 font-semibold text-sm sm:text-base active:bg-[#166FE5] hover:bg-[#166FE5] transition disabled:opacity-50 disabled:cursor-not-allowed rounded-lg touch-manipulation"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
              </svg>
              {socialLoading === 'facebook' ? 'Signing in...' : 'Sign in with Facebook'}
            </button>
          </div>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-neutral-800"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-neutral-950 text-neutral-400">Or continue with email</span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="p-4 bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-lg">
                {error}
                {error.includes('Membership required') && (
                  <div className="mt-2">
                    <Link href="/signup" className="text-ccaBlue hover:text-ccaBlue/80 underline font-medium">
                      Purchase a membership →
                    </Link>
                  </div>
                )}
              </div>
            )}

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
                className="w-full bg-neutral-900 border border-neutral-800 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-ccaBlue focus:border-transparent"
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
                className="w-full bg-neutral-900 border border-neutral-800 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-ccaBlue focus:border-transparent"
                placeholder="••••••••"
              />
            </div>

            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center">
                <input type="checkbox" className="mr-2 rounded border-neutral-700 bg-neutral-900" />
                <span className="text-neutral-400">Remember me</span>
              </label>
              <Link href="/forgot-password" className="text-ccaBlue hover:text-ccaBlue/80">
                Forgot password?
              </Link>
            </div>

            <button
              type="submit"
              disabled={loading || socialLoading !== null}
              className="w-full bg-ccaBlue text-white py-2.5 sm:py-3 font-semibold text-sm sm:text-base active:opacity-80 hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed rounded-lg touch-manipulation"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-neutral-800">
            <p className="text-center text-sm text-neutral-400">
              Don&apos;t have an account?{' '}
              <Link href="/signup" className="text-ccaBlue hover:text-ccaBlue/80 font-medium">
                Join membership
              </Link>
            </p>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-neutral-500">
          By signing in, you agree to our Terms of Service and Privacy Policy
        </p>
      </div>
    </div>
  );
}
