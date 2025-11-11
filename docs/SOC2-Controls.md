# SOC 2 Technical Controls Mapping (Implemented)

- Access Control
  - Role-based gating for admin importer (`/admin/import`) and token minting (`/api/mux/token`).
  - Firebase Admin auth on server routes.
- Change Management
  - Idempotent webhooks; processed event store (`webhookEventsProcessed/*`).
  - Import jobs tracked under `importJobs/{jobId}`.
- Data Protection
  - Signed playback for non-sample content (Mux).
  - CSP, HSTS, security headers in `next.config.ts`.
  - Origin allowlist for uploads and TUS proxy via `CORS_ALLOWED_ORIGINS`.
- Logging & Monitoring
  - Structured JSON logs (`src/lib/log.ts`).
  - Audit trail writes (`src/lib/audit.ts`) across sensitive actions.
- Availability & Abusability
  - Rate limiting middleware for sensitive routes (`src/middleware.ts`).

Recommended next steps:
- Secrets manager (1Password/Doppler) for all env vars.
- Centralized log shipping (Datadog/Splunk/OpenTelemetry).
- Regular access reviews and incident runbooks.


