# Pricing Tiers and Platform Fees

## Overview

CCA offers three subscription tiers, each with different benefits and fee structures. This document explains each tier and how platform fees work.

## Subscription Tiers

### 1. Monthly Membership - $37/month

**Plan Type:** `cca_monthly_37`

**Benefits:**
- Stream all videos
- Access future content
- Community + downloads
- Full access to marketplace and job board

**Platform Fees:**
- **Marketplace sales:** 3% platform fee per successful sale
- **Job listings:** 3% platform fee on deposit amount only (no fee on final payment)

**Best For:** Users who want access to all content but don't sell frequently on the marketplace or hire through the job board.

---

### 2. No-Fees Membership - $60/month

**Plan Type:** `cca_no_fees_60`

**Benefits:**
- Everything included in Monthly Membership
- **0% platform fee** on marketplace sales
- **0% platform fee** on job listings (deposit and final payment)

**Platform Fees:**
- **Marketplace sales:** 0% platform fee (you keep 100% minus Stripe processing fees)
- **Job listings:** 0% platform fee on deposit and final payment

**Note:** You still pay Stripe processing fees (~2.9% + $0.30 per transaction for US cards). These are separate from platform fees and are charged by Stripe directly.

**Best For:** Active sellers on the marketplace or users who frequently hire through the job board. If you make more than ~$767/month in sales or job deposits, this plan pays for itself.

**Break-even calculation:**
- $60/month plan cost
- 3% platform fee savings
- Break-even point: $60 ÷ 0.03 = $2,000/month in sales
- However, if you're already paying $37/month, the incremental cost is $23/month
- Break-even point: $23 ÷ 0.03 = ~$767/month in sales

---

### 3. All-Access Membership - $87/month

**Plan Type:** `cca_membership_87`

**Benefits:**
- Everything included in Monthly Membership
- Complete access to all Legacy Creator profiles
- All assets, job opportunities, and marketplace access
- **0% platform fee** on marketplace sales
- **0% platform fee** on job listings (deposit and final payment)

**Platform Fees:**
- **Marketplace sales:** 0% platform fee (you keep 100% minus Stripe processing fees)
- **Job listings:** 0% platform fee on deposit and final payment

**Note:** You still pay Stripe processing fees (~2.9% + $0.30 per transaction for US cards). These are separate from platform fees and are charged by Stripe directly.

**Best For:** Users who want access to all Legacy Creator content AND want to skip platform fees. This is the premium tier that combines content access with fee savings.

---

## Platform Fee Details

### Marketplace Sales

**Standard Plan ($37/month):**
- Platform fee: 3% per successful sale
- Collected via Stripe Connect application fee
- Example: $100 sale → $3.00 platform fee
- Sellers also pay Stripe processing fees separately (~2.9% + $0.30 for US cards)

**No-Fees Plans ($60/month or $87/month):**
- Platform fee: 0% per successful sale
- Example: $100 sale → $0.00 platform fee
- Sellers only pay Stripe processing fees (~2.9% + $0.30 for US cards)

### Job Board / Hiring

**Standard Plan ($37/month):**
- Platform fee: 3% on the deposit amount only
- No platform fee on the final payment (remaining amount)
- Example: $1,000 job with $200 deposit → $6.00 platform fee (3% of $200)
- The remaining $800 has no platform fee

**No-Fees Plans ($60/month or $87/month):**
- Platform fee: 0% on deposit amount
- Platform fee: 0% on final payment
- Example: $1,000 job with $200 deposit → $0.00 platform fee
- The remaining $800 also has no platform fee

---

## Technical Implementation

### How Fees Are Calculated

The platform fee calculation logic is in `src/lib/fees.ts`:

```typescript
// Plans that skip platform fees
const NO_FEES_PLANS = ['cca_no_fees_60', 'cca_membership_87'];

export async function hasNoFeesPlan(userId: string): Promise<boolean> {
  // Checks if user has an active membership with a no-fees plan
}

export async function computeApplicationFeeAmount(
  amountInMinorUnits: number, 
  feeBps?: number, 
  userId?: string
): Promise<number> {
  // Returns 0 if user has no-fees plan, otherwise calculates 3% fee
}
```

### Where Fees Are Applied

1. **Marketplace Checkout** (`src/app/api/checkout/listing/route.ts`)
   - Checks seller's plan before calculating application fee
   - Seller pays the platform fee (if applicable)

2. **Job Hire** (`src/app/api/jobs/hire/route.ts`)
   - Checks poster's plan before calculating platform fee on deposit
   - Poster pays the platform fee (if applicable)

3. **Webhook Processing** (`src/app/api/webhooks/stripe/route.ts`)
   - Handles subscription creation/updates
   - Sets `membershipActive` and `membershipPlan` in user document

### User Document Structure

```typescript
{
  membershipActive: boolean,      // true if user has active subscription
  membershipPlan: string,         // 'cca_monthly_37' | 'cca_no_fees_60' | 'cca_membership_87'
  membershipSubscriptionId: string // Stripe subscription ID
}
```

---

## Choosing the Right Plan

### Choose Monthly ($37/month) if:
- You primarily consume content (watch videos, download assets)
- You rarely sell on the marketplace (< $767/month)
- You rarely hire through the job board
- You want the most affordable option

### Choose No-Fees ($60/month) if:
- You actively sell on the marketplace (> $767/month)
- You frequently hire through the job board
- You want to maximize your earnings from sales
- You don't need access to Legacy Creator profiles

### Choose All-Access ($87/month) if:
- You want access to all Legacy Creator profiles
- You actively sell on the marketplace or hire through the job board
- You want both content access AND fee savings
- You're a power user who uses multiple platform features

---

## Frequently Asked Questions

### Q: Do I still pay Stripe fees with no-fees plans?

**A:** Yes. Stripe processing fees (~2.9% + $0.30 per transaction) are separate from platform fees and are charged by Stripe directly. These fees apply to all plans.

### Q: Can I switch plans?

**A:** Yes, you can upgrade or downgrade your plan at any time through your account settings. Changes take effect immediately.

### Q: What happens to fees on existing orders?

**A:** Platform fees are calculated at the time of checkout. If you upgrade to a no-fees plan, future transactions will have no platform fees. Past transactions are not affected.

### Q: Do fees apply to both buyers and sellers?

**A:** Platform fees are paid by:
- **Marketplace:** The seller (the person receiving payment)
- **Job listings:** The poster (the person hiring/paying)

Buyers/purchasers do not pay platform fees, only the purchase price.

### Q: How do I know if I'm saving money with a no-fees plan?

**A:** Calculate your monthly platform fees:
- Marketplace: (Total sales × 0.03)
- Job listings: (Total deposits × 0.03)
- If these fees exceed $23/month (difference between $37 and $60 plans), the no-fees plan saves you money.

---

## Support

For questions about pricing or fees, contact support through the platform or email support@coursecreatoracademy.com.

