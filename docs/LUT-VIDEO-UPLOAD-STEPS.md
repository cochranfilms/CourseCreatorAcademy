# Step-by-Step Guide: Uploading LUT Preview Videos

This guide walks you through uploading before/after videos for LUT assets to Firebase Storage.

## Prerequisites

- Access to Firebase Console
- Your before/after video files ready (MP4 format recommended)
- Knowledge of which LUT pack each video belongs to

## Step 1: Prepare Your Videos

For each LUT in a pack, you need:
- **Before video**: Original footage without the LUT applied
- **After video**: Same footage with the LUT applied

**Video Requirements:**
- Format: MP4 (H.264 codec)
- Resolution: 720p (1280x720) or 1080p (1920x1080)
- Duration: 5-15 seconds (should loop seamlessly)
- Audio: Muted (videos play without sound)
- File size: Keep under 20MB per video when possible

## Step 2: Find Your Asset Document and Storage Path

Before uploading videos, you need to identify:
1. **The asset document** in Firestore (`assets/{assetId}`)
2. **The storage folder name** from the asset's `storagePath` field

### Finding the Asset Document

1. Go to Firebase Console → **Firestore Database**
2. Navigate to the `assets` collection
3. Find your LUT pack asset document (e.g., "Thermal Vision   Luts Collection")
4. Click on it to open the document
5. Note the **Document ID** (the alphanumeric string like `xoyPExTEt3hzBVSmMgIt`)
6. **Check the `storagePath` field** - this is crucial!
   - Example: `assets/luts/Thermal Vision - LUTs Collection.zip`
   - Extract the folder name: `Thermal Vision - LUTs Collection` (remove `assets/luts/` prefix and `.zip` extension)
   - **This is the exact folder name you'll use in Storage**

### Understanding the Structure

- **Firestore:** `assets/{assetId}` - Contains asset document with metadata
  - `title`: "Thermal Vision   Luts Collection"
  - `storagePath`: "assets/luts/Thermal Vision - LUTs Collection.zip" (points to ZIP download)
  - `category`: "LUTs & Presets"
  
- **Storage:** `assets/luts/{folder-name}/` - Where you upload preview videos
  - Folder name comes from `storagePath` (without `.zip`)
  - Example: `assets/luts/Thermal Vision - LUTs Collection/`

**Important:** The script matches videos to assets by:
1. **Primary:** Comparing Storage folder name with folder name extracted from asset's `storagePath`
2. **Fallback:** Comparing Storage folder name with asset document title
3. The folder name from `storagePath` is the most reliable match

## Step 3: Organize Your Files in Storage

Upload videos to Firebase Storage (not Firestore). Organize them in one of these structures:

### Option A: Files Directly in Pack Folder (Simpler - Recommended)
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

**Note:** The `{pack-name}` should match the folder name from your asset's `storagePath` (without the `.zip` extension).

### Option B: Separate Folders for Each LUT (More Organized)
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

## Step 4: Upload to Firebase Storage

### Method 1: Firebase Console (Web UI) - Easiest

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Navigate to **Storage** in the left sidebar
4. Click **Get Started** if you haven't set up Storage yet
5. Navigate to or create the folder structure:
   - Click **Upload file** or drag and drop
   - Create folders as needed: `assets` → `luts` → `{pack-name}` → `{lut-name}` (if using Option B)
6. Upload your video files:
   - Upload `before.mp4` and `after.mp4` files
   - Make sure the paths match your chosen structure
