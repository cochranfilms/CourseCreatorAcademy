## Payments & Marketplace Design (Stripe + Connect)

### Pricing Models
- One‑time course purchase (lifetime access) and/or subscription plans.
- Marketplace listings (digital goods). Platform fee on each sale (e.g., 10%).

### Stripe Setup
- Products/Prices in Stripe for flagship course + plans.
- Connect: Standard accounts for creators (self‑service onboarding, Stripe handles KYC).
- Application Fee for platform take rate + automatic transfer to creator.
- Stripe Tax optional.

### Checkout Flows
1) Course Purchase
   - Client requests Checkout Session via API route `/api/checkout/course`.
   - On `checkout.session.completed` webhook, create `purchases` and `enrollments` and email receipt.

2) Marketplace Purchase
   - Single listing checkout `/api/checkout/listing` (or cart).
   - PaymentIntent with `transfer_data[destination]=connectAccountId` and `application_fee_amount`.
   - On `payment_intent.succeeded`, create `orders` and grant download/license.

### Webhooks (Cloud Functions)
- `checkout.session.completed` → upsert purchase + entitlement
- `payment_intent.succeeded` → upsert order + fulfillment
- `charge.refunded` → revoke access and log refund
- `account.updated` (Connect) → update creator onboarding status

### Refunds & Disputes
- Admin can trigger refund via dashboard action → Stripe refund → webhook revokes access.
- Dispute evidence helper: order details, download logs, IP/country, timestamps.

### Coupons & Promotions
- Stripe Coupons/Promotions for campaigns. Firestore feature flags to toggle pricing sections.

### Data Mapping
- `users.stripeCustomerId`
- `users.connectAccountId` (for creators)
- `purchases` and `orders` store Stripe IDs for reconciliation.


