# LUT Video Upload Guide

This guide explains how to upload before/after videos for LUT assets to Firebase Storage so they can be displayed in the side-by-side video slider on the assets page.

## Quick Start

**New to this?** See [LUT-VIDEO-UPLOAD-STEPS.md](./LUT-VIDEO-UPLOAD-STEPS.md) for a step-by-step walkthrough.

## Overview

When a user clicks on "LUTs & Presets" → "LUTs", assets with before/after video previews will display an interactive side-by-side slider. This allows users to drag a slider to compare the original footage (before) with the LUT applied (after).

**Important:** Since LUT packs contain multiple individual LUTs, you can create multiple preview videos - one for each LUT in the pack. Each preview will be displayed as a separate card in the grid, allowing users to see previews for all LUTs in a pack.

## Workflow Summary

1. **Upload videos** to Firebase Storage (see [LUT-VIDEO-UPLOAD-STEPS.md](./LUT-VIDEO-UPLOAD-STEPS.md))
2. **Run the script** to create Firestore documents: `node scripts/create-lut-previews-from-storage.js --all`
3. **Verify** documents were created in `assets/{assetId}/lutPreviews/` subcollection
4. **Test** on the assets page - previews should appear automatically

## Firebase Storage Structure

For each individual LUT within a pack, you need to upload two video files:

1. **Before Video**: Original footage without the LUT applied
2. **After Video**: Same footage with the LUT applied

### Storage Path Options

You can organize videos in two ways:

#### Option 1: Files Directly in Pack Folder (Simpler - Recommended)
```
assets/luts/{pack-name}/before.mp4
assets/luts/{pack-name}/after.mp4
assets/luts/{pack-name}/{lut-name}-before.mp4
assets/luts/{pack-name}/{lut-name}-after.mp4
```

**Example:**
```
assets/luts/Thermal Vision - LUTs Collection/before.mp4
assets/luts/Thermal Vision - LUTs Collection/after.mp4
assets/luts/Thermal Vision - LUTs Collection/Thermal-rectolog_compressed-before.mp4
assets/luts/Thermal Vision - LUTs Collection/Thermal-rectolog_compressed-after.mp4
```

#### Option 2: Separate Folders for Each LUT (More Organized)
```
assets/luts/{pack-name}/{lut-name}/before.mp4
assets/luts/{pack-name}/{lut-name}/after.mp4
```

**Example:**
```
assets/luts/Sleektone Minimal LUTs/warm-ivory/before.mp4
assets/luts/Sleektone Minimal LUTs/warm-ivory/after.mp4
assets/luts/Sleektone Minimal LUTs/elegant-taupe/before.mp4
assets/luts/Sleektone Minimal LUTs/elegant-taupe/after.mp4
```

**Note:** The script supports both structures. Option 1 is simpler and works well for most cases.

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

After uploading the videos to Firebase Storage, you need to create individual LUT preview documents in the `lutPreviews` collection. Each preview document represents one LUT within a pack.

### Firestore Collection Structure

**Main Asset Document** (in `assets` collection):
- This is the pack document (e.g., "Sleektone Minimal LUTs")
- Contains pack-level information like title, category, storagePath to ZIP file
- Path: `assets/{assetId}`

**Individual LUT Preview Documents** (in subcollection under asset):
- One document per LUT preview
- Stored as a subcollection under the asset document
- Path: `assets/{assetId}/lutPreviews/{previewId}`
- Contains video paths for that specific LUT

### LUT Preview Document Structure

```javascript
{
  id: "preview-doc-id", // Auto-generated
  assetId: "pack-asset-id", // Reference to the pack
  assetTitle: "Sleektone Minimal LUTs", // Pack title
  lutName: "Warm Ivory", // Name of this specific LUT
  beforeVideoPath: "assets/luts/sleektone-minimal-luts/warm-ivory/before.mp4",
  afterVideoPath: "assets/luts/sleektone-minimal-luts/warm-ivory/after.mp4",
  createdAt: Timestamp
}
```

### Using Firebase Admin SDK

