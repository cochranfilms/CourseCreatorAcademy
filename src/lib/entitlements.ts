import { adminDb } from '@/lib/firebaseAdmin';

/**
 * Returns true if the user has global CCA membership active.
 * Source of truth: users/{uid}.membershipActive (kept in sync via Stripe webhook)
 */
export async function hasGlobalMembership(userId: string): Promise<boolean> {
  if (!adminDb || !userId) return false;
  try {
    const userDoc = await adminDb.collection('users').doc(String(userId)).get();
    const data = userDoc.exists ? (userDoc.data() as any) : null;
    return Boolean(data?.membershipActive);
  } catch {
    return false;
  }
}

/**
 * Returns true if the user has an active Legacy+ subscription to the specific creator.
 * Source of truth: legacySubscriptions collection, status in ['active','trialing'].
 */
export async function hasCreatorSubscription(userId: string, creatorId: string): Promise<boolean> {
  if (!adminDb || !userId || !creatorId) return false;
  try {
    const q = await adminDb
      .collection('legacySubscriptions')
      .where('userId', '==', String(userId))
      .where('creatorId', '==', String(creatorId))
      .where('status', 'in', ['active', 'trialing'])
      .limit(1)
      .get();
    return !q.empty;
  } catch {
    return false;
  }
}

/**
 * Main entitlement helper: user has access to a creator if:
 * - They have global CCA membership, OR
 * - They have an active Legacy+ subscription to that creator.
 */
export async function hasAccessToCreator(userId: string, creatorId: string): Promise<boolean> {
  if (!userId || !creatorId) return false;
  if (await hasGlobalMembership(userId)) return true;
  return await hasCreatorSubscription(userId, creatorId);
}


