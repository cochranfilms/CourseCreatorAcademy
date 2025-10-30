## Course Creator Academy (CCA) — Product Requirements Document (PRD)

### 1) Overview
- **Goal**: Launch a modern learning and creator marketplace platform where students purchase/access CCA courses and creators can list and sell digital products to other creators. Includes secure video delivery, real‑time messaging, and an optimized conversion landing funnel.
- **Model inspiration**: Structure/UX cues from the Full Time Filmmaker funnel (`https://www.fulltimefilmmaker.com/`).

### 2) Audiences & Roles
- **Visitor**: Anonymous user browsing marketing pages and funnel.
- **Student**: Purchased course(s); streams lessons, tracks progress, joins community messaging.
- **Creator**: Sells digital products/courses/presets; receives payouts; manages orders/messages.
- **Admin**: Manages catalog, users, payouts, disputes, moderation, site content.

### 3) Key Features (Phase 1 → Phase 3)
1. **Authentication & Onboarding**
   - Email/password + OAuth (Google/Apple). Email verification and reCAPTCHA.
   - Roles: `student`, `creator`, `admin` with server‑enforced claims.
2. **Payments & Access Control**
   - Stripe Checkout for one‑time purchases and subscriptions.
   - Stripe Connect (Standard) for marketplace seller onboarding and payouts; platform fee.
   - Webhooks set access entitlements (course ownership) post‑payment.
3. **Course Delivery**
   - Catalog page, course detail page, curriculum (modules → lessons).
   - Secure video streaming via Mux or Cloudflare Stream (ABR HLS/DASH, signed playback).
   - Lesson progress, notes, resources, captions, search.
4. **Creator Marketplace**
   - Listings (digital products, templates, presets, mini courses).
   - Cart/checkout with tax + receipts; license delivery via secure downloads/links.
   - Reviews/ratings, sales analytics for creators.
5. **Messaging**
   - Real‑time DMs and course channels; read receipts and typing indicators.
   - Admin moderation tools, report/ban flows.
6. **Landing Funnel**
   - High‑conversion marketing site: hero, social proof, “what’s inside,” bonuses, curriculum overview, testimonials, pricing, FAQ, sticky CTA, exit intent modal.
7. **Admin Console**
   - CRUD for courses, lessons, creators, listings, coupons, refunds, feature flags.
8. **Analytics**
   - Purchase funnel metrics, cohort retention, lesson completion heatmaps.

### 4) Non‑Goals (initial release)
- Native mobile apps (deliver PWA first).
- Live streaming; VOD only initially.
- Complex forum system (messaging channels cover core needs).

### 5) Success Metrics
- Landing conversion rate from visitor → checkout start → purchase.
- First session lesson start rate; 7‑day lesson completion rate.
- Time‑to‑first creator listing; creator GMV; platform take rate.
- Support tickets per 100 purchases; refund rate; churn for subscriptions.

### 6) Compliance & Risk
- PCI handled by Stripe; no raw card data stored.
- GDPR/CCPA data deletion and export endpoints.
- DRM/piracy mitigation with Mux signed playback and watermarking.
- Marketplace: terms, acceptable use, DMCA, dispute + refund policies.

### 7) Phased Scope & Milestones
- **Phase 1 (Weeks 1‑3)**
  - Landing funnel + Stripe Checkout for flagship course
  - Auth + entitlement after webhook
  - Course player (Mux), progress tracking
- **Phase 2 (Weeks 4‑6)**
  - Creator onboarding (Stripe Connect), marketplace listings, orders, payouts
  - Messaging MVP (DMs + course channels)
- **Phase 3 (Weeks 7‑9)**
  - Admin console, reviews, coupons, refunds
  - Search, email automations, analytics dashboards

### 8) Acceptance Criteria (excerpt)
- Visitors can purchase and immediately access lessons after successful Stripe webhook.
- Videos play with adaptive bitrate and signed URLs; downloads disabled.
- Messaging works in real‑time; unauthorized access blocked by rules.
- Creators can onboard to Stripe, publish a listing, receive a test payout.
- Admin can feature a course, issue refund, and revoke access.

### 9) Dependencies
- Stripe + Stripe Connect; Mux or Cloudflare Stream; Firebase (Auth, Firestore, Storage); Email provider (Resend or SendGrid); reCAPTCHA; Analytics (GA4/Tag Manager). Optional: Algolia for search.

### 10) Open Questions
- Subscription tiers vs one‑time lifetime access for core course?
- Do creators sell only digital downloads or also ship physical goods?
- Refund windows and platform fee structure for marketplace items?