```javascript
const admin = require('firebase-admin');
const db = admin.firestore();

async function createLUTPreview(assetId, assetTitle, lutName, beforePath, afterPath) {
  const previewData = {
    assetId: assetId,
    assetTitle: assetTitle,
    lutName: lutName,
    beforeVideoPath: beforePath,
    afterVideoPath: afterPath,
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  };
  
  // Create in subcollection: assets/{assetId}/lutPreviews/{previewId}
  const previewRef = await db
    .collection('assets')
    .doc(assetId)
    .collection('lutPreviews')
    .add(previewData);
  
  console.log(`Created LUT preview: assets/${assetId}/lutPreviews/${previewRef.id}`);
  return previewRef.id;
}

// Example: Create multiple previews for a pack
const assetId = "your-pack-asset-id";
const assetTitle = "Sleektone Minimal LUTs";

await createLUTPreview(
  assetId,
  assetTitle,
  "Warm Ivory",
  "assets/luts/sleektone-minimal-luts/warm-ivory/before.mp4",
  "assets/luts/sleektone-minimal-luts/warm-ivory/after.mp4"
);

await createLUTPreview(
  assetId,
  assetTitle,
  "Elegant Taupe",
  "assets/luts/sleektone-minimal-luts/elegant-taupe/before.mp4",
  "assets/luts/sleektone-minimal-luts/elegant-taupe/after.mp4"
);
```

### Using Firebase Console

1. Go to Firebase Console → Firestore Database
2. Navigate to the `assets` collection
3. Find your LUT pack asset document (e.g., "Sleektone Minimal LUTs")
4. Click on the asset document to open it
5. Click "Start collection" or find the `lutPreviews` subcollection
6. Click "Add document" (or use the "+" button)
7. Add the following fields:
   - `assetId` (string): The ID of the pack asset document
   - `assetTitle` (string): The title of the pack
   - `lutName` (string): Name of this specific LUT (e.g., "Warm Ivory")
   - `beforeVideoPath` (string): Path to before video
   - `afterVideoPath` (string): Path to after video
   - `createdAt` (timestamp): Current timestamp
8. Save the document
9. Repeat for each LUT in the pack

**Note:** The document will be created at `assets/{assetId}/lutPreviews/{previewId}`

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

## Firestore Rules

Ensure your Firestore rules allow reading LUT preview documents. Add to your Firestore rules:

```javascript
// LUT previews in subcollection
match /assets/{assetId}/lutPreviews/{previewId} {
  allow read: if request.auth != null;
  allow write: if false; // Only admins can create via Admin SDK
}

// Legacy flat collection (if you have existing documents)
match /lutPreviews/{previewId} {
  allow read: if request.auth != null;
  allow write: if false; // Only admins can create via Admin SDK
}
```

## Testing

After uploading videos and creating LUT preview documents:

1. Navigate to `/assets` page
2. Click "LUTs & Presets" tab
3. Click "LUTs" sub-tab
4. You should see individual preview cards for each LUT in packs that have previews
5. Each card shows a side-by-side slider
6. Drag the slider to compare before/after
7. Videos should loop automatically and stay synchronized
8. Clicking on a card downloads the entire pack (not just the previewed LUT)

## Troubleshooting

### Videos Not Showing
- Verify the paths in `lutPreviews` documents match the actual Storage paths exactly
- Check that videos are uploaded to Storage
- Ensure Storage rules allow reading
- Verify that `lutPreviews` documents exist and have correct `assetId` references
- Check browser console for errors
- Ensure you're viewing the "LUTs" sub-tab (not "Presets")

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

1. Export your before/after videos from your editing software (one set per LUT)
2. Optimize videos for web (720p, compressed)
3. Upload to Firebase Storage using your preferred method
   - Organize by pack folder, then LUT name folder
   - Example: `assets/luts/pack-name/lut-name/before.mp4`
4. Create LUT preview documents in Firestore `lutPreviews` collection
   - One document per LUT preview
   - Link to pack via `assetId`
   - Include `lutName` for display
5. Test on the assets page
6. Verify multiple preview cards appear for packs with multiple LUTs
7. Verify slider works correctly on each preview

## Legacy Support

If you have existing assets with `beforeVideoPath` and `afterVideoPath` directly on the asset document (not in `lutPreviews`), those will still work. However, for packs with multiple LUTs, use the `lutPreviews` collection approach for better organization.

