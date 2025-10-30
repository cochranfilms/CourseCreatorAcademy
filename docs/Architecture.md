## Architecture & Hosting Choices

### Stack Summary
- **Frontend**: Next.js 15 (App Router) + TypeScript + Tailwind + shadcn/ui.
- **Auth/DB/RT**: Firebase Authentication + Firestore (Native mode) + Firebase Storage.
- **Video**: Mux (preferred) or Cloudflare Stream for secure adaptive streaming.
- **Payments**: Stripe + Stripe Connect (Standard accounts), Stripe Tax optional.
- **Backend**: Next.js Route Handlers + Firebase Admin SDK + Cloud Functions for webhooks/cron.
- **Hosting**: Vercel for the web app (best DX with Next.js) + Firebase Hosting optional for assets; Mux/Cloudflare store and deliver video; Firebase Storage for non‑video files.
- **Messaging**: Firestore subcollections for threads/messages (realtime), optional presence via RTDB.
- **Email**: Resend or SendGrid (transactional + marketing handoff to ConvertKit/Klaviyo if needed).
- **Analytics**: GA4 + GTM; Stripe dashboards for revenue; Mux Data for QoE.

### Why not “all‑in‑one” DB?
- Firebase provides Auth + DB + Storage with excellent realtime and client SDKs; only video streaming is specialized, so Mux/Cloudflare is added. Alternatives like Supabase (Auth/Postgres/Storage) are strong, but we still need a video CDN/streamer. Firebase wins for chat realtime and simple mobile/PWA usage.

### High‑Level Diagram (text)
Visitor → Next.js (Vercel) → Auth (Firebase)
                           → Firestore (courses, orders, messages)
                           → Stripe Checkout/Portal (payments)
                           → Mux Playback (secure HLS) for lessons
                           → Firebase Storage (thumbnails/resources)
Stripe Webhooks → Cloud Functions → Firestore entitlements/orders/payouts
Mux Webhooks → Cloud Functions → Firestore asset status (ready, errored)

### Services
- **Payments Service**: Create checkout sessions, validate webhooks, grant access, handle Connect payouts and fees.
- **Courses Service**: Catalog, modules/lessons, progress tracking, search indexing.
- **Marketplace Service**: Listings, orders, licenses, download links, reviews.
- **Messaging Service**: Threads, membership to threads, moderation.
- **Admin Service**: RBAC, content moderation, feature flags, refunds.

### Deployment
- Vercel production + preview branches; protected main branch.
- Firebase project (prod + staging) with separate buckets and Mux environments.
- Webhooks: `api/webhooks/stripe`, `api/webhooks/mux`.

### Security
- Firebase App Check + reCAPTCHA Enterprise on critical endpoints.
- Firestore rules for role‑based access; custom claims set via Admin SDK.
- Signed Mux playback tokens; optional watermark overlay.
- Signed Storage URLs for downloads with short TTL; scan uploads for malware via Cloud Functions + VirusTotal if needed.

### Scalability
- Firestore auto‑scales; use batched writes and composite indexes.
- CDN caching for static assets on Vercel; ISR for SEO pages.


