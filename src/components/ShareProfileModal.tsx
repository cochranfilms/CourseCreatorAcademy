"use client";

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

type ShareProfileModalProps = {
  isOpen: boolean;
  onClose: () => void;
  profileUrl: string;
  profileName?: string;
};

export function ShareProfileModal({ isOpen, onClose, profileUrl, profileName }: ShareProfileModalProps) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (copied) {
      const timer = setTimeout(() => setCopied(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [copied]);

  if (!isOpen) return null;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(profileUrl);
      setCopied(true);
    } catch (err) {
      console.error('Failed to copy:', err);
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = profileUrl;
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        setCopied(true);
      } catch (fallbackErr) {
        console.error('Fallback copy failed:', fallbackErr);
      }
      document.body.removeChild(textArea);
    }
  };

  const shareText = profileName 
    ? `Check out ${profileName}'s profile on Course Creator Academy!`
    : 'Check out this profile on Course Creator Academy!';

  const encodedUrl = encodeURIComponent(profileUrl);
  const encodedText = encodeURIComponent(shareText);

  const shareLinks = {
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
    twitter: `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedText}`,
    sms: `sms:?body=${encodedText}%20${encodedUrl}`,
  };

  const handleSocialShare = (platform: keyof typeof shareLinks) => {
    const url = shareLinks[platform];
    window.open(url, '_blank', 'width=600,height=400');
  };

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
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-neutral-800">
            <h2 className="text-xl font-bold">Share Profile</h2>
            <button
              onClick={onClose}
              className="text-neutral-400 hover:text-white transition"
              aria-label="Close"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="p-6">
            {/* Profile Link */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-neutral-400 mb-2">
                Profile Link
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={profileUrl}
                  className="flex-1 px-3 py-2 bg-neutral-800 border border-neutral-700 rounded text-sm text-white focus:outline-none focus:border-ccaBlue"
                />
                <button
                  onClick={handleCopyLink}
                  className={`px-4 py-2 rounded text-sm font-medium transition ${
                    copied
                      ? 'bg-green-600 text-white'
                      : 'bg-ccaBlue text-white hover:bg-ccaBlue/90'
                  }`}
                >
                  {copied ? (
                    <>
                      <svg className="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Copied!
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      Copy
                    </>
                  )}
                </button>
              </div>
              {copied && (
                <p className="mt-2 text-sm text-green-400">Link copied to clipboard!</p>
              )}
            </div>

            {/* Social Share Buttons */}
            <div>
              <label className="block text-sm font-medium text-neutral-400 mb-3">
                Share on Social Media
              </label>
              <div className="grid grid-cols-2 gap-3">
                {/* Facebook */}
                <button
                  onClick={() => handleSocialShare('facebook')}
                  className="flex items-center justify-center gap-2 px-4 py-3 bg-[#1877F2] hover:bg-[#166FE5] text-white rounded transition font-medium"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                  </svg>
                  Facebook
                </button>

                {/* LinkedIn */}
                <button
                  onClick={() => handleSocialShare('linkedin')}
                  className="flex items-center justify-center gap-2 px-4 py-3 bg-[#0077B5] hover:bg-[#006399] text-white rounded transition font-medium"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                  </svg>
                  LinkedIn
                </button>

                {/* X (Twitter) */}
                <button
                  onClick={() => handleSocialShare('twitter')}
                  className="flex items-center justify-center gap-2 px-4 py-3 bg-black hover:bg-neutral-900 text-white rounded transition font-medium border border-neutral-700"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                  </svg>
                  X
                </button>

                {/* SMS */}
                <button
                  onClick={() => handleSocialShare('sms')}
                  className="flex items-center justify-center gap-2 px-4 py-3 bg-neutral-800 hover:bg-neutral-700 text-white rounded transition font-medium border border-neutral-700"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  SMS
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}

