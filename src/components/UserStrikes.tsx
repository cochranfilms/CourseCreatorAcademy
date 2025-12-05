"use client";

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { auth } from '@/lib/firebaseClient';
import { Messages } from '@/components/Messages';

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
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [adminUserId, setAdminUserId] = useState<string | null>(null);
  const [selectedStrike, setSelectedStrike] = useState<Strike | null>(null);

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
        } else {
          const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
          console.error('Error fetching strikes - API returned error:', response.status, errorData);
        }
      } catch (error: any) {
        console.error('Error fetching strikes:', error);
        console.error('Error details:', error.message, error.stack);
      } finally {
        setLoading(false);
      }
    };

    fetchStrikes();
  }, [user]);

  // Fetch admin user ID
  useEffect(() => {
    const fetchAdminUserId = async () => {
      try {
        const response = await fetch('/api/admin/user-id');
        if (response.ok) {
          const data = await response.json();
          setAdminUserId(data.userId);
        }
      } catch (error) {
        console.error('Error fetching admin user ID:', error);
      }
    };
    fetchAdminUserId();
  }, []);

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
        <button
          onClick={() => {
            // If multiple strikes, let user select which one to dispute
            // For now, we'll include all strikes in the message
            setShowMessageModal(true);
          }}
          className="inline-flex items-center gap-2 px-4 py-2 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-white rounded-lg text-sm transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          Contact Support
        </button>
      </div>

      {/* Messages Modal */}
      {showMessageModal && adminUserId && (
        <StrikeDisputeMessage
          isOpen={showMessageModal}
          onClose={() => setShowMessageModal(false)}
          adminUserId={adminUserId}
          strikes={strikes}
          strikeCount={strikeCount}
        />
      )}
    </div>
  );
}

// Component to handle strike dispute messages
function StrikeDisputeMessage({
  isOpen,
  onClose,
  adminUserId,
  strikes,
  strikeCount,
}: {
  isOpen: boolean;
  onClose: () => void;
  adminUserId: string;
  strikes: Strike[];
  strikeCount: number;
}) {
  const { user } = useAuth();
  const [messageText, setMessageText] = useState('');
  const [sending, setSending] = useState(false);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [initialMessageSent, setInitialMessageSent] = useState(false);
  const [initializing, setInitializing] = useState(false);

  useEffect(() => {
    if (!isOpen || !user || !adminUserId || initialMessageSent) return;

    const createThreadAndSendInitialMessage = async () => {
      try {
        setInitializing(true);
        const token = await user.getIdToken();
        if (!token) {
          console.error('No auth token');
          return;
        }

        // Create or get existing thread with admin
        const threadsResponse = await fetch('/api/messages/threads', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ recipientUserId: adminUserId }),
        });

        if (!threadsResponse.ok) {
          throw new Error('Failed to create/get thread');
        }

        const threadData = await threadsResponse.json();
        setThreadId(threadData.threadId);

        // Create strike details message
        const reasonDisplay = (reason: string) => {
          return reason.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
        };

        let strikeDetailsMessage = `Strike Dispute Request\n\n`;
        strikeDetailsMessage += `Current Strike Count: ${strikeCount}/3\n\n`;
        strikeDetailsMessage += `Strike Details:\n`;
        strikeDetailsMessage += `${'='.repeat(50)}\n\n`;

        strikes.forEach((strike) => {
          strikeDetailsMessage += `Strike ${strike.strikeNumber}/3\n`;
          strikeDetailsMessage += `Date: ${new Date(strike.issuedAt).toLocaleDateString()}\n`;
          strikeDetailsMessage += `Reason: ${reasonDisplay(strike.reason)}\n`;
          if (strike.details) {
            strikeDetailsMessage += `Details: ${strike.details}\n`;
          }
          strikeDetailsMessage += `\n${'='.repeat(50)}\n\n`;
        });

        strikeDetailsMessage += `\n---\n\nPlease review the above strike(s). I would like to dispute this/these strike(s) for the following reason(s):\n\n`;

        // Send initial message with strike details
        const sendResponse = await fetch('/api/messages/send', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            threadId: threadData.threadId,
            text: strikeDetailsMessage,
          }),
        });

        if (!sendResponse.ok) {
          throw new Error('Failed to send initial message');
        }

        setInitialMessageSent(true);
      } catch (error: any) {
        console.error('Error creating thread:', error);
        alert(error.message || 'Failed to open support conversation. Please try again.');
        onClose();
      } finally {
        setInitializing(false);
      }
    };

    createThreadAndSendInitialMessage();
  }, [isOpen, user, adminUserId, strikes, strikeCount, initialMessageSent, onClose]);

  const handleSendMessage = async () => {
    if (!messageText.trim() || !threadId || !user) return;

    try {
      setSending(true);
      const token = await user.getIdToken();
      if (!token) return;

      const response = await fetch('/api/messages/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          threadId,
          text: messageText.trim(),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to send message');
      }

      setMessageText('');
      onClose();
    } catch (error: any) {
      console.error('Error sending message:', error);
      alert(error.message || 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 max-w-2xl w-full max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-white">Dispute Strike</h2>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-white transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto mb-4">
          {initializing ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-neutral-400">Setting up support conversation...</div>
            </div>
          ) : (
            <>
              <p className="text-neutral-300 text-sm mb-4">
                A message has been sent to support with your strike details. You can add your response below:
              </p>

              <textarea
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                placeholder="Explain why you believe this strike was issued in error..."
                rows={6}
                className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-4 py-3 text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-ccaBlue resize-none"
              />
            </>
          )}
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-white rounded-lg text-sm transition-colors"
            disabled={sending}
          >
            Close
          </button>
          <button
            onClick={handleSendMessage}
            disabled={!messageText.trim() || sending || initializing}
            className="flex-1 px-4 py-2 bg-ccaBlue hover:bg-blue-600 text-white rounded-lg text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {sending ? 'Sending...' : initializing ? 'Setting up...' : 'Send Message'}
          </button>
        </div>
      </div>
    </div>
  );
}

