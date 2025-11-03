# How to Place a Mux Video Asset in Your Course

## Overview
When you upload a video to Mux, it creates a video asset with an **Asset ID** and **Playback ID**. These need to be associated with a lesson in your Firestore database.

## Step 1: Get Your Mux Asset ID and Playback ID

### Option A: From Mux Dashboard
1. Log in to [Mux Dashboard](https://dashboard.mux.com/)
2. Go to **Assets** → Click on your uploaded video
3. You'll see:
   - **Asset ID**: `xxxxx` (found in the URL or asset details)
   - **Playback ID**: `xxxxx` (found in the playback section)

### Option B: List All Assets via API
Run this script to see all your Mux assets:

```bash
node scripts/list-mux-assets.js
```

## Step 2: Determine Where to Place the Video

Your video needs to be placed in this Firestore structure:
```
courses/{courseId}/modules/{moduleId}/lessons/{lessonId}
```

### Decide:
1. **Course**: Does the course exist? If not, create it first.
2. **Module**: Which module within the course? (e.g., "Module 1: Introduction")
3. **Lesson**: Which lesson within the module? (e.g., "Lesson 1: Getting Started")

## Step 3: Link the Video to a Lesson

### Option A: Use the Helper Script (Recommended)
Run the helper script that will guide you through the process:

```bash
node scripts/link-mux-video.js
```

This script will:
- Prompt you for Course ID, Module ID, Lesson ID
- Prompt you for Mux Asset ID and Playback ID
- Create/update the lesson document in Firestore

### Option B: Bulk Link Many Videos at Once

Prepare a CSV or JSON mapping and run the bulk linker:

```bash
node scripts/bulk-link-mux-videos.js path/to/mapping.csv
# or
node scripts/bulk-link-mux-videos.js path/to/mapping.json
```

CSV header (required):

```
courseId,moduleId,lessonId,assetId,playbackId,title,index,freePreview,durationSec
```

- `playbackId` is optional; if omitted, the script will fetch it from Mux
- `title/index/freePreview/durationSec` are optional

Example CSV row:

```
technical-101,module-1,lesson-1,02Vp3dV4QiLM22Ge2n004DfOFkxWJp6kpBhBtddLILwKw,,How To Shorten Background Music,1,false,138
```

### Option B: Manual Firestore Update
If you prefer to manually update Firestore:

1. Go to Firebase Console → Firestore Database
2. Navigate to: `courses/{courseId}/modules/{moduleId}/lessons/{lessonId}`
3. Add/update these fields:
   ```json
   {
     "muxAssetId": "your-asset-id-here",
     "muxPlaybackId": "your-playback-id-here",
     "title": "Lesson Title",
     "index": 1,
     "freePreview": false,
     "durationSec": 0  // Will be updated by webhook
   }
   ```

## Step 4: Course Structure Setup

If you need to create the course structure first:

### Create Course Document
```javascript
// In Firebase Console or via script
{
  "title": "Your Course Title",
  "slug": "your-course-slug",
  "summary": "Course description",
  "price": 99,
  "isSubscription": false,
  "featured": false,
  "categories": ["editing"],
  "modulesCount": 1,
  "lessonsCount": 1,
  "createdBy": "your-user-id",
  "createdAt": Timestamp.now(),
  "updatedAt": Timestamp.now(),
  "published": false
}
```

### Create Module Document
```javascript
// Path: courses/{courseId}/modules/{moduleId}
{
  "title": "Module 1: Introduction",
  "index": 1
}
```

### Create Lesson Document
```javascript
// Path: courses/{courseId}/modules/{moduleId}/lessons/{lessonId}
{
  "title": "Lesson 1: Getting Started",
  "index": 1,
  "muxAssetId": "your-asset-id",
  "muxPlaybackId": "your-playback-id",
  "durationSec": 0,
  "freePreview": false,
  "resources": [],
  "transcriptPath": null
}
```

## Step 5: Verify Webhook is Working

Once your video is linked, Mux will send webhooks when:
- Video processing completes (`video.asset.ready`)
- Video duration is calculated
- Playback IDs are generated

Check your webhook endpoint: `/api/webhooks/mux`
- Should receive `video.asset.ready` event
- Should update the lesson document with `durationSec` and other metadata

### Auto-Link via Mux Passthrough (no manual mapping)

If you create assets via the Mux API or Direct Uploads, set the asset `passthrough` with where the lesson lives, for example:

```json
{"courseId":"technical-101","moduleId":"module-1","lessonId":"lesson-1"}
```

Our webhook will parse `passthrough` and automatically set `muxAssetId`, `muxPlaybackId`, and `durationSec` on the lesson. If `passthrough` is not present, the webhook will attempt to find a lesson that already has `muxAssetId` matching the asset.

## Example: Complete Flow

1. **Upload video to Mux** → Get Asset ID: `abc123xyz`
2. **Get Playback ID** from Mux dashboard → `def456uvw`
3. **Create course structure**:
   - Course: `intro-to-video-editing`
   - Module: `module-1`
   - Lesson: `lesson-1`
4. **Link video**:
   ```bash
   node scripts/link-mux-video.js
   # Enter: intro-to-video-editing
   # Enter: module-1
   # Enter: lesson-1
   # Enter: abc123xyz
   # Enter: def456uvw
   ```
5. **Verify** in Firestore that the lesson document has both IDs
6. **Test playback** on your course page

## Troubleshooting

### "Asset ID not found"
- Double-check the Asset ID from Mux dashboard
- Ensure the video has finished processing

### "Playback ID not found"
- Check that the video has a playback policy set
- Playback IDs are generated automatically when an asset is ready

### "Firestore permission denied"
- Ensure you're authenticated as an admin user
- Check Firestore security rules allow admin writes

### "Webhook not updating duration"
- Verify webhook endpoint is accessible
- Check webhook secret is configured correctly
- Review webhook logs in Mux dashboard

