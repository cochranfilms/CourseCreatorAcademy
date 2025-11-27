"use client";

import { createPortal } from 'react-dom';

type JobApplicationSuccessModalProps = {
  isOpen: boolean;
  onClose: () => void;
  opportunityTitle?: string;
  opportunityCompany?: string;
};

export function JobApplicationSuccessModal({
  isOpen,
  onClose,
  opportunityTitle,
  opportunityCompany
}: JobApplicationSuccessModalProps) {
  if (!isOpen) return null;

  return typeof window !== 'undefined' && createPortal(
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[150]"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="fixed inset-0 z-[160] flex items-center justify-center p-4 pointer-events-none">
        <div 
          className="bg-neutral-900 border border-neutral-800 rounded-lg shadow-2xl w-full max-w-md pointer-events-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Success Icon */}
          <div className="flex flex-col items-center p-8">
            <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mb-4">
              <svg className="w-10 h-10 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            
            <h2 className="text-2xl font-bold text-white mb-2">Application Submitted!</h2>
            
            <p className="text-neutral-400 text-center mb-6">
              Your application for{' '}
              <span className="font-semibold text-white">{opportunityTitle}</span>
              {opportunityCompany && (
                <>
                  {' '}at <span className="font-semibold text-white">{opportunityCompany}</span>
                </>
              )}
              {' '}has been successfully submitted.
            </p>
            
            <div className="bg-neutral-800/50 border border-neutral-700 rounded-lg p-4 mb-6 w-full">
              <p className="text-sm text-neutral-300 text-center">
                <strong className="text-white">What's next?</strong>
              </p>
              <p className="text-sm text-neutral-400 text-center mt-2">
                Keep an eye on your notifications. You'll receive an email when the employer reviews your application and makes a decision.
              </p>
            </div>
            
            <button
              onClick={onClose}
              className="w-full px-6 py-3 bg-ccaBlue text-white hover:bg-ccaBlue/90 transition font-medium rounded"
            >
              Got it!
            </button>
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}

