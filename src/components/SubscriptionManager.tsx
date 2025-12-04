"use client";
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';

type PlanDetails = {
  name: string;
  price: number;
  planType: string;
  features: string[];
  notIncluded?: string[];
  popular?: boolean;
};

const PLAN_FEATURES: Record<string, PlanDetails> = {
  cca_monthly_37: {
    name: 'Monthly Membership',
    price: 37,
    planType: 'cca_monthly_37',
    popular: false,
    features: [
      'Stream all videos',
      'Access future content',
      'Community + downloads',
      'Marketplace access',
      'Job board access',
    ],
    notIncluded: [
      '3% platform fee on marketplace sales',
      '3% platform fee on job listing deposits',
      'Legacy Creator profile access',
    ],
  },
  cca_no_fees_60: {
    name: 'No-Fees Membership',
    price: 60,
    planType: 'cca_no_fees_60',
    popular: true,
    features: [
      'Everything in Monthly Membership',
      '0% platform fee on marketplace sales',
      '0% platform fee on job listings',
    ],
    notIncluded: [
      'Legacy Creator profile access',
    ],
  },
  cca_membership_87: {
    name: 'All-Access Membership',
    price: 87,
    planType: 'cca_membership_87',
    popular: false,
    features: [
      'Everything in Monthly Membership',
      'Complete access to all Legacy Creator profiles',
      '0% platform fee on marketplace sales',
      '0% platform fee on job listings',
      'All assets, job opportunities, and marketplace access',
    ],
    notIncluded: [],
  },
};

type SubscriptionManagerProps = {
  isOpen: boolean;
  onClose: () => void;
  currentPlanType: string | null;
  membershipActive: boolean;
};

