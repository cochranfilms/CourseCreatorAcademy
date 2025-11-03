# Testing Payment Splits for Marketplace Orders

This document explains how to verify that sellers receive their 97% cut correctly when a purchase is made on the marketplace.

## Overview

When a purchase is made:
- **Total amount charged**: The full purchase price (e.g., $100.00)
- **Platform fee (3%)**: CCA receives $3.00 (application fee)
- **Seller receives (97%)**: $97.00 minus Stripe processing fees
- **Stripe processing fees**: ~2.9% + $0.30 for US cards (deducted from seller's payout)

## Payment Flow

1. Buyer initiates checkout → `/api/checkout/listing`
2. Checkout session created with `application_fee_amount` (3% of total)
3. Session created on seller's connected account: `{ stripeAccount: sellerAccountId }`
4. Payment processed → Stripe automatically:
   - Deducts application fee (3%) → Platform account
   - Deducts Stripe processing fees → Stripe
   - Transfers remainder → Seller's connected account

## Testing Methods

### Method 1: API Endpoint (Recommended)

Use the admin API endpoint to verify payment splits:

```bash
# Verify by order ID
curl "https://your-domain.com/api/admin/verify-payment-split?orderId=<orderId>"

# Verify by checkout session ID
curl "https://your-domain.com/api/admin/verify-payment-split?checkoutSessionId=<sessionId>"

# Verify by payment intent ID
curl "https://your-domain.com/api/admin/verify-payment-split?paymentIntentId=<piId>"
```

The response includes:
- Expected vs actual application fee (platform cut)
- Expected vs actual seller amount
- Stripe processing fees
- Verification results (✓ or ✗)

### Method 2: Node Script

Use the verification script to check orders:

```bash
# Verify a specific order
node scripts/verify-payment-splits.js --orderId <orderId>

# Verify a checkout session
node scripts/verify-payment-splits.js --checkoutSessionId <sessionId>

# Verify all orders from last 7 days
node scripts/verify-payment-splits.js --days 7

# Verify all orders
node scripts/verify-payment-splits.js --all
```

### Method 3: Stripe Dashboard (Manual)

1. Go to [Stripe Dashboard](https://dashboard.stripe.com)
2. Navigate to **Payments** → Find the payment
3. Check the **Transfer** section:
   - **Application fee**: Should be 3% of total
   - **Transfer amount**: Should be 97% minus Stripe fees
4. For Connect accounts, view the connected account's dashboard:
   - Navigate to **Connect** → **Accounts** → Select seller account
   - Check **Payments** to see the transfer

## Test Scenario

### Step 1: Create Test Purchase

1. Ensure both buyer and seller have connected Stripe accounts
2. Create a test listing (e.g., $100.00)
3. Complete purchase using Stripe test card: `4242 4242 4242 4242`
4. Note the order ID or checkout session ID

### Step 2: Verify Payment Split

Using the API endpoint:

```bash
curl "http://localhost:3000/api/admin/verify-payment-split?checkoutSessionId=cs_test_..."
```

Expected response for a $100 purchase:

```json
{
  "amounts": {
    "totalCharged": 10000,
    "expectedApplicationFee": 300,
    "actualApplicationFee": 300,
    "expectedSellerAmount": 9700,
    "actualTransferAmount": 9420,
    "stripeProcessingFee": 280
  },
  "percentages": {
    "expectedPlatformFee": "3.00%",
    "expectedSellerCut": "97.00%",
    "actualPlatformFee": "3.00%",
    "actualSellerCut": "94.20%",
    "stripeFeePercent": "2.80%"
  },
  "verification": {
    "applicationFeeCorrect": true,
    "platformReceivedCorrect": true,
    "sellerReceivedCorrect": true
  }
}
```

**Note**: The seller's actual transfer is less than 97% because Stripe processing fees (~2.9% + $0.30) are deducted from their payout. This is expected and correct.

### Step 3: Verify in Stripe Dashboard

1. Log into Stripe Dashboard
2. Navigate to the payment
3. Verify:
   - Application fee: $3.00 (3%)
   - Transfer to seller: ~$94.20 (97% - Stripe fees)

## Common Issues

### Issue: Application fee is 0

**Cause**: Checkout session not created with `application_fee_amount` or created on wrong account

**Solution**: Verify checkout route includes `application_fee_amount` in `payment_intent_data`

### Issue: Transfer amount is 0

**Cause**: Seller's connected account not enabled for charges

**Solution**: Verify seller completed Stripe Connect onboarding and `charges_enabled` is true

### Issue: Seller receives less than expected

**Cause**: Stripe processing fees are deducted from seller's payout (this is expected)

**Solution**: This is correct behavior. Seller receives 97% minus Stripe fees (~2.9% + $0.30)

## Automated Testing

To add automated tests, you can:

1. Create a test order in Stripe test mode
2. Use the verification API endpoint to check the split
3. Assert that:
   - `verification.applicationFeeCorrect === true`
   - `verification.sellerReceivedCorrect === true`

Example test:

```javascript
const response = await fetch(`/api/admin/verify-payment-split?checkoutSessionId=${sessionId}`);
const data = await response.json();

expect(data.verification.applicationFeeCorrect).toBe(true);
expect(data.verification.sellerReceivedCorrect).toBe(true);
expect(data.amounts.actualApplicationFee).toBe(data.amounts.expectedApplicationFee);
```

## Monitoring

Consider setting up alerts for:
- Payment splits where `applicationFeeCorrect === false`
- Payment splits where seller receives significantly less than 97% (excluding Stripe fees)

## Additional Resources

- [Stripe Connect Direct Charges](https://stripe.com/docs/connect/direct-charges)
- [Stripe Application Fees](https://stripe.com/docs/connect/application-fees)
- [Stripe Processing Fees](https://stripe.com/pricing)

