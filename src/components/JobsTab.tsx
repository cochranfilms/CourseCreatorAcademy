"use client";

import { useEffect, useState } from 'react';
import { collection, query, where, getDocs, orderBy, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { db, firebaseReady, auth } from '@/lib/firebaseClient';
import { useAuth } from '@/contexts/AuthContext';

type JobApplication = {
  id: string;
  opportunityId: string;
  applicantId: string;
  posterId: string;
  opportunityTitle: string;
  opportunityCompany?: string;
  name: string;
  email: string;
  phone?: string;
  portfolioUrl?: string;
  coverLetter: string;
  rate?: string;
  availability?: string;
  additionalInfo?: string;
  status: 'pending' | 'hired' | 'rejected' | 'completed' | 'paid';
  createdAt?: any;
  hiredAt?: any;
  completedAt?: any;
  depositAmount?: number;
  totalAmount?: number;
  depositPaymentIntentId?: string;
  finalPaymentIntentId?: string;
  finalPaymentPaid?: boolean;
};

type JobsTabProps = {
  userId: string;
  isOwnProfile: boolean;
};

export function JobsTab({ userId, isOwnProfile }: JobsTabProps) {
  const { user } = useAuth();
  const [applicationsSent, setApplicationsSent] = useState<JobApplication[]>([]);
  const [applicationsReceived, setApplicationsReceived] = useState<JobApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingHire, setProcessingHire] = useState<string | null>(null);
  const [processingComplete, setProcessingComplete] = useState<string | null>(null);
  const [processingPayment, setProcessingPayment] = useState<string | null>(null);

  useEffect(() => {
    if (!firebaseReady || !db || !userId) {
      setLoading(false);
      return;
    }

    console.log('JobsTab: Fetching applications for userId:', userId);

    // Fetch applications sent (where user is applicant)
    const sentQuery = query(
      collection(db, 'jobApplications'),
      where('applicantId', '==', userId),
      orderBy('createdAt', 'desc')
    );

    const sentUnsub = onSnapshot(
      sentQuery,
      (snap) => {
        console.log('JobsTab: Applications sent query success, count:', snap.docs.length);
        const apps = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as any)
        })) as JobApplication[];
        console.log('JobsTab: Applications sent data:', apps);
        setApplicationsSent(apps);
        setLoading(false);
      },
      (error) => {
        console.error('Error fetching applications sent:', error);
        // Fallback without orderBy if index doesn't exist
        const fallbackQuery = query(
          collection(db, 'jobApplications'),
          where('applicantId', '==', userId)
        );
        onSnapshot(fallbackQuery, (snap) => {
          console.log('JobsTab: Applications sent fallback query success, count:', snap.docs.length);
          const apps = snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as any)
          })) as JobApplication[];
          console.log('JobsTab: Applications sent fallback data:', apps);
          // Sort client-side by createdAt
          const sortedApps = apps.sort((a, b) => {
            const aTime = a.createdAt?.toDate?.() || a.createdAt || 0;
            const bTime = b.createdAt?.toDate?.() || b.createdAt || 0;
            return bTime - aTime;
          });
          setApplicationsSent(sortedApps);
          setLoading(false);
        });
      }
    );

    // Fetch applications received (where user posted the opportunity)
    const receivedQuery = query(
      collection(db, 'jobApplications'),
      where('posterId', '==', userId),
      orderBy('createdAt', 'desc')
    );

    const receivedUnsub = onSnapshot(
      receivedQuery,
      (snap) => {
        console.log('JobsTab: Applications received query success, count:', snap.docs.length);
        const apps = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as any)
        })) as JobApplication[];
        console.log('JobsTab: Applications received data:', apps);
        setApplicationsReceived(apps);
        setLoading(false);
      },
      (error) => {
        console.error('Error fetching applications received:', error);
        // Fallback without orderBy if index doesn't exist
        const fallbackQuery = query(
          collection(db, 'jobApplications'),
          where('posterId', '==', userId)
        );
        onSnapshot(fallbackQuery, (snap) => {
          console.log('JobsTab: Applications received fallback query success, count:', snap.docs.length);
          const apps = snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as any)
          })) as JobApplication[];
          console.log('JobsTab: Applications received fallback data:', apps);
          // Sort client-side by createdAt
          const sortedApps = apps.sort((a, b) => {
            const aTime = a.createdAt?.toDate?.() || a.createdAt || 0;
            const bTime = b.createdAt?.toDate?.() || b.createdAt || 0;
            return bTime - aTime;
          });
          setApplicationsReceived(sortedApps);
          setLoading(false);
        });
      }
    );

    return () => {
      sentUnsub();
      receivedUnsub();
    };
  }, [userId]);

  const handleHire = async (applicationId: string) => {
    if (!user || !auth?.currentUser) {
      alert('Please sign in');
      return;
    }

    setProcessingHire(applicationId);
    try {
      const idToken = await auth.currentUser.getIdToken();
      
      // First, mark as hired
      const hireResponse = await fetch('/api/jobs/hire', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({ applicationId })
      });

      const hireData = await hireResponse.json();

      if (!hireResponse.ok) {
        throw new Error(hireData.error || 'Failed to hire applicant');
      }

      // Then create checkout session for deposit
      const checkoutResponse = await fetch('/api/jobs/checkout-deposit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({ applicationId })
      });

      const checkoutData = await checkoutResponse.json();

      if (!checkoutResponse.ok) {
        throw new Error(checkoutData.error || 'Failed to create checkout session');
      }

      // Redirect to Stripe Checkout
      if (checkoutData.url) {
        window.location.href = checkoutData.url;
      } else {
        throw new Error('No checkout URL received');
      }
    } catch (error: any) {
      console.error('Error hiring:', error);
      alert(error.message || 'Failed to hire applicant');
      setProcessingHire(null);
    }
  };

  const handleMarkComplete = async (applicationId: string) => {
    if (!user || !auth?.currentUser) {
      alert('Please sign in');
      return;
    }

    setProcessingComplete(applicationId);
    try {
      const idToken = await auth.currentUser.getIdToken();
      const response = await fetch('/api/jobs/complete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({ applicationId })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to mark job as complete');
      }

      alert('Job marked as complete! The poster will be notified to complete payment.');
    } catch (error: any) {
      console.error('Error marking complete:', error);
      alert(error.message || 'Failed to mark job as complete');
    } finally {
      setProcessingComplete(null);
    }
  };

  const handlePayFinal = async (applicationId: string) => {
    if (!user || !auth?.currentUser) {
      alert('Please sign in');
      return;
    }

    setProcessingPayment(applicationId);
    try {
      const idToken = await auth.currentUser.getIdToken();
      
      // Create checkout session for final payment
      const response = await fetch('/api/jobs/checkout-final', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({ applicationId })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create checkout session');
      }

      // Redirect to Stripe Checkout
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error('No checkout URL received');
      }
    } catch (error: any) {
      console.error('Error processing final payment:', error);
      alert(error.message || 'Failed to process final payment');
      setProcessingPayment(null);
    }
  };

  const formatDate = (timestamp: any): string => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
      hired: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
      completed: 'bg-green-500/10 text-green-400 border-green-500/30',
      paid: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
      rejected: 'bg-red-500/10 text-red-400 border-red-500/30'
    };
    return colors[status] || 'bg-neutral-800 text-neutral-400 border-neutral-700';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="inline-block animate-spin h-8 w-8 border-b-2 border-ccaBlue mb-4"></div>
          <p className="text-neutral-400">Loading jobs...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Applications Sent */}
      <div>
        <h2 className="text-xl font-bold text-white mb-4">Applications Sent</h2>
        {applicationsSent.length === 0 ? (
          <div className="bg-neutral-950/60 backdrop-blur-sm border border-neutral-800/50 p-8 rounded-lg text-center">
            <p className="text-neutral-400">You haven't applied to any opportunities yet.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {applicationsSent.map((app) => (
              <div key={app.id} className="bg-neutral-950/60 backdrop-blur-sm border border-neutral-800/50 p-6 rounded-lg">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg text-white mb-1">{app.opportunityTitle}</h3>
                    <p className="text-sm text-neutral-400">{app.opportunityCompany || 'Company'}</p>
                    {app.createdAt && (
                      <p className="text-xs text-neutral-500 mt-1">Applied {formatDate(app.createdAt)}</p>
                    )}
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusBadge(app.status)}`}>
                    {app.status.charAt(0).toUpperCase() + app.status.slice(1)}
                  </span>
                </div>
                {app.status === 'hired' && (
                  <div className="mt-4 pt-4 border-t border-neutral-800">
                    <button
                      onClick={() => handleMarkComplete(app.id)}
                      disabled={processingComplete === app.id}
                      className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded transition disabled:opacity-50"
                    >
                      {processingComplete === app.id ? 'Processing...' : 'Mark as Complete'}
                    </button>
                  </div>
                )}
                {app.totalAmount && (
                  <p className="text-sm text-neutral-400 mt-2">
                    Total Amount: ${((app.totalAmount || 0) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Applications Received */}
      {isOwnProfile && (
        <div>
          <h2 className="text-xl font-bold text-white mb-4">Applications Received</h2>
          {applicationsReceived.length === 0 ? (
            <div className="bg-neutral-950/60 backdrop-blur-sm border border-neutral-800/50 p-8 rounded-lg text-center">
              <p className="text-neutral-400">You haven't received any applications yet.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {applicationsReceived.map((app) => (
                <div key={app.id} className="bg-neutral-950/60 backdrop-blur-sm border border-neutral-800/50 p-6 rounded-lg">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg text-white mb-1">{app.opportunityTitle}</h3>
                      <p className="text-sm text-neutral-400">{app.name} • {app.email}</p>
                      {app.portfolioUrl && (
                        <a
                          href={app.portfolioUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-ccaBlue hover:underline mt-1 inline-block"
                        >
                          View Portfolio
                        </a>
                      )}
                      {app.createdAt && (
                        <p className="text-xs text-neutral-500 mt-1">Applied {formatDate(app.createdAt)}</p>
                      )}
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusBadge(app.status)}`}>
                      {app.status.charAt(0).toUpperCase() + app.status.slice(1)}
                    </span>
                  </div>

                  {/* Application Details */}
                  <div className="mt-4 space-y-2 text-sm text-neutral-300">
                    {app.coverLetter && (
                      <div>
                        <p className="text-xs text-neutral-500 mb-1">Cover Letter:</p>
                        <p className="line-clamp-3">{app.coverLetter}</p>
                      </div>
                    )}
                    {app.rate && (
                      <p><span className="text-neutral-500">Rate:</span> {app.rate}</p>
                    )}
                    {app.availability && (
                      <p><span className="text-neutral-500">Availability:</span> {app.availability}</p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="mt-4 pt-4 border-t border-neutral-800 flex gap-3">
                    {app.status === 'pending' && (
                      <button
                        onClick={() => handleHire(app.id)}
                        disabled={processingHire === app.id}
                        className="px-4 py-2 bg-white text-black hover:bg-neutral-100 font-medium rounded transition disabled:opacity-50"
                      >
                        {processingHire === app.id ? 'Processing...' : 'Hire'}
                      </button>
                    )}
                    {app.status === 'completed' && !app.finalPaymentPaid && (
                      <button
                        onClick={() => handlePayFinal(app.id)}
                        disabled={processingPayment === app.id}
                        className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded transition disabled:opacity-50"
                      >
                        {processingPayment === app.id ? 'Processing...' : 'Pay Final Amount'}
                      </button>
                    )}
                    {(app.status === 'paid' || app.finalPaymentPaid) && (
                      <span className="px-4 py-2 bg-green-500/10 text-green-400 border border-green-500/30 rounded text-sm">
                        Payment Complete
                      </span>
                    )}
                  </div>

                  {app.totalAmount && (
                    <div className="mt-4 pt-4 border-t border-neutral-800">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-neutral-500">Total Amount:</p>
                          <p className="text-white font-semibold">
                            ${((app.totalAmount || 0) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </p>
                        </div>
                        {app.depositAmount && (
                          <div>
                            <p className="text-neutral-500">Deposit (25%):</p>
                            <p className="text-white">
                              ${((app.depositAmount || 0) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

