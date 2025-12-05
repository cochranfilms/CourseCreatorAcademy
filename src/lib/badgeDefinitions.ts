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
 * Gets badge definition by ID
 */
export function getBadgeDefinition(badgeId: string): BadgeDefinition | undefined {
  return BADGE_DEFINITIONS.find(b => b.id === badgeId);
}

