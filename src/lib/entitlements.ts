import { adminDb } from '@/lib/firebaseAdmin';

/**
 * Returns true if the user has any CCA membership active.
 * Source of truth: users/{uid}.membershipActive (kept in sync via Stripe webhook)
 * Also returns true for legacy creators (users who own a legacy_creators document)
 */
export async function hasGlobalMembership(userId: string): Promise<boolean> {
  if (!adminDb || !userId) return false;
  try {
    const userDoc = await adminDb.collection('users').doc(String(userId)).get();
    const data = userDoc.exists ? (userDoc.data() as any) : null;
    const hasMembership = Boolean(data?.membershipActive);
    
    // If user has active membership, return true
    if (hasMembership) return true;
    
    // If no active membership, check if user is a legacy creator
    // Legacy creators should have the same access as members for homepage content
    try {
      const legacyCreatorQuery = adminDb
        .collection('legacy_creators')
        .where('ownerUserId', '==', userId)
        .limit(1);
      
      const legacyCreatorSnap = await legacyCreatorQuery.get();
      if (!legacyCreatorSnap.empty) {
        // User is a legacy creator - grant them member access
        return true;
      }
    } catch (legacyCheckError) {
      // If legacy check fails, continue with membership check result
      console.warn('[hasGlobalMembership] Error checking legacy creator status:', legacyCheckError);
    }
    
    return false;
  } catch {
    return false;
  }
}

/**
 * Returns true only if the user's membership plan grants Legacy+ all‑access.
 * Today this is restricted to the $87 plan (planType: 'cca_membership_87').
 * We intentionally do NOT grant Legacy+ access for other plans (e.g. monthly).
 */
export async function hasAllAccessMembership(userId: string): Promise<boolean> {
	if (!adminDb || !userId) return false;
	try {
		const userDoc = await adminDb.collection('users').doc(String(userId)).get();
		const data = userDoc.exists ? (userDoc.data() as any) : null;
		const active = Boolean(data?.membershipActive);
		const plan = String(data?.membershipPlan || '');
		// Allow environment override with comma‑separated plan types, else default to the $87 plan.
		const allowedPlansEnv = String(process.env.LEGACY_ALL_ACCESS_PLANS || '').trim();
		const allowedPlans = allowedPlansEnv
			? allowedPlansEnv.split(',').map((s) => s.trim()).filter(Boolean)
			: ['cca_membership_87'];
		return active && allowedPlans.includes(plan);
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
 * Returns true if the user has a plan that skips platform fees.
 * Plans that skip fees: 'cca_no_fees_60' ($60/month) and 'cca_membership_87' ($87/month).
 */
export async function hasNoFeesPlan(userId: string): Promise<boolean> {
	if (!adminDb || !userId) return false;
	try {
		const userDoc = await adminDb.collection('users').doc(String(userId)).get();
		const data = userDoc.exists ? (userDoc.data() as any) : null;
		const active = Boolean(data?.membershipActive);
		const plan = String(data?.membershipPlan || '');
		const noFeesPlans = ['cca_no_fees_60', 'cca_membership_87'];
		return active && noFeesPlans.includes(plan);
	} catch {
		return false;
	}
}

/**
 * Main entitlement helper: user has access to a creator if:
 * - They have an all‑access CCA membership plan, OR
 * - They have an active Legacy+ subscription to that creator.
 */
export async function hasAccessToCreator(userId: string, creatorId: string): Promise<boolean> {
  if (!userId || !creatorId) return false;
  if (await hasAllAccessMembership(userId)) return true;
  return await hasCreatorSubscription(userId, creatorId);
}


