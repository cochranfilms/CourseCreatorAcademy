# Assets Structure Documentation

This document explains the structure and handling of different asset categories, with special focus on the distinction between Overlays and Transitions.

## Asset Categories

The platform supports the following asset categories:

1. **All Packs** - Shows all assets across all categories
2. **LUTs & Presets** - Color grading LUTs and editing presets
   - Subcategories: `LUTs`, `Presets`
3. **Overlays & Transitions** - Video overlays and transition effects
   - Subcategories: `Overlays`, `Transitions`
4. **SFX & Plugins** - Sound effects and audio plugins
   - Subcategories: `SFX`, `Plugins`
5. **Templates** - Video editing templates

## Overlays vs Transitions

### Overview

Both **Overlays** and **Transitions** are part of the "Overlays & Transitions" category but are stored separately and displayed with different subcategory tabs.

### Key Differences

| Feature | Overlays | Transitions |
|--------|----------|-------------|
| **Storage Folder** | `assets/overlays/` | `assets/transitions/` |
| **Purpose** | Visual effects that overlay on top of footage (flares, light leaks, textures) | Effects used to transition between clips |
| **Preview Format** | 720p preview video (same as transitions) | 720p preview video (same as overlays) |
| **Display Component** | `OverlayPlayer` component | `OverlayPlayer` component |
| **Firestore Collection** | `assets/{assetId}/overlays/` | `assets/{assetId}/overlays/` (same subcollection) |

### Storage Structure

#### Overlays
```
assets/overlays/{pack-name}.zip                    # Main ZIP file
assets/overlays/{pack-name}/preview.png            # Thumbnail (optional)
assets/overlays/{pack-name}/{overlay-file}.mp4     # Individual overlay files
assets/overlays/{pack-name}/{overlay-file}_720p.mp4  # 720p preview version
```

#### Transitions
```
assets/transitions/{pack-name}.zip                    # Main ZIP file
assets/transitions/{pack-name}/preview.png            # Thumbnail (optional)
assets/transitions/{pack-name}/{transition-file}.mp4     # Individual transition files
assets/transitions/{pack-name}/{transition-file}_720p.mp4  # 720p preview version
```

### Firestore Structure

Both overlays and transitions are stored in the same Firestore subcollection structure:

```
assets/{assetId}
  ├── title: "Pack Name"
  ├── category: "Overlays & Transitions"
  ├── storagePath: "assets/overlays/pack-name.zip" or "assets/transitions/pack-name.zip"
  └── overlays/ (subcollection)
      ├── {overlayId}
      │   ├── assetId: "{assetId}"
      │   ├── assetTitle: "Pack Name"
      │   ├── fileName: "overlay-01.mp4"
      │   ├── storagePath: "assets/overlays/pack-name/overlay-01.mp4"
      │   ├── previewStoragePath: "assets/overlays/pack-name/overlay-01_720p.mp4" (optional)
      │   ├── fileType: "mp4"
      │   └── createdAt: Timestamp
      └── ...
```

**Note:** The subcategory (Overlays vs Transitions) is determined by the `storagePath` field:
- If `storagePath` contains `/overlays/` → Overlays subcategory
- If `storagePath` contains `/transitions/` → Transitions subcategory

## Admin Asset Upload

When uploading assets via the admin interface (`/admin/assets-upload`):

1. **Select Category**: Choose "Overlays & Transitions"
2. **Select Subcategory**: Choose either "Overlays" or "Transitions"
3. **Upload ZIP File**: Upload your asset pack ZIP file
4. **Optional Thumbnail**: Upload a custom thumbnail image

The system will automatically:
- Store files in the correct folder (`assets/overlays/` or `assets/transitions/`)
- Generate 720p preview videos for video files
- Create Firestore documents in the `overlays` subcollection
- Set the correct `storagePath` to distinguish subcategory

## Preview Video Generation

Both overlays and transitions use the same preview system:

1. **720p Preview Generation**: When processing video files (`.mp4`, `.mov`), the system automatically generates a 720p preview version
2. **Storage**: Preview files are stored with `_720p` suffix (e.g., `overlay-01_720p.mp4`)
3. **Display**: The `OverlayPlayer` component automatically uses the 720p preview if available, falling back to the original file
4. **Performance**: 720p previews load faster and reduce bandwidth usage

## API Endpoints

### Fetching Overlays/Transitions

**Endpoint**: `GET /api/assets/overlays`

Returns all overlays and transitions from all "Overlays & Transitions" assets. The frontend filters by storage path to separate overlays from transitions.

**Response**:
```json
{
  "overlays": [
    {
      "id": "overlay-id",
      "assetId": "asset-id",
      "assetTitle": "Pack Name",
      "fileName": "overlay-01.mp4",
      "storagePath": "assets/overlays/pack-name/overlay-01.mp4",
      "previewStoragePath": "assets/overlays/pack-name/overlay-01_720p.mp4",
      "fileType": "mp4"
    }
  ]
}
```

### Downloading Overlays/Transitions

**Endpoint**: `GET /api/assets/overlay-download?assetId={assetId}&overlayId={overlayId}`

Returns a signed download URL for the original file (not the 720p preview).

## Frontend Display

### Subcategory Tabs

When "Overlays & Transitions" category is selected, subcategory tabs appear:
- **All** - Shows both overlays and transitions
- **Overlays** - Shows only overlays (filters by `/overlays/` in storage path)
- **Transitions** - Shows only transitions (filters by `/transitions/` in storage path)

### OverlayPlayer Component

Both overlays and transitions use the same `OverlayPlayer` component which:
- Displays video previews in 16:9 aspect ratio
- Automatically uses 720p preview if available
- Supports looping video playback
- Handles downloads via the overlay-download API
- Supports favoriting/saving assets

## Best Practices

1. **Naming**: Use clear, descriptive names for your asset packs
2. **Thumbnails**: Always upload a thumbnail for better discoverability
3. **Video Format**: Use `.mp4` format for best compatibility (`.mov` files are automatically converted)
4. **Preview Quality**: The system generates 720p previews automatically - ensure source videos are high quality
5. **Organization**: Keep overlays and transitions in separate packs for better organization

## Migration Notes

- Existing overlays stored in `assets/overlays/` will continue to work
- New transitions should be uploaded with subcategory "Transitions" to be stored in `assets/transitions/`
- The system automatically detects subcategory from storage path, so existing assets don't need migration

