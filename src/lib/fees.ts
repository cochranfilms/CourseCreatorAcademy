const DEFAULT_PLATFORM_FEE_BPS = 300; // 3%

export function getPlatformFeeBps(): number {
  const fromEnv = process.env.CCA_PLATFORM_FEE_BPS;
  const parsed = fromEnv ? Number(fromEnv) : NaN;
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : DEFAULT_PLATFORM_FEE_BPS;
}

export function computeApplicationFeeAmount(amountInMinorUnits: number, feeBps?: number): number {
  const bps = typeof feeBps === 'number' ? feeBps : getPlatformFeeBps();
  if (!Number.isFinite(amountInMinorUnits) || amountInMinorUnits <= 0) return 0;
  return Math.round((amountInMinorUnits * bps) / 10_000);
}


