# LUT Video Upload Guide

This guide explains how to upload before/after videos for LUT assets to Firebase Storage so they can be displayed in the side-by-side video slider on the assets page.

## Overview

When a user clicks on "LUTs & Presets" → "LUTs", assets with before/after video previews will display an interactive side-by-side slider. This allows users to drag a slider to compare the original footage (before) with the LUT applied (after).

## Firebase Storage Structure

For each LUT asset, you need to upload two video files:

1. **Before Video**: Original footage without the LUT applied
2. **After Video**: Same footage with the LUT applied

### Recommended Storage Path Structure

```
assets/luts/{asset-folder-name}/before.mp4
assets/luts/{asset-folder-name}/after.mp4
```

Or if you prefer a more descriptive naming:

```
assets/luts/{asset-folder-name}/before-video.mp4
assets/luts/{asset-folder-name}/after-video.mp4
```

### Example Structure

For an asset titled "Sleektone - Warm Ivory", you might have:

```
assets/luts/sleektone-warm-ivory/before.mp4
assets/luts/sleektone-warm-ivory/after.mp4
```

## Video Requirements

### Format
- **Container**: MP4 (recommended) or MOV
- **Codec**: H.264 (most compatible)
- **Audio**: Muted (videos are played without audio)

### Resolution & Quality
- **Recommended**: 720p (1280x720) or 1080p (1920x1080)
- **Aspect Ratio**: 16:9 (standard video format)
- **Frame Rate**: 24fps, 30fps, or 60fps (match your source footage)

### Duration
- **Recommended**: 5-15 seconds
- Videos should loop seamlessly
- Keep file sizes reasonable for fast loading

### File Size Optimization
- Use compression to keep files under 10-20MB per video when possible
- Consider using 720p for previews to reduce bandwidth
- Ensure videos are optimized for web playback

## Updating Firestore Documents

After uploading the videos to Firebase Storage, update the asset document in Firestore to include the video paths:

### Firestore Document Fields

Add these fields to your asset document:

```javascript
{
  id: "asset-id",
  title: "Sleektone - Warm Ivory",
  category: "LUTs & Presets",
  storagePath: "assets/luts/sleektone-warm-ivory.zip",
  beforeVideoPath: "assets/luts/sleektone-warm-ivory/before.mp4",
  afterVideoPath: "assets/luts/sleektone-warm-ivory/after.mp4",
  // ... other fields
}
```

### Using Firebase Admin SDK

```javascript
const admin = require('firebase-admin');
const db = admin.firestore();

async function updateLUTAssetWithVideos(assetId, beforePath, afterPath) {
  await db.collection('assets').doc(assetId).update({
    beforeVideoPath: beforePath,
    afterVideoPath: afterPath,
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  });
}
```

### Using Firebase Console

1. Go to Firebase Console → Firestore Database
2. Navigate to the `assets` collection
3. Find your LUT asset document
4. Add two new fields:
   - `beforeVideoPath` (string): Path to before video
   - `afterVideoPath` (string): Path to after video
5. Save the document

## Upload Methods

### Method 1: Firebase Console (Web UI)

1. Go to Firebase Console → Storage
2. Navigate to or create the folder structure: `assets/luts/{asset-name}/`
3. Upload `before.mp4` and `after.mp4` files
4. Note the full paths (e.g., `assets/luts/sleektone-warm-ivory/before.mp4`)
5. Update the Firestore document with these paths

### Method 2: Firebase Admin SDK (Node.js Script)

Create a script to upload videos:

```javascript
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Initialize Firebase Admin
const serviceAccount = require('./path-to-service-account.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: 'your-project-id.firebasestorage.app'
});

const bucket = admin.storage().bucket();

async function uploadLUTVideos(assetName, beforeVideoPath, afterVideoPath) {
  const basePath = `assets/luts/${assetName}`;
  
  // Upload before video
  const beforeFile = bucket.file(`${basePath}/before.mp4`);
  await beforeFile.save(fs.readFileSync(beforeVideoPath), {
    metadata: {
      contentType: 'video/mp4',
    },
  });
  console.log(`Uploaded: ${basePath}/before.mp4`);
  
  // Upload after video
  const afterFile = bucket.file(`${basePath}/after.mp4`);
  await afterFile.save(fs.readFileSync(afterVideoPath), {
    metadata: {
      contentType: 'video/mp4',
    },
  });
  console.log(`Uploaded: ${basePath}/after.mp4`);
  
  return {
    beforeVideoPath: `${basePath}/before.mp4`,
    afterVideoPath: `${basePath}/after.mp4`
  };
}

// Usage
uploadLUTVideos('sleektone-warm-ivory', './videos/before.mp4', './videos/after.mp4')
  .then(paths => {
    console.log('Upload complete:', paths);
    // Update Firestore document with paths
  })
  .catch(console.error);
```

### Method 3: gsutil (Command Line)

```bash
# Set up gsutil (Google Cloud SDK)
# Install: https://cloud.google.com/sdk/docs/install

# Upload before video
gsutil cp before.mp4 gs://your-bucket-name/assets/luts/asset-name/before.mp4

# Upload after video
gsutil cp after.mp4 gs://your-bucket-name/assets/luts/asset-name/after.mp4
```

## Storage Rules

Ensure your Firebase Storage rules allow reading these video files. Add to your `storage.rules`:

```javascript
match /assets/luts/{allPaths=**} {
  allow read: if request.auth != null;
  allow write: if false; // Only admins can upload via Admin SDK
}
```

## Testing

After uploading videos and updating Firestore:

1. Navigate to `/assets` page
2. Click "LUTs & Presets" tab
3. Click "LUTs" sub-tab
4. Assets with `beforeVideoPath` and `afterVideoPath` will show the side-by-side slider
5. Drag the slider to compare before/after
6. Videos should loop automatically and stay synchronized

## Troubleshooting

### Videos Not Showing
- Verify the paths in Firestore match the actual Storage paths exactly
- Check that videos are uploaded to Storage
- Ensure Storage rules allow reading
- Check browser console for errors

### Videos Not Syncing
- Ensure both videos have the same duration
- Check that videos are the same frame rate
- Verify both videos load successfully

### Performance Issues
- Reduce video resolution to 720p
- Compress videos more aggressively
- Consider shorter preview durations (5-10 seconds)

## Best Practices

1. **Consistent Footage**: Use the same source footage for both before/after videos
2. **Synchronized Timing**: Ensure both videos start at the same frame
3. **Seamless Loops**: Edit videos to loop smoothly without jumps
4. **File Naming**: Use consistent naming conventions (before.mp4, after.mp4)
5. **Organization**: Keep videos organized in folders matching asset names
6. **Testing**: Test videos in different browsers before publishing

## Example Workflow

1. Export your before/after videos from your editing software
2. Optimize videos for web (720p, compressed)
3. Upload to Firebase Storage using your preferred method
4. Update Firestore document with video paths
5. Test on the assets page
6. Verify slider works correctly

