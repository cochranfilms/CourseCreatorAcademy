"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { auth } from '@/lib/firebaseClient';

interface DiscountRedemptionModalProps {
  discountId: string;
  discountTitle: string;
  onClose: () => void;
}

export function DiscountRedemptionModal({
  discountId,
  discountTitle,
  onClose,
}: DiscountRedemptionModalProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [discount, setDiscount] = useState<{
    discountCode?: string;
    discountLink?: string;
    discountType: string;
    description?: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const redeemDiscount = async () => {
      if (!user || !auth.currentUser) {
        setError('Please sign in to redeem discounts');
        setLoading(false);
        return;
      }

      try {
        const idToken = await auth.currentUser.getIdToken();
        const response = await fetch(`/api/discounts/${discountId}/redeem`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${idToken}`,
          },
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to redeem discount');
        }

        setDiscount(data.discount);
      } catch (err: any) {
        setError(err.message || 'Failed to redeem discount');
      } finally {
        setLoading(false);
      }
    };

    redeemDiscount();
  }, [discountId, user]);

  const copyCode = async () => {
    if (discount?.discountCode) {
      await navigator.clipboard.writeText(discount.discountCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-neutral-950 border border-neutral-800 rounded-lg max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-white">{discountTitle}</h2>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-white transition"
            disabled={loading}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-ccaBlue"></div>
          </div>
        )}

        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded">
            {error}
          </div>
        )}

        {!loading && !error && discount && (
          <div className="space-y-4">
            {discount.description && (
              <p className="text-neutral-400 text-sm">{discount.description}</p>
            )}

            {(discount.discountType === 'code' || discount.discountType === 'both') &&
              discount.discountCode && (
                <div>
                  <label className="block text-sm text-neutral-400 mb-2">Discount Code</label>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-neutral-900 border border-neutral-800 rounded-lg px-4 py-3 font-mono text-lg text-white">
                      {discount.discountCode}
                    </div>
                    <button
                      onClick={copyCode}
                      className="px-4 py-3 bg-ccaBlue hover:opacity-90 transition text-white font-medium rounded-lg"
                    >
                      {copied ? (
                        <svg
                          className="w-5 h-5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      ) : (
                        <svg
                          className="w-5 h-5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                          />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
              )}

            {discount.discountLink && (
              <div>
                <a
                  href={discount.discountLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full px-4 py-3 bg-ccaBlue hover:opacity-90 transition text-white font-medium text-center rounded-lg flex items-center justify-center gap-2"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                    />
                  </svg>
                  Visit Partner Website
                </a>
              </div>
            )}

            <div className="pt-4 border-t border-neutral-800">
              <p className="text-xs text-neutral-500">
                Your redemption has been recorded. Use the code or link above to claim your
                discount.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

