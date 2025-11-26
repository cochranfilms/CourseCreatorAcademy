"use client";
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

const PASSWORD = 'cca2026';
const STORAGE_KEY = 'cca_password_verified';

export function PasswordGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [isVerified, setIsVerified] = useState<boolean | null>(null);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    // Always allow access to /wait page
    if (pathname === '/wait') {
      setIsVerified(true);
      return;
    }

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

  // If verified or on /wait page, show children
  if (isVerified) {
    return <>{children}</>;
  }

  // Show password prompt
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-neutral-950 to-black px-4">
      <div className="max-w-md w-full bg-gradient-to-br from-neutral-900 to-neutral-950 rounded-2xl border border-neutral-800 p-8 shadow-2xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2">
            Course Creator Academy
          </h1>
          <p className="text-neutral-400">Enter password to access the platform</p>
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
            Access Platform
          </button>
        </form>
      </div>
    </div>
  );
}


