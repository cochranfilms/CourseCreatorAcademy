# MUX Animated GIF Thumbnails

This document explains how animated GIF thumbnails are automatically generated for MUX video assets.

## Overview

MUX provides animated GIF thumbnails that are generated on-demand from video playback IDs. These GIFs provide a more engaging preview of video content compared to static JPG thumbnails.

## Automatic Generation

Animated GIF URLs are **automatically generated and stored** when a MUX asset becomes ready via webhook:

1. Video is uploaded to MUX
2. MUX processes the video and triggers `video.asset.ready` webhook
3. Webhook handler (`/api/webhooks/mux`) automatically:
   - Generates animated GIF URL: `https://image.mux.com/{PLAYBACK_ID}/animated.gif?width=320`
   - Stores it in the lesson document as `muxAnimatedGifUrl`

## URL Format

Animated GIF URLs follow this format:
```
https://image.mux.com/{PLAYBACK_ID}/animated.gif?width=320
```

### Query Parameters

- `width`: Width in pixels (default: 320, max: 640)
- `start`: Start time in seconds (default: 0)
- `end`: End time in seconds (default: 5 seconds after start)
- `fps`: Frames per second (default: 15, max: 30)

### Example URLs

```javascript
// Basic (320px width, 5 seconds, 15fps)
https://image.mux.com/Mv2sHA2ZvbpkEUn3W9PtO2XEP2kSG6zpOD1c02a8liqE/animated.gif?width=320

// Custom width
https://image.mux.com/{PLAYBACK_ID}/animated.gif?width=640

// Custom timing and FPS
https://image.mux.com/{PLAYBACK_ID}/animated.gif?width=500&start=10&end=13&fps=10
```

## Helper Functions

Use the helper functions in `/src/lib/muxThumbnails.ts`:

```typescript
import { getMuxAnimatedGifUrl, getBestMuxThumbnailUrl } from '@/lib/muxThumbnails';

// Generate animated GIF URL
const gifUrl = getMuxAnimatedGifUrl(playbackId, 320);

// Get best available thumbnail (prefers animated GIF if available)
const bestUrl = getBestMuxThumbnailUrl(playbackId, animatedGifUrl, durationSec);
```

## Data Model

Lesson documents store the animated GIF URL:

```typescript
{
  muxAssetId: string;
  muxPlaybackId: string;
  muxAnimatedGifUrl: string;  // Auto-generated via webhook
  durationSec: number;
}
```

## Backfilling Existing Assets

For existing assets that don't have animated GIF URLs yet, run the backfill script:

```bash
# Backfill all lessons with playback IDs
node scripts/backfill-mux-animated-gifs.js

# Custom width (default: 320)
node scripts/backfill-mux-animated-gifs.js --width 640
```

This script will:
- Find all lessons with `muxPlaybackId` but no `muxAnimatedGifUrl`
- Generate and store the animated GIF URL
- Skip lessons that already have the URL

## Usage in Components

### Option 1: Use Stored URL (Recommended)

If the lesson has `muxAnimatedGifUrl` stored:

```typescript
<img 
  src={lesson.muxAnimatedGifUrl || fallbackStaticUrl} 
  alt={lesson.title}
/>
```

### Option 2: Generate On-Demand

If you don't have the stored URL, generate it:

```typescript
import { getMuxAnimatedGifUrl } from '@/lib/muxThumbnails';

const gifUrl = getMuxAnimatedGifUrl(lesson.muxPlaybackId, 320);
```

### Option 3: Prefer Animated, Fallback to Static

```typescript
import { getBestMuxThumbnailUrl } from '@/lib/muxThumbnails';

const thumbnailUrl = getBestMuxThumbnailUrl(
  lesson.muxPlaybackId,
  lesson.muxAnimatedGifUrl,
  lesson.durationSec,
  true // prefer animated
);
```

## Example: The First Video

The first video in the Technical 101 course already has its animated GIF:

- **Playback ID**: `Mv2sHA2ZvbpkEUn3W9PtO2XEP2kSG6zpOD1c02a8liqE`
- **Animated GIF URL**: `https://image.mux.com/Mv2sHA2ZvbpkEUn3W9PtO2XEP2kSG6zpOD1c02a8liqE/animated.gif?width=320`

This URL is automatically generated and stored when the asset is ready via webhook.

## Webhook Configuration

The MUX webhook at `/api/webhooks/mux` handles:

- `video.asset.ready` - Asset is ready for playback
- `video.asset.updated` - Asset metadata updated

Both events automatically generate and store the animated GIF URL.

## No Manual Setup Required

**You don't need to manually create animated GIF URLs for each asset.** The webhook handles this automatically:

1. ✅ Upload video to MUX
2. ✅ Set passthrough metadata with course/module/lesson IDs (optional)
3. ✅ Webhook automatically generates and stores animated GIF URL
4. ✅ Use `muxAnimatedGifUrl` in your components

## Performance Considerations

- Animated GIFs are generated **on-demand** by MUX's CDN
- First request may take a moment to generate
- Subsequent requests are cached by MUX
- Consider using `loading="lazy"` for images below the fold

## Troubleshooting

### GIF URL not generated

1. Check webhook is configured correctly
2. Verify `muxPlaybackId` exists in lesson document
3. Run backfill script: `node scripts/backfill-mux-animated-gifs.js`

### GIF not displaying

1. Verify playback ID is correct
2. Check URL format matches: `https://image.mux.com/{PLAYBACK_ID}/animated.gif?width=320`
3. Ensure MUX asset is public or signed URLs are configured

### Want different GIF parameters

Modify the webhook handler in `/api/webhooks/mux/route.ts` to customize:
- Width (default: 320)
- Start/end times (default: 0-5 seconds)
- FPS (default: 15)

## References

- [MUX Image API Documentation](https://docs.mux.com/guides/get-images-from-a-video)
- [MUX Animated GIFs](https://support-agent.mux.com/docs/guides/get-images-from-a-video)

