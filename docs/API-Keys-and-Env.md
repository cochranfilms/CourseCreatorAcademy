## API Keys and Environment Variables

Placeholders for `.env` (server) and `.env.local` (client-exposed `NEXT_PUBLIC_*`).

### Firebase
- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`
- `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID`
- `FIREBASE_ADMIN_PROJECT_ID`
- `FIREBASE_ADMIN_CLIENT_EMAIL`
- `FIREBASE_ADMIN_PRIVATE_KEY` (escape newlines) 

### Stripe
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_CONNECT_CLIENT_ID`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`

### Mux (or Cloudflare Stream)
- `MUX_TOKEN_ID`
- `MUX_TOKEN_SECRET`
- `MUX_WEBHOOK_SECRET`

### Email (Resend or SendGrid)
- `RESEND_API_KEY` (or `SENDGRID_API_KEY`)

### Security & Spam Prevention
- `RECAPTCHA_SITE_KEY`
- `RECAPTCHA_SECRET_KEY`
- `NEXT_PUBLIC_APP_CHECK_DEBUG_TOKEN` (dev)

### Analytics
- `NEXT_PUBLIC_GA4_ID` (e.g., G-XXXXXX)

### Optional Search
- `ALGOLIA_APP_ID`
- `ALGOLIA_SEARCH_KEY`
- `ALGOLIA_ADMIN_KEY`

### Webhook URLs (configure in dashboards)
- Stripe: `https://<domain>/api/webhooks/stripe`
- Mux: `https://<domain>/api/webhooks/mux`


