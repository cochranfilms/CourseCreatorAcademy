import { adminDb } from './firebaseAdmin';

export type BadgeCategory = 'membership' | 'activity' | 'social' | 'marketplace' | 'community';
export type BadgeRarity = 'common' | 'rare' | 'epic' | 'legendary';

export interface BadgeDefinition {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: BadgeCategory;
  criteria: {
    type: 'date' | 'count' | 'custom';
    value?: any;
    checkFunction?: (userId: string) => Promise<boolean>;
  };
  rarity: BadgeRarity;
}

export interface UserBadge {
  badgeId: string;
  earnedAt: Date;
  progress?: number;
}

// Badge definitions
export const BADGE_DEFINITIONS: BadgeDefinition[] = [
  {
    id: 'early_member',
    name: 'Early Member',
    description: 'Joined before 2024',
    icon: '🌟',
    category: 'membership',
    criteria: {
      type: 'date',
      value: new Date('2024-01-01'),
    },
    rarity: 'rare',
  },
  {
    id: 'first_purchase',
    name: 'First Purchase',
    description: 'Made your first marketplace purchase',
    icon: '🛒',
    category: 'marketplace',
    criteria: {
      type: 'count',
      value: 1,
    },
    rarity: 'common',
  },
  {
    id: 'active_poster',
    name: 'Active Poster',
    description: 'Posted 10+ message board posts',
    icon: '💬',
    category: 'community',
    criteria: {
      type: 'count',
      value: 10,
    },
    rarity: 'common',
  },
  {
    id: 'top_seller',
    name: 'Top Seller',
    description: 'Sold 5+ marketplace items',
    icon: '⭐',
    category: 'marketplace',
    criteria: {
      type: 'count',
      value: 5,
    },
    rarity: 'rare',
  },
  {
    id: 'community_helper',
    name: 'Community Helper',
    description: 'Received 10+ reactions on posts',
    icon: '❤️',
    category: 'community',
    criteria: {
      type: 'count',
      value: 10,
    },
    rarity: 'epic',
  },
];

/**
 * Checks if a user has earned a badge
 */
async function checkBadgeEligibility(userId: string, badge: BadgeDefinition): Promise<boolean> {
  if (!adminDb) return false;

  try {
    switch (badge.criteria.type) {
      case 'date':
        // Check user creation date
        const userDoc = await adminDb.collection('users').doc(userId).get();
        if (!userDoc.exists) return false;
        const userData = userDoc.data();
        const createdAt = userData?.createdAt?.toDate ? userData.createdAt.toDate() : new Date(userData?.createdAt);
        return createdAt < badge.criteria.value;

      case 'count':
        // Check counts based on badge ID
        if (badge.id === 'first_purchase') {
          const ordersSnap = await adminDb.collection('orders')
            .where('buyerId', '==', userId)
            .limit(1)
            .get();
          return ordersSnap.size >= badge.criteria.value;
        }
        
        if (badge.id === 'active_poster') {
          const postsSnap = await adminDb.collection('messageBoardPosts')
            .where('authorId', '==', userId)
            .limit(badge.criteria.value)
            .get();
          return postsSnap.size >= badge.criteria.value;
        }
        
        if (badge.id === 'top_seller') {
          const soldSnap = await adminDb.collection('orders')
            .where('sellerId', '==', userId)
            .limit(badge.criteria.value)
            .get();
          return soldSnap.size >= badge.criteria.value;
        }
        
        if (badge.id === 'community_helper') {
          // This would require tracking reactions - simplified for now
          // Would need to query messageBoardPosts and count reactions
          return false; // TODO: Implement reaction counting
        }
        
        return false;

      case 'custom':
        if (badge.criteria.checkFunction) {
          return await badge.criteria.checkFunction(userId);
        }
        return false;

      default:
        return false;
    }
  } catch (error) {
    console.error(`Error checking badge eligibility for ${badge.id}:`, error);
    return false;
  }
}

/**
 * Awards a badge to a user if they haven't already earned it
 */
export async function awardBadge(userId: string, badgeId: string): Promise<boolean> {
  if (!adminDb) return false;

  try {
    // Check if user already has this badge
    const badgeDoc = await adminDb
      .collection('users')
      .doc(userId)
      .collection('badges')
      .doc(badgeId)
      .get();

    if (badgeDoc.exists) {
      return false; // Already has badge
    }

    // Find badge definition
    const badge = BADGE_DEFINITIONS.find(b => b.id === badgeId);
    if (!badge) {
      console.error(`Badge definition not found: ${badgeId}`);
      return false;
    }

    // Check eligibility
    const eligible = await checkBadgeEligibility(userId, badge);
    if (!eligible) {
      return false; // Not eligible
    }

    // Award badge
    await adminDb
      .collection('users')
      .doc(userId)
      .collection('badges')
      .doc(badgeId)
      .set({
        earnedAt: new Date(),
      });

    return true;
  } catch (error) {
    console.error(`Error awarding badge ${badgeId} to user ${userId}:`, error);
    return false;
  }
}

/**
 * Checks and awards all eligible badges for a user
 */
export async function checkAndAwardBadges(userId: string): Promise<string[]> {
  const awarded: string[] = [];

  for (const badge of BADGE_DEFINITIONS) {
    const wasAwarded = await awardBadge(userId, badge.id);
    if (wasAwarded) {
      awarded.push(badge.id);
    }
  }

  return awarded;
}

/**
 * Gets all badges earned by a user
 */
export async function getUserBadges(userId: string): Promise<UserBadge[]> {
  if (!adminDb) return [];

  try {
    const badgesSnap = await adminDb
      .collection('users')
      .doc(userId)
      .collection('badges')
      .get();

    return badgesSnap.docs.map(doc => {
      const data = doc.data();
      return {
        badgeId: doc.id,
        earnedAt: data.earnedAt?.toDate ? data.earnedAt.toDate() : new Date(data.earnedAt),
        progress: data.progress,
      };
    });
  } catch (error) {
    console.error(`Error fetching badges for user ${userId}:`, error);
    return [];
  }
}

/**
 * Gets badge definition by ID
 */
export function getBadgeDefinition(badgeId: string): BadgeDefinition | undefined {
  return BADGE_DEFINITIONS.find(b => b.id === badgeId);
}

