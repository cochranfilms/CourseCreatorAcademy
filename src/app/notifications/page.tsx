"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { useNotifications, markNotificationAsRead, markAllNotificationsAsRead, type Notification, type NotificationType } from '@/hooks/useNotifications';

export default function NotificationsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { notifications, unreadCount, loading } = useNotifications(100);
  const [activeFilter, setActiveFilter] = useState<NotificationType | 'all'>('all');
  const [markingAllRead, setMarkingAllRead] = useState(false);

  const filteredNotifications = activeFilter === 'all'
    ? notifications
    : notifications.filter(n => n.type === activeFilter);

  const handleNotificationClick = async (notification: Notification) => {
    if (!user) return;
    
    // Mark as read if unread
    if (!notification.read) {
      await markNotificationAsRead(user.uid, notification.id);
    }
    
    // Navigate if action URL exists
    if (notification.actionUrl) {
      router.push(notification.actionUrl as any);
    }
  };

  const handleMarkAllRead = async () => {
    if (!user || markingAllRead) return;
    setMarkingAllRead(true);
    await markAllNotificationsAsRead(user.uid);
    setMarkingAllRead(false);
  };

  const formatTimeAgo = (timestamp: any): string => {
    if (!timestamp) return 'Just now';
    
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    const diffWeeks = Math.floor(diffDays / 7);
    const diffMonths = Math.floor(diffDays / 30);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
    if (diffWeeks < 4) return `${diffWeeks} week${diffWeeks !== 1 ? 's' : ''} ago`;
    if (diffMonths < 12) return `${diffMonths} month${diffMonths !== 1 ? 's' : ''} ago`;
    
    return date.toLocaleDateString();
  };

  const formatDate = (timestamp: any): string => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined });
    }
  };

  const getNotificationIcon = (type: NotificationType) => {
    switch (type) {
      case 'job_application_submitted':
      case 'job_application_received':
      case 'job_application_accepted':
      case 'job_application_rejected':
      case 'job_deposit_paid':
      case 'job_final_payment_paid':
      case 'job_completed':
        return (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        );
      case 'order_placed':
      case 'order_delivered':
      case 'order_dispute':
        return (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
          </svg>
        );
      case 'payout_processed':
        return (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case 'message_received':
        return (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        );
      case 'membership_expiring':
      case 'membership_expired':
        return (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      default:
        return (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
        );
    }
  };

  const getNotificationTypeLabel = (type: NotificationType): string => {
    const labels: Record<NotificationType, string> = {
      job_application_submitted: 'Job Applications',
      job_application_received: 'Job Applications',
      job_application_accepted: 'Job Applications',
      job_application_rejected: 'Job Applications',
      job_deposit_paid: 'Job Applications',
      job_final_payment_paid: 'Job Applications',
      job_completed: 'Job Applications',
      order_placed: 'Orders',
      order_delivered: 'Orders',
      order_dispute: 'Orders',
      payout_processed: 'Payouts',
      message_received: 'Messages',
      membership_expiring: 'Membership',
      membership_expired: 'Membership',
      legacy_subscription_active: 'Subscriptions',
      legacy_subscription_canceled: 'Subscriptions',
    };
    return labels[type] || 'Other';
  };

  // Group notifications by date
  const groupedNotifications = filteredNotifications.reduce((groups, notification) => {
    const date = formatDate(notification.createdAt);
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(notification);
    return groups;
  }, {} as Record<string, Notification[]>);

  const filterTypes: Array<{ value: NotificationType | 'all'; label: string }> = [
    { value: 'all', label: 'All' },
    { value: 'job_application_submitted', label: 'Jobs' },
    { value: 'order_placed', label: 'Orders' },
    { value: 'message_received', label: 'Messages' },
    { value: 'payout_processed', label: 'Payouts' },
    { value: 'membership_expiring', label: 'Membership' },
  ];

  return (
    <ProtectedRoute>
      <main className="min-h-screen text-white">
        <div className="max-w-4xl mx-auto px-4 py-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold">Notifications</h1>
              {unreadCount > 0 && (
                <p className="text-neutral-400 mt-1">
                  {unreadCount} unread notification{unreadCount !== 1 ? 's' : ''}
                </p>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                disabled={markingAllRead}
                className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 rounded transition disabled:opacity-50"
              >
                {markingAllRead ? 'Marking...' : 'Mark All Read'}
              </button>
            )}
          </div>

          {/* Filters */}
          <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
            {filterTypes.map((filter) => {
              const count = filter.value === 'all'
                ? notifications.length
                : notifications.filter(n => {
                    if (filter.value === 'job_application_submitted') {
                      return n.type.startsWith('job_');
                    }
                    if (filter.value === 'order_placed') {
                      return n.type.startsWith('order_');
                    }
                    return n.type === filter.value;
                  }).length;

              return (
                <button
                  key={filter.value}
                  onClick={() => setActiveFilter(filter.value)}
                  className={`px-4 py-2 rounded transition whitespace-nowrap ${
                    activeFilter === filter.value
                      ? 'bg-ccaBlue text-white'
                      : 'bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-white'
                  }`}
                >
                  {filter.label} {count > 0 && `(${count})`}
                </button>
              );
            })}
          </div>

          {/* Notifications List */}
          {loading ? (
            <div className="text-center py-12 text-neutral-400">
              <p>Loading notifications...</p>
            </div>
          ) : filteredNotifications.length === 0 ? (
            <div className="text-center py-12">
              <svg className="w-16 h-16 mx-auto mb-4 text-neutral-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              <p className="text-neutral-400">No notifications found</p>
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(groupedNotifications).map(([date, dateNotifications]) => (
                <div key={date}>
                  <h2 className="text-sm font-semibold text-neutral-500 mb-3 uppercase tracking-wide">
                    {date}
                  </h2>
                  <div className="space-y-2">
                    {dateNotifications.map((notification) => (
                      <button
                        key={notification.id}
                        onClick={() => handleNotificationClick(notification)}
                        className={`w-full text-left p-4 rounded-lg border transition ${
                          !notification.read
                            ? 'bg-neutral-900 border-ccaBlue/50 hover:border-ccaBlue'
                            : 'bg-neutral-900/50 border-neutral-800 hover:border-neutral-700'
                        }`}
                      >
                        <div className="flex items-start gap-4">
                          <div className={`flex-shrink-0 mt-0.5 ${
                            !notification.read ? 'text-ccaBlue' : 'text-neutral-500'
                          }`}>
                            {getNotificationIcon(notification.type)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <h3 className={`font-medium ${
                                !notification.read ? 'text-white' : 'text-neutral-300'
                              }`}>
                                {notification.title}
                              </h3>
                              {!notification.read && (
                                <span className="flex-shrink-0 w-2 h-2 bg-ccaBlue rounded-full mt-2" />
                              )}
                            </div>
                            <p className="text-sm text-neutral-400 mt-1">
                              {notification.message}
                            </p>
                            <div className="flex items-center justify-between mt-3">
                              <span className="text-xs text-neutral-500">
                                {formatTimeAgo(notification.createdAt)}
                              </span>
                              {notification.actionLabel && (
                                <span className="text-xs text-ccaBlue font-medium">
                                  {notification.actionLabel} →
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </ProtectedRoute>
  );
}

