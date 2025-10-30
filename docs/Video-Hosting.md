## Video Hosting & Delivery Strategy

### Choice: Mux (primary)
- Adaptive HLS/DASH, global CDN, caption support, thumbnails/sprites, QoE analytics.
- **Security**: Signed playback tokens, referrer allowlist, optional invisible watermark.
- Upload via direct Mux uploads or server‑generated URL; asset webhooks update status.

### Alternative: Cloudflare Stream
- Similar features, competitive pricing; also supports signed tokens. Either provider works.

### Flow
1. Admin uploads video from dashboard → server creates Mux direct upload URL.
2. On `video.asset.ready` webhook, store `muxAssetId`/`playbackId` in lesson doc.
3. Player uses signed token for playback; disable right‑click download and track events.
4. Store captions (`.vtt`) in Storage and attach to player.

### Files Outside Video
- PDFs, presets, project files → Firebase Storage with short‑TTL signed URLs post‑purchase.

### Player Features
- Resume playback from last position; next/previous lesson hotkeys; 0.5x‑2x speeds; quality selector.


