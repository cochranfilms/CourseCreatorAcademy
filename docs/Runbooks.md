# Operational Runbooks

## Webhook Replay (Stripe/Mux)
1. Check `webhookEventsProcessed/*` for the event id (Stripe) or `{type}:{data.id}` (Mux).
2. If a replay is required, delete the document to allow re-processing.
3. Re-deliver from the provider dashboard.

## Import Job Re-run
1. Inspect `importJobs/{jobId}` to see applied row hashes.
2. For a full re-run, create a new job (re-upload CSV in commit mode).
3. For targeted reapply, delete specific `rows/{hash}` docs and re-run.

## CORS/Origin Issues
1. Update `CORS_ALLOWED_ORIGINS` with CSV of allowed origins.
2. Ensure `NEXT_PUBLIC_SITE_URL` is set for production uploads.

## Signed Playback Debug
1. Verify `MUX_SIGNING_KEY_ID` and `MUX_SIGNING_PRIVATE_KEY` envs are set.
2. Call `/api/mux/token?playbackId=...` with an authenticated user and check 200.
3. Confirm the video is `isSample=false` and user has entitlements (subscription/enrollment).


