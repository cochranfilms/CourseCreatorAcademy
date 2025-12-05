"use client";

import { useEffect, useState } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db, firebaseReady } from '@/lib/firebaseClient';
import { getBadgeDefinition, type BadgeDefinition } from '@/lib/badgeDefinitions';

interface UserBadge {
  badgeId: string;
  earnedAt: Date;
  progress?: number;
}

interface UserBadgesProps {
  userId: string;
}

export function UserBadges({ userId }: UserBadgesProps) {
  const [badges, setBadges] = useState<UserBadge[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!firebaseReady || !db || !userId) {
      setLoading(false);
      return;
    }

    const fetchBadges = async () => {
      try {
        const badgesQuery = query(
          collection(db, 'users', userId, 'badges')
        );

        const badgesSnap = await getDocs(badgesQuery);
        const badgesData: UserBadge[] = badgesSnap.docs.map(doc => {
          const data = doc.data();
          const earnedAt = data.earnedAt?.toDate ? data.earnedAt.toDate() : new Date(data.earnedAt);
          return {
            badgeId: doc.id,
            earnedAt,
            progress: data.progress,
          };
        });

        // Sort by earned date (newest first)
        badgesData.sort((a, b) => b.earnedAt.getTime() - a.earnedAt.getTime());

        setBadges(badgesData);
      } catch (error) {
        console.error('Error fetching badges:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchBadges();
  }, [userId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4">
        <div className="animate-spin h-6 w-6 border-3 border-ccaBlue/30 border-t-ccaBlue rounded-full"></div>
      </div>
    );
  }

  if (badges.length === 0) {
    return null;
  }

  const getRarityColor = (rarity: string) => {
    switch (rarity) {
      case 'common':
        return 'border-neutral-500/50 bg-neutral-800/30';
      case 'rare':
        return 'border-blue-500/50 bg-blue-500/10';
      case 'epic':
        return 'border-purple-500/50 bg-purple-500/10';
      case 'legendary':
        return 'border-yellow-500/50 bg-yellow-500/10';
      default:
        return 'border-neutral-500/50 bg-neutral-800/30';
    }
  };

  return (
    <div className="flex flex-wrap gap-3">
      {badges.map((badge) => {
        const badgeDef = getBadgeDefinition(badge.badgeId);
        if (!badgeDef) return null;

        return (
          <div
            key={badge.badgeId}
            className={`group relative flex items-center gap-2 px-3 py-2 rounded-lg border-2 ${getRarityColor(badgeDef.rarity)} hover:scale-105 transition-all duration-200 cursor-help`}
            title={`${badgeDef.name}: ${badgeDef.description}`}
          >
            <span className="text-xl">{badgeDef.icon}</span>
            <div className="flex flex-col">
              <span className="text-white text-xs font-semibold">{badgeDef.name}</span>
              <span className="text-neutral-400 text-[10px] capitalize">{badgeDef.rarity}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

