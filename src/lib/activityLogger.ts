import { adminDb } from './firebaseAdmin';

export type ActivityType = 'download' | 'purchase' | 'post' | 'listing_created' | 'opportunity_posted';
export type ActivityTargetType = 'asset' | 'listing' | 'post' | 'opportunity';

export interface ActivityMetadata {
  assetId?: string;
  assetTitle?: string;
  orderId?: string;
  listingId?: string;
  listingTitle?: string;
  postId?: string;
  postContent?: string;
  opportunityId?: string;
  opportunityTitle?: string;
  [key: string]: any;
}

export interface ActivityData {
  userId: string;
  type: ActivityType;
  title: string;
  description?: string;
  targetId?: string;
  targetType?: ActivityTargetType;
  metadata?: ActivityMetadata;
  public?: boolean;
}

/**
 * Logs a user activity to Firestore
 * @param activity The activity data to log
 * @returns The activity document ID if successful, null otherwise
 */
export async function logActivity(activity: ActivityData): Promise<string | null> {
  if (!adminDb) {
    console.warn('Activity logger: Firebase Admin not initialized');
    return null;
  }

  try {
    const activityDoc = {
      userId: activity.userId,
      type: activity.type,
      title: activity.title,
      description: activity.description || null,
      targetId: activity.targetId || null,
      targetType: activity.targetType || null,
      metadata: activity.metadata || {},
      public: activity.public !== undefined ? activity.public : true,
      createdAt: new Date(),
    };

    const docRef = await adminDb.collection('userActivity').add(activityDoc);
    return docRef.id;
  } catch (error) {
    console.error('Error logging activity:', error);
    return null;
  }
}

/**
 * Logs an asset download activity
 */
export async function logDownloadActivity(
  userId: string,
  assetId: string,
  assetTitle: string,
  assetType?: string
): Promise<string | null> {
  return logActivity({
    userId,
    type: 'download',
    title: `Downloaded ${assetTitle}`,
    description: assetType ? `Downloaded ${assetType}` : 'Downloaded asset',
    targetId: assetId,
    targetType: 'asset',
    metadata: {
      assetId,
      assetTitle,
      assetType,
    },
    public: true,
  });
}

/**
 * Logs a marketplace purchase activity
 */
export async function logPurchaseActivity(
  userId: string,
  orderId: string,
  listingId: string,
  listingTitle: string
): Promise<string | null> {
  return logActivity({
    userId,
    type: 'purchase',
    title: `Purchased ${listingTitle}`,
    description: 'Made a marketplace purchase',
    targetId: listingId,
    targetType: 'listing',
    metadata: {
      orderId,
      listingId,
      listingTitle,
    },
    public: true,
  });
}

/**
 * Logs a message board post activity
 */
export async function logPostActivity(
  userId: string,
  postId: string,
  postContent: string
): Promise<string | null> {
  const preview = postContent.length > 100 
    ? postContent.substring(0, 100) + '...' 
    : postContent;

  return logActivity({
    userId,
    type: 'post',
    title: 'Posted to message board',
    description: preview,
    targetId: postId,
    targetType: 'post',
    metadata: {
      postId,
      postContent: preview,
    },
    public: true,
  });
}

/**
 * Logs a listing creation activity
 */
export async function logListingCreatedActivity(
  userId: string,
  listingId: string,
  listingTitle: string
): Promise<string | null> {
  return logActivity({
    userId,
    type: 'listing_created',
    title: `Created listing: ${listingTitle}`,
    description: 'Created a new marketplace listing',
    targetId: listingId,
    targetType: 'listing',
    metadata: {
      listingId,
      listingTitle,
    },
    public: true,
  });
}

/**
 * Logs an opportunity posted activity
 */
export async function logOpportunityPostedActivity(
  userId: string,
  opportunityId: string,
  opportunityTitle: string
): Promise<string | null> {
  return logActivity({
    userId,
    type: 'opportunity_posted',
    title: `Posted opportunity: ${opportunityTitle}`,
    description: 'Posted a new job opportunity',
    targetId: opportunityId,
    targetType: 'opportunity',
    metadata: {
      opportunityId,
      opportunityTitle,
    },
    public: true,
  });
}

