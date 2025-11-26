import { adminDb } from '@/lib/firebaseAdmin';

const DEFAULT_PLATFORM_FEE_BPS = 300; // 3%

// Plans that skip platform fees
const NO_FEES_PLANS = ['cca_no_fees_60', 'cca_membership_87'];

export function getPlatformFeeBps(): number {
  const fromEnv = process.env.CCA_PLATFORM_FEE_BPS;
  const parsed = fromEnv ? Number(fromEnv) : NaN;
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : DEFAULT_PLATFORM_FEE_BPS;
}

/**
 * Checks if a user has a plan that skips platform fees
 */
export async function hasNoFeesPlan(userId: string): Promise<boolean> {
  if (!adminDb || !userId) return false;
  try {
    const userDoc = await adminDb.collection('users').doc(String(userId)).get();
    const data = userDoc.exists ? (userDoc.data() as any) : null;
    const isActive = Boolean(data?.membershipActive);
    const plan = String(data?.membershipPlan || '');
    return isActive && NO_FEES_PLANS.includes(plan);
  } catch {
    return false;
  }
}

/**
 * Computes application fee amount, returning 0 if user has a no-fees plan
 */
export async function computeApplicationFeeAmount(amountInMinorUnits: number, feeBps?: number, userId?: string): Promise<number> {
  // If userId is provided, check if they have a no-fees plan
  if (userId) {
    const hasNoFees = await hasNoFeesPlan(userId);
    if (hasNoFees) return 0;
  }
  
  const bps = typeof feeBps === 'number' ? feeBps : getPlatformFeeBps();
  if (!Number.isFinite(amountInMinorUnits) || amountInMinorUnits <= 0) return 0;
  return Math.round((amountInMinorUnits * bps) / 10_000);
}

/**
 * Synchronous version for backwards compatibility (doesn't check user plan)
 */
export function computeApplicationFeeAmountSync(amountInMinorUnits: number, feeBps?: number): number {
  const bps = typeof feeBps === 'number' ? feeBps : getPlatformFeeBps();
  if (!Number.isFinite(amountInMinorUnits) || amountInMinorUnits <= 0) return 0;
  return Math.round((amountInMinorUnits * bps) / 10_000);
}


