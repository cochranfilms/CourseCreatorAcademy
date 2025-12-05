"use client";

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { auth } from '@/lib/firebaseClient';

interface Strike {
  id: string;
  reportId: string;
  reason: string;
  details: string | null;
  issuedAt: string;
  strikeNumber: number;
}

export function UserStrikes() {
  const { user } = useAuth();
  const [strikes, setStrikes] = useState<Strike[]>([]);
  const [strikeCount, setStrikeCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const fetchStrikes = async () => {
      try {
        if (!auth.currentUser) return;
        const token = await auth.currentUser.getIdToken();
        const response = await fetch('/api/users/strikes', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          setStrikes(data.strikes || []);
          setStrikeCount(data.strikeCount || 0);
        }
      } catch (error) {
        console.error('Error fetching strikes:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStrikes();
  }, [user]);

  // Don't render anything if user has no strikes
  if (loading || strikeCount === 0) {
    return null;
  }

  const reasonDisplay = (reason: string) => {
    return reason.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const getStrikeColor = (count: number) => {
    if (count >= 3) return 'text-red-500';
    if (count === 2) return 'text-orange-500';
    return 'text-yellow-500';
  };

  return (
    <div className="bg-gradient-to-br from-red-900/20 via-red-900/10 to-neutral-950/90 backdrop-blur-xl border-2 border-red-800/60 p-4 sm:p-5 md:p-6 mb-5 sm:mb-6 rounded-xl shadow-lg shadow-red-900/20">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-red-900/40 border border-red-800/60 text-red-400 flex items-center justify-center shadow-md shadow-red-900/20">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">
            Account Strikes
          </h2>
        </div>
        <div className={`text-2xl font-bold ${getStrikeColor(strikeCount)}`}>
          {strikeCount}/3
        </div>
      </div>

      {strikeCount >= 3 && (
        <div className="mb-4 p-3 bg-red-900/30 border border-red-800/50 rounded-lg">
          <p className="text-red-300 text-sm font-semibold">
            ⚠️ Your profile has been removed due to receiving 3 strikes.
          </p>
        </div>
      )}

      {strikeCount === 2 && (
        <div className="mb-4 p-3 bg-orange-900/30 border border-orange-800/50 rounded-lg">
          <p className="text-orange-300 text-sm font-semibold">
            ⚠️ Warning: You have 2 strikes. One more strike will result in profile removal.
          </p>
        </div>
      )}

      <div className="space-y-3">
        {strikes.map((strike) => (
          <div
            key={strike.id}
            className="bg-neutral-900/60 border border-neutral-800 rounded-lg p-4"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className={`text-sm font-semibold ${getStrikeColor(strike.strikeNumber)}`}>
                    Strike {strike.strikeNumber}/3
                  </span>
                  <span className="text-xs text-neutral-500">
                    {new Date(strike.issuedAt).toLocaleDateString()}
                  </span>
                </div>
                <p className="text-neutral-300 text-sm mb-1">
                  <span className="text-neutral-400">Reason:</span> {reasonDisplay(strike.reason)}
                </p>
                {strike.details && (
                  <p className="text-neutral-400 text-sm mt-2 bg-neutral-800/50 p-2 rounded border border-neutral-700/50">
                    {strike.details}
                  </p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 pt-4 border-t border-neutral-800">
        <p className="text-neutral-400 text-xs mb-3">
          If you believe a strike was issued in error, please contact us to dispute it.
        </p>
        <a
          href="mailto:info@cochranfilms.com?subject=Strike Dispute"
          className="inline-flex items-center gap-2 px-4 py-2 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-white rounded-lg text-sm transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          Contact Support
        </a>
      </div>
    </div>
  );
}

