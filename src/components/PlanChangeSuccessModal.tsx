"use client";
import { useEffect } from 'react';

type PlanChangeSuccessModalProps = {
  isOpen: boolean;
  onClose: () => void;
  planType: string | null;
  isUpgrade: boolean;
  amount?: number;
  creditAmount?: number;
};

const PLAN_NAMES: Record<string, string> = {
  cca_membership_87: 'All-Access Membership',
  cca_no_fees_60: 'No-Fees Membership',
  cca_monthly_37: 'Monthly Membership',
};

export function PlanChangeSuccessModal({
  isOpen,
  onClose,
  planType,
  isUpgrade,
  amount,
  creditAmount,
}: PlanChangeSuccessModalProps) {
  useEffect(() => {
    if (isOpen) {
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = 'unset';
      };
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const planName = planType ? PLAN_NAMES[planType] || 'your new plan' : 'your new plan';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm">
      <div className="relative bg-gray-900 rounded-lg shadow-xl max-w-md w-full mx-4 border border-gray-700">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
          aria-label="Close"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Content */}
        <div className="p-6">
          {/* Success Icon */}
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center">
              <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          </div>

          {/* Title */}
          <h2 className="text-2xl font-bold text-white text-center mb-2">
            {isUpgrade ? 'Plan Upgraded Successfully!' : 'Plan Downgraded Successfully!'}
          </h2>

          {/* Message */}
          <p className="text-gray-300 text-center mb-6">
            {isUpgrade
              ? `You're now on ${planName}. Your subscription has been updated and will be reflected on your next billing cycle.`
              : `You've been downgraded to ${planName}. Your subscription has been updated.`}
          </p>

          {/* Amount Display */}
          {(amount || creditAmount) && (
            <div className="bg-gray-800 rounded-lg p-4 mb-6 border border-gray-700">
              <div className="flex justify-between items-center">
                <span className="text-gray-400">
                  {isUpgrade ? 'Amount Charged:' : 'Credit Applied:'}
                </span>
                <span className={`text-lg font-semibold ${isUpgrade ? 'text-white' : 'text-green-400'}`}>
                  {isUpgrade
                    ? `$${((amount || 0) / 100).toFixed(2)}`
                    : `$${((creditAmount || 0) / 100).toFixed(2)}`}
                </span>
              </div>
              {!isUpgrade && creditAmount && creditAmount > 0 && (
                <p className="text-sm text-gray-400 mt-2">
                  This credit will be applied to your next billing cycle.
                </p>
              )}
            </div>
          )}

          {/* Action Button */}
          <button
            onClick={() => {
              onClose();
              // Reload after a short delay to ensure data is synced
              setTimeout(() => {
                window.location.reload();
              }, 500);
            }}
            className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors"
          >
            Continue to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}

