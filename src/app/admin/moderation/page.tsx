"use client";

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { doc, getDoc } from 'firebase/firestore';
import { db, firebaseReady, auth } from '@/lib/firebaseClient';

interface Report {
  id: string;
  reporterId: string;
  reportedUserId: string;
  reason: string;
  details?: string;
  status: string;
  createdAt: string;
  reporterInfo?: any;
  reportedUserInfo?: any;
  strikeCount: number;
}

interface Strike {
  id: string;
  userId: string;
  reportId: string;
  reason: string;
  strikeNumber: number;
  issuedAt: string;
  userInfo?: any;
}

export default function AdminModerationPage() {
  return (
    <ProtectedRoute>
      <AdminModerationDashboard />
    </ProtectedRoute>
  );
}

function AdminModerationDashboard() {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [activeTab, setActiveTab] = useState<'reports' | 'strikes' | 'removed'>('reports');
  const [reports, setReports] = useState<Report[]>([]);
  const [strikes, setStrikes] = useState<Strike[]>([]);
  const [removedProfiles, setRemovedProfiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !firebaseReady || !db) {
      setIsAdmin(false);
      return;
    }

    const checkAdmin = async () => {
      try {
        const snap = await getDoc(doc(db, 'users', user.uid));
        const data = snap.data() as any;
        const adminRole = Boolean(data?.roles?.admin || data?.isAdmin);
        const adminEmail = user.email === 'info@cochranfilms.com';
        const admin = adminRole || adminEmail;
        setIsAdmin(admin);
        if (admin) {
          fetchData();
        } else {
          setLoading(false);
        }
      } catch {
        setIsAdmin(false);
        setLoading(false);
      }
    };

    checkAdmin();
  }, [user]);

  const fetchData = async () => {
    if (!auth.currentUser) return;
    
    try {
      const token = await auth.currentUser.getIdToken();
      
      // Fetch reports
      const reportsRes = await fetch('/api/admin/moderation/reports', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (reportsRes.ok) {
        const reportsData = await reportsRes.json();
        setReports(reportsData.reports || []);
      }

      // Fetch strikes
      const strikesRes = await fetch('/api/admin/moderation/strikes', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (strikesRes.ok) {
        const strikesData = await strikesRes.json();
        setStrikes(strikesData.strikes || []);
      }

      // Fetch removed profiles
      const removedRes = await fetch('/api/admin/moderation/reports?status=resolved', {
        headers: { Authorization: `Bearer ${token}` },
      });
      // Simplified - would need separate endpoint for removed profiles
      setRemovedProfiles([]);
    } catch (err) {
      console.error('Error fetching moderation data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleIssueStrike = async (reportId: string, userId: string, reason: string) => {
    if (!auth.currentUser) return;
    
    try {
      const token = await auth.currentUser.getIdToken();
      const response = await fetch('/api/admin/moderation/strikes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ userId, reportId, reason }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.shouldRemove) {
          alert('User has reached 3 strikes. Profile has been automatically removed.');
        }
        fetchData();
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to issue strike');
      }
    } catch (err) {
      console.error('Error issuing strike:', err);
      alert('Failed to issue strike');
    }
  };

  const handleDismissReport = async (reportId: string) => {
    if (!auth.currentUser) return;
    
    try {
      const token = await auth.currentUser.getIdToken();
      const response = await fetch(`/api/admin/moderation/reports/${reportId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: 'dismissed' }),
      });

      if (response.ok) {
        fetchData();
      }
    } catch (err) {
      console.error('Error dismissing report:', err);
    }
  };

  const handleDeleteStrike = async (strikeId: string) => {
    if (!auth.currentUser) return;
    
    if (!confirm('Are you sure you want to delete this strike? This will reduce the user\'s strike count.')) {
      return;
    }
    
    try {
      const token = await auth.currentUser.getIdToken();
      const response = await fetch(`/api/admin/moderation/strikes/${strikeId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        alert('Strike deleted successfully.');
        fetchData();
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to delete strike');
      }
    } catch (err) {
      console.error('Error deleting strike:', err);
      alert('Failed to delete strike');
    }
  };

  if (isAdmin === null || loading) {
    return (
      <main className="min-h-screen max-w-7xl mx-auto px-6 py-8">
        <div className="text-neutral-400">Verifying admin access...</div>
      </main>
    );
  }

  if (!isAdmin) {
    return (
      <main className="min-h-screen max-w-7xl mx-auto px-6 py-8">
        <h1 className="text-2xl font-bold text-white mb-2">Admin Moderation</h1>
        <p className="text-neutral-400">You do not have access to this page.</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen max-w-7xl mx-auto px-6 py-8">
      <h1 className="text-3xl font-bold text-white mb-6">Moderation Dashboard</h1>

      {/* Tabs */}
      <div className="flex gap-4 mb-6">
        <button
          onClick={() => setActiveTab('reports')}
          className={`px-4 py-2 font-semibold transition-colors rounded-lg border-2 ${
            activeTab === 'reports'
              ? 'bg-neutral-900/80 border-ccaBlue text-ccaBlue'
              : 'bg-neutral-900/60 border-neutral-800 text-neutral-400 hover:text-white hover:border-neutral-700'
          }`}
        >
          Reports ({reports.filter(r => r.status === 'pending').length})
        </button>
        <button
          onClick={() => setActiveTab('strikes')}
          className={`px-4 py-2 font-semibold transition-colors rounded-lg border-2 ${
            activeTab === 'strikes'
              ? 'bg-neutral-900/80 border-ccaBlue text-ccaBlue'
              : 'bg-neutral-900/60 border-neutral-800 text-neutral-400 hover:text-white hover:border-neutral-700'
          }`}
        >
          Strikes ({strikes.length})
        </button>
        <button
          onClick={() => setActiveTab('removed')}
          className={`px-4 py-2 font-semibold transition-colors rounded-lg border-2 ${
            activeTab === 'removed'
              ? 'bg-neutral-900/80 border-ccaBlue text-ccaBlue'
              : 'bg-neutral-900/60 border-neutral-800 text-neutral-400 hover:text-white hover:border-neutral-700'
          }`}
        >
          Removed Profiles
        </button>
      </div>

      {/* Reports Tab */}
      {activeTab === 'reports' && (
        <div className="bg-neutral-900/60 backdrop-blur-sm border border-neutral-800 rounded-xl p-6">
          <div className="space-y-4">
            {reports.filter(r => r.status === 'pending').length === 0 ? (
              <p className="text-neutral-400">No pending reports.</p>
            ) : (
              reports
                .filter(r => r.status === 'pending')
                .map((report) => (
                  <div
                    key={report.id}
                    className="bg-gradient-to-br from-neutral-900/90 to-neutral-950/90 border border-neutral-800 rounded-xl p-6"
                  >
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-white font-semibold mb-2">
                        Report against {report.reportedUserInfo?.displayName || 'User'}
                      </h3>
                      <p className="text-neutral-400 text-sm">
                        Reason: <span className="text-white capitalize">{report.reason.replace('_', ' ')}</span>
                      </p>
                      {report.details && (
                        <p className="text-neutral-300 mt-2">{report.details}</p>
                      )}
                      <p className="text-neutral-500 text-xs mt-2">
                        Current strikes: {report.strikeCount}/3
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleDismissReport(report.id)}
                        className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-white rounded-lg text-sm"
                      >
                        Dismiss
                      </button>
                      <button
                        onClick={() => handleIssueStrike(report.id, report.reportedUserId, report.reason)}
                        className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm"
                      >
                        Issue Strike
                      </button>
                    </div>
                  </div>
                  </div>
                ))
            )}
          </div>
        </div>
      )}

      {/* Strikes Tab */}
      {activeTab === 'strikes' && (
        <div className="bg-neutral-900/60 backdrop-blur-sm border border-neutral-800 rounded-xl p-6">
          <div className="space-y-4">
            {strikes.length === 0 ? (
              <p className="text-neutral-400">No strikes issued.</p>
            ) : (
              strikes.map((strike) => (
                <div
                  key={strike.id}
                  className="bg-gradient-to-br from-neutral-900/90 to-neutral-950/90 border border-neutral-800 rounded-xl p-6"
                >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h3 className="text-white font-semibold mb-2">
                      {strike.userInfo?.displayName || 'User'} - Strike {strike.strikeNumber}/3
                    </h3>
                    <p className="text-neutral-400 text-sm">Reason: {strike.reason}</p>
                    <p className="text-neutral-500 text-xs mt-2">
                      Issued: {new Date(strike.issuedAt).toLocaleDateString()}
                    </p>
                    {strike.userInfo && (
                      <p className="text-neutral-500 text-xs mt-1">
                        Current strikes: {strike.userInfo.strikes || 0}/3
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => handleDeleteStrike(strike.id)}
                    className="ml-4 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-semibold transition-colors"
                  >
                    Delete Strike
                  </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Removed Profiles Tab */}
      {activeTab === 'removed' && (
        <div className="bg-neutral-900/60 backdrop-blur-sm border border-neutral-800 rounded-xl p-6">
          <p className="text-neutral-400">Removed profiles functionality coming soon.</p>
        </div>
      )}
    </main>
  );
}

