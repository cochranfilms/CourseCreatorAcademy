"use client";
import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';
import Image from 'next/image';
import { db, firebaseReady } from '@/lib/firebaseClient';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';

type Subscription = {
  id: string;
  creatorId: string;
  subscriptionId: string;
  status: string;
  amount: number;
  currency: string;
  creator?: {
    id: string;
    displayName: string;
    handle?: string;
    avatarUrl?: string | null;
  };
};

type PlanDetails = {
  name: string;
  price: number;
  features: string[];
  notIncluded?: string[];
  planType: string;
};

const PLAN_FEATURES: Record<string, PlanDetails> = {
  cca_monthly_37: {
    name: 'Monthly Membership',
    price: 37,
    planType: 'cca_monthly_37',
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

export function LegacySubscriptions() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [membershipActive, setMembershipActive] = useState<boolean>(false);
  const [planType, setPlanType] = useState<string | null>(null);
  const [subscriptionDetails, setSubscriptionDetails] = useState<any>(null);
  const [changingPlan, setChangingPlan] = useState(false);
  const [prorationPreview, setProrationPreview] = useState<{ amount: number; isUpgrade: boolean; message: string; planType: string } | null>(null);

  useEffect(() => {
    const load = async () => {
      if (!user) {
        setSubscriptions([]);
        setLoading(false);
        return;
      }

      try {
        let subs: Subscription[] | null = null;
        try {
          const res = await fetch(`/api/legacy/subscriptions?userId=${user.uid}`);
          const json = await res.json();
          if (res.ok && Array.isArray(json.subscriptions)) {
            subs = json.subscriptions as Subscription[];
          }
        } catch {}

        // Fallback: query directly from Firestore (client) if API not available locally
        if (!subs && firebaseReady && db) {
          try {
            const q = query(collection(db, 'legacySubscriptions'), where('userId', '==', user.uid));
            const snap = await getDocs(q);
            const raw = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
            const filtered = raw.filter((r: any) => ['active', 'trialing'].includes(String(r.status || '')));
            subs = filtered.map((r: any) => ({
              id: r.id,
              creatorId: String(r.creatorId || ''),
              subscriptionId: String(r.subscriptionId || ''),
              status: String(r.status || 'active'),
              amount: Number(r.amount || 1000),
              currency: String(r.currency || 'usd'),
            }));
          } catch {}
        }

        setSubscriptions(subs || []);

        // Get membership details
        if (firebaseReady && db) {
          try {
            const ref = doc(db, 'users', user.uid);
            const snap = await getDoc(ref);
            if (snap.exists()) {
              const data = snap.data() as any;
              if (typeof data?.membershipActive === 'boolean') {
                setMembershipActive(Boolean(data.membershipActive));
              }
              if (data?.membershipPlan) {
                setPlanType(String(data.membershipPlan));
              }
            }
          } catch {}

          // Fetch subscription details from API
          try {
            const token = await user.getIdToken();
            const res = await fetch('/api/subscription/details', {
              headers: {
                'Authorization': `Bearer ${token}`,
              },
            });
            if (res.ok) {
              const details = await res.json();
              setSubscriptionDetails(details);
            }
          } catch {}
        }
      } catch (e) {
        setSubscriptions([]);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [user]);

  const handleChangePlan = async (newPlanType: string, showPreview: boolean = true) => {
    if (!user || changingPlan) return;

    // If showing preview, calculate proration first
    if (showPreview) {
      try {
        const token = await user.getIdToken();
        const previewRes = await fetch('/api/subscription/change-plan', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ newPlanType, preview: true }),
        });

        if (previewRes.ok) {
          const preview = await previewRes.json();
          setProrationPreview({
            amount: preview.prorationAmount || 0,
            isUpgrade: preview.isUpgrade || false,
            message: preview.message || '',
            planType: newPlanType,
          });
          return; // Don't proceed yet, wait for user confirmation
        }
      } catch (err) {
        console.error('Error calculating proration:', err);
        setProrationPreview({
          amount: 0,
          isUpgrade: false,
          message: 'Failed to calculate proration. Please try again.',
          planType: newPlanType,
        });
        return;
      }
    }

    // Proceed with plan change
    setChangingPlan(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/subscription/checkout', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ newPlanType }),
      });

      const data = await res.json();
      if (res.ok) {
        if (data.requiresPayment && data.checkoutUrl) {
          // Redirect to Stripe Checkout for payment
          window.location.href = data.checkoutUrl;
        } else {
          // Downgrade or no payment needed - show success with credit amount
          const creditMessage = data.creditAmount && data.creditAmount > 0
            ? `Plan downgraded successfully! A credit of $${(data.creditAmount / 100).toFixed(2)} has been applied to your account.`
            : data.message || 'Plan changed successfully!';
          
          setProrationPreview({
            amount: data.creditAmount || 0,
            isUpgrade: false,
            message: creditMessage,
            planType: newPlanType,
          });
          // Reload after a short delay to show success message
          setTimeout(() => {
            window.location.reload();
          }, 3000);
        }
      } else {
        setProrationPreview({
          amount: 0,
          isUpgrade: false,
          message: data.error || 'Failed to change plan',
          planType: newPlanType,
        });
      }
    } catch (err: any) {
      setProrationPreview({
        amount: 0,
        isUpgrade: false,
        message: err.message || 'Failed to change plan',
        planType: newPlanType,
      });
    } finally {
      setChangingPlan(false);
    }
  };

  const getAvailablePlans = (): { upgrade: string | null; downgrade: string | null } => {
    if (!planType) {
      return { upgrade: null, downgrade: null };
    }
    
    const currentPlanIndex = ['cca_monthly_37', 'cca_no_fees_60', 'cca_membership_87'].indexOf(planType);
    const plans = ['cca_monthly_37', 'cca_no_fees_60', 'cca_membership_87'];
    
    return {
      upgrade: currentPlanIndex < plans.length - 1 ? plans[currentPlanIndex + 1] : null,
      downgrade: currentPlanIndex > 0 ? plans[currentPlanIndex - 1] : null,
    };
  };

  if (!user) return null;
  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-neutral-400">Loading subscriptions...</div>
      </div>
    );
  }

  const currentPlan = planType ? PLAN_FEATURES[planType] : null;
  const availablePlans = getAvailablePlans();
  const nextBillingDate = subscriptionDetails?.nextBillingDate 
    ? new Date(subscriptionDetails.nextBillingDate).toLocaleDateString()
    : null;

  return (
    <div className="space-y-6">
      {/* CCA Membership Card */}
      <div className="bg-neutral-950 border border-neutral-800 rounded-lg p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <div className="font-semibold text-white text-lg">CCA Membership</div>
              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                membershipActive 
                  ? 'bg-green-500/20 text-green-400' 
                  : 'bg-red-500/20 text-red-400'
              }`}>
                {membershipActive ? 'Active' : 'Inactive'}
              </span>
            </div>
            
            {!membershipActive ? (
              <div className="mt-4">
                <p className="text-neutral-400 mb-4">You don't have an active subscription. Choose a plan to get started:</p>
                <div className="flex flex-wrap gap-3">
                  <Link href="/" className="px-4 py-2 bg-ccaBlue hover:bg-ccaBlue/90 text-white rounded-lg text-sm font-medium transition">
                    View Plans
                  </Link>
                </div>
              </div>
            ) : currentPlan ? (
              <div className="space-y-4">
                <div>
                  <div className="text-2xl font-bold text-white mb-1">
                    {currentPlan.name} - ${currentPlan.price}/month
                  </div>
                  {nextBillingDate && (
                    <div className="text-sm text-neutral-400">
                      Next billing date: {nextBillingDate}
                    </div>
                  )}
                </div>

                {/* Features Included */}
                <div>
                  <div className="text-sm font-semibold text-neutral-300 mb-2">What's Included:</div>
                  <ul className="space-y-1.5">
                    {currentPlan.features.map((feature, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-sm text-neutral-400">
                        <svg className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        {feature}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Features Not Included */}
                {currentPlan.notIncluded && currentPlan.notIncluded.length > 0 && (
                  <div>
                    <div className="text-sm font-semibold text-neutral-300 mb-2">Not Included:</div>
                    <ul className="space-y-1.5">
                      {currentPlan.notIncluded.map((feature, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-sm text-neutral-400">
                          <svg className="w-4 h-4 text-neutral-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                          {feature}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Upgrade/Downgrade Buttons */}
                <div className="flex flex-wrap gap-3 pt-4 border-t border-neutral-800">
                  {availablePlans.upgrade && (
                    <button
                      onClick={() => handleChangePlan(availablePlans.upgrade!, true)}
                      disabled={changingPlan}
                      className="px-4 py-2 bg-ccaBlue hover:bg-ccaBlue/90 text-white rounded-lg text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {changingPlan ? 'Processing...' : `Upgrade to ${PLAN_FEATURES[availablePlans.upgrade].name}`}
                    </button>
                  )}
                  {availablePlans.downgrade && (
                    <button
                      onClick={() => handleChangePlan(availablePlans.downgrade!, true)}
                      disabled={changingPlan}
                      className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-white rounded-lg text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {changingPlan ? 'Processing...' : `Downgrade to ${PLAN_FEATURES[availablePlans.downgrade].name}`}
                    </button>
                  )}
                </div>

                {/* Proration Preview/Status Modal */}
                {prorationPreview && (
                  <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-neutral-950 border border-neutral-800 rounded-lg p-6 max-w-md w-full shadow-xl">
                      <div className="mb-4">
                        <h3 className="text-lg font-semibold text-white mb-2">
                          {prorationPreview.isUpgrade ? 'Confirm Upgrade' : prorationPreview.message.includes('successfully') ? 'Plan Changed' : 'Confirm Plan Change'}
                        </h3>
                        <div className={`text-sm ${
                          prorationPreview.message.includes('successfully') || prorationPreview.message.includes('Credit')
                            ? 'text-green-400'
                            : prorationPreview.message.includes('Failed')
                            ? 'text-red-400'
                            : 'text-neutral-300'
                        }`}>
                          {prorationPreview.message}
                        </div>
                        {prorationPreview.amount > 0 && (
                          <div className={`mt-3 text-lg font-semibold ${
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
                        {!prorationPreview.message.includes('successfully') && !prorationPreview.message.includes('Credit') && (
                          <button
                            onClick={() => handleChangePlan(prorationPreview.planType, false)}
                            disabled={changingPlan}
                            className="flex-1 px-4 py-2 bg-ccaBlue hover:bg-ccaBlue/90 text-white rounded-lg text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {changingPlan ? 'Processing...' : prorationPreview.isUpgrade ? 'Proceed to Payment' : 'Confirm Change'}
                          </button>
                        )}
                        <button
                          onClick={() => {
                            setProrationPreview(null);
                            if (prorationPreview.message.includes('successfully')) {
                              window.location.reload();
                            }
                          }}
                          disabled={changingPlan}
                          className={`px-4 py-2 ${
                            prorationPreview.message.includes('successfully') || prorationPreview.message.includes('Credit')
                              ? 'bg-ccaBlue hover:bg-ccaBlue/90'
                              : 'bg-neutral-700 hover:bg-neutral-600'
                          } text-white rounded-lg text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed`}
                        >
                          {prorationPreview.message.includes('successfully') || prorationPreview.message.includes('Credit') ? 'OK' : 'Cancel'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-sm text-neutral-400">
                Platform access to courses, community, and marketplace
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Legacy+ Subscriptions */}
      {subscriptions.length === 0 ? (
        <div className="text-center py-6">
          <p className="text-neutral-400 mb-4">You don't have any active Legacy+ subscriptions.</p>
          <Link href="/learn" className="text-ccaBlue hover:underline">Browse Creator Kits</Link>
        </div>
      ) : (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-white">Legacy+ Creator Subscriptions</h3>
          {subscriptions.map((sub) => (
            <div
              key={sub.id}
              className="bg-neutral-950 border border-neutral-800 rounded-lg p-4 flex items-center justify-between"
            >
              <div className="flex items-center gap-4">
                {sub.creator?.avatarUrl && (
                  <div className="relative w-12 h-12 rounded-full overflow-hidden bg-neutral-800 flex-shrink-0">
                    <Image src={sub.creator.avatarUrl} alt={sub.creator.displayName} fill sizes="48px" className="object-cover" />
                  </div>
                )}
                <div>
                  <div className="font-semibold text-white">{sub.creator?.displayName || 'Creator'}</div>
                  {sub.creator?.handle && <div className="text-sm text-neutral-400">@{sub.creator.handle}</div>}
                  <div className="text-xs text-neutral-500 mt-1">
                    ${(sub.amount / 100).toFixed(2)}/{sub.currency === 'usd' ? 'mo' : 'month'}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                  sub.status === 'active' 
                    ? 'bg-green-500/20 text-green-400' 
                    : 'bg-yellow-500/20 text-yellow-400'
                }`}>
                  {sub.status === 'active' ? 'Active' : 'Trialing'}
                </span>
                {sub.creator && (
                  <Link
                    href={`/learn?section=creator-kits&kit=${encodeURIComponent(sub.creator.id)}`}
                    className="px-4 py-2 bg-ccaBlue hover:bg-ccaBlue/90 text-white rounded-lg text-sm font-medium transition"
                  >
                    View Kit
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