export function SubscriptionManager({ isOpen, onClose, currentPlanType, membershipActive }: SubscriptionManagerProps) {
  const { user } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [prorationPreview, setProrationPreview] = useState<{
    amount: number;
    isUpgrade: boolean;
    message: string;
    planType: string;
  } | null>(null);
  const [canceling, setCanceling] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [showCancelSuccess, setShowCancelSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setSelectedPlan(null);
      setProrationPreview(null);
      setShowCancelConfirm(false);
      setError(null);
    }
  }, [isOpen]);

  const handlePlanSelect = async (planType: string) => {
    if (!user || !membershipActive || planType === currentPlanType) return;

    setLoading(true);
    setSelectedPlan(planType);

    try {
      const token = await user.getIdToken();
      const previewRes = await fetch('/api/subscription/change-plan', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ newPlanType: planType, preview: true }),
      });

      if (previewRes.ok) {
        const preview = await previewRes.json();
        setProrationPreview({
          amount: preview.prorationAmount || 0,
          isUpgrade: preview.isUpgrade || false,
          message: preview.message || '',
          planType: planType,
        });
      } else {
        const errorData = await previewRes.json();
        setError(errorData.error || 'Failed to calculate plan change details');
      }
    } catch (err) {
      console.error('Error calculating proration:', err);
      setError('Failed to calculate plan change details. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmChange = async () => {
    if (!user || !prorationPreview) return;

    setLoading(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/subscription/checkout', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ newPlanType: prorationPreview.planType }),
      });

      const data = await res.json();
      if (res.ok) {
        if (data.requiresPayment && data.checkoutUrl) {
          // Redirect to Stripe Checkout for payment
          window.location.href = data.checkoutUrl;
        } else {
          // Downgrade successful
          onClose();
          window.location.reload();
        }
      } else {
        setError(data.error || 'Failed to change plan');
        setProrationPreview(null);
      }
    } catch (err: any) {
      console.error('Error changing plan:', err);
      setError(err.message || 'Failed to change plan');
      setProrationPreview(null);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelSubscription = async () => {
    if (!user) return;

    setCanceling(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/subscription/cancel', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await res.json();
      if (res.ok) {
        setShowCancelConfirm(false);
        setShowCancelSuccess(true);
      } else {
        setError(data.error || 'Failed to cancel subscription');
        setShowCancelConfirm(false);
      }
    } catch (err: any) {
      console.error('Error canceling subscription:', err);
      setError(err.message || 'Failed to cancel subscription');
      setShowCancelConfirm(false);
    } finally {
      setCanceling(false);
    }
  };

  if (!isOpen) return null;

  const plans = Object.values(PLAN_FEATURES);
  const currentPlan = currentPlanType ? PLAN_FEATURES[currentPlanType] : null;

  return (
    <>
      {/* Main Modal */}
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-neutral-950 border border-neutral-800 rounded-lg max-w-5xl w-full max-h-[90vh] overflow-y-auto shadow-xl">
          {/* Header */}
          <div className="sticky top-0 bg-neutral-950 border-b border-neutral-800 p-6 flex items-center justify-between z-10">
            <div>
              <h2 className="text-2xl font-semibold text-white mb-1">Change Subscription</h2>
              <p className="text-sm text-neutral-400">Select a plan to upgrade or downgrade</p>
            </div>
            <button
              onClick={onClose}
              className="text-neutral-400 hover:text-white transition p-2 rounded-lg hover:bg-neutral-800"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Plans Grid */}
          <div className="p-6">
            {error && (
              <div className="mb-4 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                <div className="flex items-center gap-2 text-red-400 text-sm">
                  <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>{error}</span>
                  <button
                    onClick={() => setError(null)}
                    className="ml-auto text-red-400 hover:text-red-300"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              {plans.map((plan) => {
                const isCurrentPlan = plan.planType === currentPlanType;
                const isSelected = selectedPlan === plan.planType;
                const isUpgrade = currentPlan && plan.price > currentPlan.price;
                const isDowngrade = currentPlan && plan.price < currentPlan.price;

                return (
                  <div
                    key={plan.planType}
                    className={`relative border-2 rounded-lg p-6 transition-all cursor-pointer ${
                      isCurrentPlan
                        ? 'border-ccaBlue bg-ccaBlue/10'
                        : isSelected
                        ? 'border-ccaBlue bg-ccaBlue/5'
                        : 'border-neutral-800 bg-neutral-900/50 hover:border-neutral-700'
                    }`}
                    onClick={() => !isCurrentPlan && handlePlanSelect(plan.planType)}
                  >
                    {plan.popular && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                        <span className="bg-gradient-to-r from-orange-500 to-red-500 text-white text-xs font-semibold px-3 py-1 rounded-full">
                          Popular
                        </span>
                      </div>
                    )}

                    {isCurrentPlan && (
                      <div className="absolute -top-3 right-4">
                        <span className="bg-green-500/20 text-green-400 text-xs font-semibold px-3 py-1 rounded-full border border-green-500/30">
                          Current Plan
                        </span>
                      </div>
                    )}

                    <div className="mb-4">
                      <h3 className="text-xl font-bold text-white mb-1">{plan.name}</h3>
                      <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-bold text-white">${plan.price}</span>
                        <span className="text-neutral-400">/month</span>
                      </div>
                    </div>

                    <div className="space-y-3 mb-6">
                      <div className="text-sm font-semibold text-neutral-300">What's Included:</div>
                      <ul className="space-y-2">
                        {plan.features.map((feature, idx) => (
                          <li key={idx} className="flex items-start gap-2 text-sm text-neutral-300">
                            <svg className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            {feature}
                          </li>
                        ))}
                      </ul>
                      {plan.notIncluded && plan.notIncluded.length > 0 && (
                        <>
                          <div className="text-sm font-semibold text-neutral-400 mt-4">Not Included:</div>
                          <ul className="space-y-2">
                            {plan.notIncluded.map((feature, idx) => (
                              <li key={idx} className="flex items-start gap-2 text-sm text-neutral-400">
                                <svg className="w-5 h-5 text-neutral-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                                {feature}
                              </li>
                            ))}
                          </ul>
                        </>
                      )}
                    </div>

                    {isCurrentPlan ? (
                      <button
                        disabled
                        className="w-full px-4 py-2 bg-neutral-800 text-neutral-500 rounded-lg text-sm font-medium cursor-not-allowed"
                      >
                        Current Plan
                      </button>
                    ) : (
                      <button
                        onClick={() => handlePlanSelect(plan.planType)}
                        disabled={loading}
                        className={`w-full px-4 py-2 rounded-lg text-sm font-medium transition ${
                          isUpgrade
                            ? 'bg-ccaBlue hover:bg-ccaBlue/90 text-white'
                            : isDowngrade
                            ? 'bg-neutral-800 hover:bg-neutral-700 text-white'
                            : 'bg-neutral-800 hover:bg-neutral-700 text-white'
                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                      >
                        {loading && selectedPlan === plan.planType
                          ? 'Calculating...'
                          : isUpgrade
                          ? 'Upgrade'
                          : isDowngrade
                          ? 'Downgrade'
                          : 'Select'}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Cancel Subscription Button */}
            {membershipActive && currentPlanType && (
              <div className="border-t border-neutral-800 pt-6 mt-6">
                <button
                  onClick={() => setShowCancelConfirm(true)}
                  className="w-full px-4 py-2 bg-neutral-900 border border-red-500/30 text-red-400 hover:bg-red-500/10 rounded-lg text-sm font-medium transition"
                >
                  Cancel Subscription
                </button>
                <p className="text-xs text-neutral-500 mt-2 text-center">
                  You can cancel anytime. No refunds will be issued.
                </p>
              </div>
            )}
          </div>

          {/* Proration Preview Modal */}
          {prorationPreview && (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
              <div className="bg-neutral-950 border border-neutral-800 rounded-lg p-6 max-w-md w-full shadow-xl">
                <h3 className="text-lg font-semibold text-white mb-4">
                  {prorationPreview.isUpgrade ? 'Confirm Upgrade' : 'Confirm Plan Change'}
                </h3>
                <div className="mb-4">
                  <p className="text-sm text-neutral-300 mb-3">{prorationPreview.message}</p>
                  {prorationPreview.amount > 0 && (
                    <div className={`text-lg font-semibold ${
                      prorationPreview.isUpgrade ? 'text-white' : 'text-green-400'
                    }`}>
                      {prorationPreview.isUpgrade 
                        ? `Amount to Pay: $${(prorationPreview.amount / 100).toFixed(2)}`
                        : `Credit Applied: $${(prorationPreview.amount / 100).toFixed(2)}`
                      }
                    </div>
                  )}
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={handleConfirmChange}
                    disabled={loading}
                    className="flex-1 px-4 py-2 bg-ccaBlue hover:bg-ccaBlue/90 text-white rounded-lg text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? 'Processing...' : prorationPreview.isUpgrade ? 'Proceed to Payment' : 'Confirm Change'}
                  </button>
                  <button
                    onClick={() => setProrationPreview(null)}
                    disabled={loading}
                    className="px-4 py-2 bg-neutral-700 hover:bg-neutral-600 text-white rounded-lg text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Cancel Confirmation Modal */}
      {showCancelConfirm && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-neutral-950 border border-neutral-800 rounded-lg p-6 max-w-md w-full shadow-xl">
            <h3 className="text-lg font-semibold text-white mb-4">Cancel Subscription</h3>
            <p className="text-sm text-neutral-300 mb-6">
              Are you sure you want to cancel your subscription? You will retain access until the end of your current billing period. No refunds will be issued.
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleCancelSubscription}
                disabled={canceling}
                className="flex-1 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {canceling ? 'Canceling...' : 'Yes, Cancel Subscription'}
              </button>
              <button
                onClick={() => setShowCancelConfirm(false)}
                disabled={canceling}
                className="px-4 py-2 bg-neutral-700 hover:bg-neutral-600 text-white rounded-lg text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Keep Subscription
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Success Modal */}
      {showCancelSuccess && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-neutral-950 border border-neutral-800 rounded-lg p-6 max-w-md w-full shadow-xl">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Subscription Canceled</h3>
              <p className="text-sm text-neutral-300">
                Your subscription has been canceled. You will retain access until the end of your current billing period.
              </p>
            </div>
            <button
              onClick={() => {
                setShowCancelSuccess(false);
                onClose();
                router.push('/');
              }}
              className="w-full px-4 py-2 bg-ccaBlue hover:bg-ccaBlue/90 text-white rounded-lg text-sm font-medium transition"
            >
              Confirm
            </button>
          </div>
        </div>
      )}
    </>
  );
}

