"use client";

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { auth } from '@/lib/firebaseClient';
import { JobApplicationSuccessModal } from './JobApplicationSuccessModal';

type JobApplicationModalProps = {
  isOpen: boolean;
  onClose: () => void;
  opportunityId: string;
  opportunityTitle: string;
  opportunityCompany?: string;
  onSuccess?: () => void;
};

export function JobApplicationModal({
  isOpen,
  onClose,
  opportunityId,
  opportunityTitle,
  opportunityCompany,
  onSuccess
}: JobApplicationModalProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  
  // Form fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [portfolioUrl, setPortfolioUrl] = useState('');
  const [coverLetter, setCoverLetter] = useState('');
  const [rate, setRate] = useState('');
  const [availability, setAvailability] = useState('');
  const [additionalInfo, setAdditionalInfo] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      setError('Please sign in to apply');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      if (!auth?.currentUser) {
        setError('Please sign in to apply');
        return;
      }

      const idToken = await auth.currentUser.getIdToken();
      const response = await fetch('/api/jobs/apply', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({
          opportunityId,
          name: name || user.displayName || '',
          email: email || user.email || '',
          phone: phone || '',
          portfolioUrl: portfolioUrl || '',
          coverLetter: coverLetter || '',
          rate: rate || '',
          availability: availability || '',
          additionalInfo: additionalInfo || ''
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to submit application');
      }

      // Reset form
      setName('');
      setEmail('');
      setPhone('');
      setPortfolioUrl('');
      setCoverLetter('');
      setRate('');
      setAvailability('');
      setAdditionalInfo('');

      // Show success modal instead of closing immediately
      setShowSuccessModal(true);
      onSuccess?.();
    } catch (err: any) {
      setError(err.message || 'Failed to submit application');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-neutral-950 border border-neutral-800 p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-semibold text-white">Apply for Opportunity</h2>
            <p className="text-neutral-400 mt-1">{opportunityTitle}</p>
            {opportunityCompany && (
              <p className="text-sm text-neutral-500 mt-1">{opportunityCompany}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-white transition"
            disabled={loading}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2 text-neutral-300">
                Full Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder={user?.displayName || 'Your name'}
                className="w-full bg-neutral-900 border border-neutral-800 px-4 py-2 text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-ccaBlue"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2 text-neutral-300">
                Email *
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder={user?.email || 'your@email.com'}
                className="w-full bg-neutral-900 border border-neutral-800 px-4 py-2 text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-ccaBlue"
              />
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2 text-neutral-300">
                Phone Number
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+1 (555) 123-4567"
                className="w-full bg-neutral-900 border border-neutral-800 px-4 py-2 text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-ccaBlue"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2 text-neutral-300">
                Portfolio/Website URL
              </label>
              <input
                type="url"
                value={portfolioUrl}
                onChange={(e) => setPortfolioUrl(e.target.value)}
                placeholder="https://yourportfolio.com"
                className="w-full bg-neutral-900 border border-neutral-800 px-4 py-2 text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-ccaBlue"
              />
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2 text-neutral-300">
                Rate/Compensation
              </label>
              <input
                type="text"
                value={rate}
                onChange={(e) => setRate(e.target.value)}
                placeholder="e.g., $50/hour or $5000 project"
                className="w-full bg-neutral-900 border border-neutral-800 px-4 py-2 text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-ccaBlue"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2 text-neutral-300">
                Availability
              </label>
              <input
                type="text"
                value={availability}
                onChange={(e) => setAvailability(e.target.value)}
                placeholder="e.g., Full-time, Part-time, Immediate"
                className="w-full bg-neutral-900 border border-neutral-800 px-4 py-2 text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-ccaBlue"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2 text-neutral-300">
              Cover Letter *
            </label>
            <textarea
              value={coverLetter}
              onChange={(e) => setCoverLetter(e.target.value)}
              required
              rows={6}
              placeholder="Tell us why you're a great fit for this opportunity..."
              className="w-full bg-neutral-900 border border-neutral-800 px-4 py-2 text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-ccaBlue resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2 text-neutral-300">
              Additional Information
            </label>
            <textarea
              value={additionalInfo}
              onChange={(e) => setAdditionalInfo(e.target.value)}
              rows={4}
              placeholder="Any additional information you'd like to share..."
              className="w-full bg-neutral-900 border border-neutral-800 px-4 py-2 text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-ccaBlue resize-none"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-6 py-2 bg-white text-black hover:bg-neutral-100 border-2 border-ccaBlue font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Submitting...' : 'Submit Application'}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-6 py-2 bg-neutral-900 border border-neutral-800 text-neutral-300 hover:bg-neutral-800 transition-all disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
      
      {/* Success Modal */}
      <JobApplicationSuccessModal
        isOpen={showSuccessModal}
        onClose={() => {
          setShowSuccessModal(false);
          onClose();
        }}
        opportunityTitle={opportunityTitle}
        opportunityCompany={opportunityCompany}
      />
    </div>
  );
}