7. Verify the files are uploaded:
   - Check that both `before.mp4` and `after.mp4` exist for each LUT
   - Note the exact paths (you'll need these)

### Method 2: Firebase Admin SDK (Node.js Script)

Create a script to upload videos programmatically:

```javascript
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Initialize Firebase Admin (use your existing setup)
const serviceAccount = require('./path-to-service-account.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: 'your-project-id.firebasestorage.app'
});

const bucket = admin.storage().bucket();

async function uploadLUTVideo(localPath, storagePath) {
  const file = bucket.file(storagePath);
  await file.save(fs.readFileSync(localPath), {
    metadata: {
      contentType: 'video/mp4',
    },
  });
  console.log(`✓ Uploaded: ${storagePath}`);
}

// Example: Upload videos for a pack
const packName = 'Thermal Vision - LUTs Collection';

// Upload generic before/after
await uploadLUTVideo('./videos/before.mp4', `assets/luts/${packName}/before.mp4`);
await uploadLUTVideo('./videos/after.mp4', `assets/luts/${packName}/after.mp4`);

// Upload specific LUT videos
await uploadLUTVideo('./videos/thermal-before.mp4', `assets/luts/${packName}/Thermal-rectolog_compressed-before.mp4`);
await uploadLUTVideo('./videos/thermal-after.mp4', `assets/luts/${packName}/Thermal-rectolog_compressed-after.mp4`);
```

### Method 3: gsutil (Command Line)

```bash
# Install Google Cloud SDK first: https://cloud.google.com/sdk/docs/install

# Set your project
gcloud config set project your-project-id

# Upload files
gsutil cp ./before.mp4 gs://your-bucket-name/assets/luts/pack-name/before.mp4
gsutil cp ./after.mp4 gs://your-bucket-name/assets/luts/pack-name/after.mp4
```

## Step 5: Verify Uploads

After uploading, verify in Firebase Console:
1. Go to **Storage**
2. Navigate to `assets/luts/{pack-name}/`
3. Confirm you see:
   - `before.mp4` and `after.mp4` (for generic pack preview)
   - `{lut-name}-before.mp4` and `{lut-name}-after.mp4` (for specific LUTs)

## Step 6: Run the Script to Create Documents

Once videos are uploaded, run the script to create Firestore documents:

```bash
# Dry run first to see what would be created
node scripts/create-lut-previews-from-storage.js --all --dry-run

# If everything looks good, create the documents
node scripts/create-lut-previews-from-storage.js --all
```

The script will:
1. Find all LUT assets in Firestore (`assets` collection)
2. Scan Storage for video files in `assets/luts/{pack-name}/` folders
3. Match Storage folders to asset documents by comparing names
4. Group before/after video pairs by LUT name
5. Create documents in `assets/{assetId}/lutPreviews/{previewId}` subcollection

**Important:** The script matches pack folders to assets by:
- Comparing Storage folder name (e.g., `Thermal Vision - LUTs Collection`)
- With asset document title (e.g., `Thermal Vision   Luts Collection`)
- And asset `storagePath` (e.g., `assets/luts/Thermal Vision - LUTs Collection.zip`)

If a match isn't found, the script will skip that pack folder.

## Step 7: Verify Documents Created

1. Go to Firebase Console → **Firestore Database**
2. Navigate to `assets` collection
3. Find your LUT pack asset document
4. Click on it to open
5. Look for the `lutPreviews` subcollection
6. Verify documents were created with:
   - `lutName`: Name of the LUT
   - `beforeVideoPath`: Path to before video
   - `afterVideoPath`: Path to after video
   - `assetId` and `assetTitle`: Reference to parent pack

## Naming Conventions

### For Generic Pack Preview
- Files: `before.mp4` and `after.mp4`
- Will create preview with `lutName` = pack name

### For Specific LUT Previews
- Files: `{lut-name}-before.mp4` and `{lut-name}-after.mp4`
- Examples:
  - `Thermal-rectolog_compressed-before.mp4` / `Thermal-rectolog_compressed-after.mp4`
  - `warm-ivory-before.mp4` / `warm-ivory-after.mp4`
  - `elegant-taupe-before.mp4` / `elegant-taupe-after.mp4`

### Best Practices
- Use lowercase with dashes: `warm-ivory`, `elegant-taupe`
- Avoid spaces (use dashes or underscores)
- Keep names descriptive but concise
- Match the LUT file names if possible

## Troubleshooting

### Videos Not Found by Script
- Check that files are in `assets/luts/{pack-name}/` folder
- Verify file names match expected patterns (`-before.mp4`, `-after.mp4`)
- Ensure files are actually MP4 videos (not images or other formats)

### Script Can't Match Pack to Asset
- **Check the asset's `storagePath` field** - the folder name should match this (without `.zip`)
- Make sure pack folder name matches asset title (case-insensitive, spaces/dashes normalized)
- Check for special characters that might cause matching issues
- The script tries to match by:
  - Comparing Storage folder name with asset `storagePath` folder name
  - Comparing Storage folder name with asset title (normalized)
  - Title contains pack name (normalized)
  - Pack name contains title (normalized)
- **Example:** If `storagePath` is `assets/luts/Thermal Vision - LUTs Collection.zip`, 
  upload videos to `assets/luts/Thermal Vision - LUTs Collection/` folder

### Documents Not Created
- Check that both `before` and `after` videos exist for each LUT
- Verify videos are actual video files (not images)
- Check browser console for errors
- Run with `--dry-run` first to see what would be created

## Example: Complete Workflow

1. **Find your asset document:**
   - Go to Firestore → `assets` collection
   - Find "Thermal Vision   Luts Collection" (note the Document ID: `xoyPExTEt3hzBVSmMgIt`)
   - Check `storagePath`: `assets/luts/Thermal Vision - LUTs Collection.zip`
   - Use folder name: `Thermal Vision - LUTs Collection` (without `.zip`)

2. **Prepare videos:**
   - Export `before.mp4` and `after.mp4` for the pack
   - Export `thermal-before.mp4` and `thermal-after.mp4` for the "Thermal" LUT

3. **Upload to Storage:**
   - Go to Firebase Console → Storage
   - Navigate to `assets/luts/` folder
   - Create folder: `Thermal Vision - LUTs Collection` (match the folder name from `storagePath`)
   - Upload files:
     ```
     assets/luts/Thermal Vision - LUTs Collection/before.mp4
     assets/luts/Thermal Vision - LUTs Collection/after.mp4
     assets/luts/Thermal Vision - LUTs Collection/Thermal-rectolog_compressed-before.mp4
     assets/luts/Thermal Vision - LUTs Collection/Thermal-rectolog_compressed-after.mp4
     ```

4. **Run script:**
   ```bash
   node scripts/create-lut-previews-from-storage.js --all
   ```
   The script will:
   - Find asset document `xoyPExTEt3hzBVSmMgIt` 
   - Match it to Storage folder `Thermal Vision - LUTs Collection`
   - Create documents in `assets/xoyPExTEt3hzBVSmMgIt/lutPreviews/`

5. **Verify in Firestore:**
   - Go to `assets` collection → Document `xoyPExTEt3hzBVSmMgIt`
   - Open `lutPreviews` subcollection
   - Should have 2 documents:
     - One with `lutName: "Thermal Vision - LUTs Collection"` (generic)
     - One with `lutName: "Thermal-rectolog_compressed"` (specific)

6. **Check on website:**
   - Go to `/assets` page
   - Click "LUTs & Presets" → "LUTs"
   - You should see preview cards with side-by-side sliders

## Next Steps

After uploading videos and creating documents:
- Test the previews on the assets page
- Verify sliders work correctly
- Check that videos loop smoothly
- Ensure download functionality works

