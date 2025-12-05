"use client";

import { useEffect, useState } from 'react';
import { collection, query, where, orderBy, limit, getDocs, Timestamp } from 'firebase/firestore';
import { db, firebaseReady } from '@/lib/firebaseClient';
import Link from 'next/link';

export type ActivityType = 'download' | 'purchase' | 'post' | 'listing_created' | 'opportunity_posted';

export interface Activity {
  id: string;
  userId: string;
  type: ActivityType;
  title: string;
  description?: string;
  targetId?: string;
  targetType?: 'asset' | 'listing' | 'post' | 'opportunity';
  metadata?: any;
  createdAt: Date;
}

interface ActivityFeedProps {
  userId: string;
  limitCount?: number;
}

function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined });
}

function getActivityIcon(type: ActivityType): string {
  switch (type) {
    case 'download':
      return '⬇️';
    case 'purchase':
      return '🛒';
    case 'post':
      return '💬';
    case 'listing_created':
      return '📦';
    case 'opportunity_posted':
      return '💼';
    default:
      return '📌';
  }
}

function getActivityLink(activity: Activity): string {
  if (!activity.targetId) return '#';
  
  switch (activity.targetType) {
    case 'asset':
      return `/assets`;
    case 'listing':
      return `/marketplace`;
    case 'post':
      return `/message-board`;
    case 'opportunity':
      return `/opportunities`;
    default:
      return '#';
  }
}

export function ActivityFeed({ userId, limitCount = 30 }: ActivityFeedProps) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!firebaseReady || !db || !userId) {
      setLoading(false);
      return;
    }

    const fetchActivities = async () => {
      try {
        // Fetch activities from userActivity collection
        // Only fetch public activities (activities with public == true)
        const activitiesQuery = query(
          collection(db, 'userActivity'),
          where('userId', '==', userId),
          where('public', '==', true),
          orderBy('createdAt', 'desc'),
          limit(limitCount)
        );

        const activitiesSnap = await getDocs(activitiesQuery);
        const activitiesData: Activity[] = activitiesSnap.docs.map(doc => {
          const data = doc.data();
          const createdAt = data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt);
          return {
            id: doc.id,
            userId: data.userId,
            type: data.type,
            title: data.title,
            description: data.description,
            targetId: data.targetId,
            targetType: data.targetType,
            metadata: data.metadata,
            createdAt,
          };
        });

        setActivities(activitiesData);
      } catch (error: any) {
        // If permission error, silently fail (user may not have permission to view activities)
        // This is expected for public profiles where activities might be private
        if (error?.code === 'permission-denied' || error?.message?.includes('permission')) {
          console.warn('Permission denied for activities - user may not have access or activities are private');
          setActivities([]);
        } else {
          console.error('Error fetching activities:', error);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchActivities();
  }, [userId, limitCount]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin h-8 w-8 border-4 border-ccaBlue/30 border-t-ccaBlue rounded-full"></div>
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="text-center py-8 text-neutral-400">
        <p>No recent activity to display.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {activities.map((activity) => (
        <Link
          key={activity.id}
          href={getActivityLink(activity) as any}
          className="block bg-gradient-to-br from-neutral-900/90 via-neutral-900/80 to-neutral-950/90 backdrop-blur-xl border border-neutral-800/60 p-4 rounded-xl hover:border-neutral-700/60 transition-all duration-200 group"
        >
          <div className="flex items-start gap-3">
            <div className="text-2xl flex-shrink-0">{getActivityIcon(activity.type)}</div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <h4 className="text-white font-semibold text-sm group-hover:text-ccaBlue transition-colors">
                    {activity.title}
                  </h4>
                  {activity.description && (
                    <p className="text-neutral-400 text-xs mt-1 line-clamp-2">
                      {activity.description}
                    </p>
                  )}
                </div>
                <span className="text-neutral-500 text-xs whitespace-nowrap flex-shrink-0">
                  {formatTimeAgo(activity.createdAt)}
                </span>
              </div>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}

