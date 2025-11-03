# Legacy+ Feature Setup Guide

This guide explains how to set up and use the Legacy+ feature for creators.

## Overview

Legacy+ allows users to subscribe to individual creators for $10/month, unlocking exclusive content from those creators.

## Data Model

### Collections

1. **`legacy_creators`** - Legacy creator profiles
   ```typescript
   {
     id: string; // document ID
     handle: string; // e.g., "PETER"
     displayName: string; // e.g., "Peter McKinnon"
     avatarUrl?: string;
     bannerUrl?: string;
     bio?: string;
     kitSlug?: string; // URL slug for creator kit page
     connectAccountId: string; // Stripe Connect account ID (required)
     samplesCount?: number; // count of sample videos
     order?: number; // display order
   }
   ```

2. **`legacySubscriptions`** - User subscriptions to creators
   ```typescript
   {
     userId: string;
     creatorId: string;
     subscriptionId: string; // Stripe subscription ID
     checkoutSessionId: string;
     status: 'active' | 'trialing' | 'canceled' | 'past_due';
     amount: number; // in cents (1000 = $10.00)
     currency: string; // 'usd'
     sellerAccountId: string; // creator's Stripe Connect account
     createdAt: Timestamp;
     updatedAt: Timestamp;
   }
   ```

3. **`legacy_creators/{creatorId}/videos`** - Creator's video content
   ```typescript
   {
     id: string;
     title: string;
     description?: string;
     muxAssetId: string;
     muxPlaybackId: string;
     muxAnimatedGifUrl?: string;
     durationSec: number;
     isSample: boolean; // true for sample videos (visible to all)
     createdAt: Timestamp;
     updatedAt: Timestamp;
   }
   ```

## Setting Up Legacy Creators

### Step 1: Create Legacy Creator Document

Create a document in `legacy_creators` collection:

```javascript
{
  handle: "PETER",
  displayName: "Peter McKinnon",
  avatarUrl: "https://...",
  bannerUrl: "https://...",
  bio: "Award-winning filmmaker and photographer...",
  kitSlug: "peter-mckinnon", // URL-friendly slug
  connectAccountId: "acct_...", // Stripe Connect account ID
  order: 1 // Display order
}
```

### Step 2: Ensure Stripe Connect Account

1. Creator must complete Stripe Connect onboarding
2. Get their `connectAccountId` from Stripe Dashboard or your database
3. Ensure `charges_enabled: true` on their Connect account

### Step 3: Upload Sample Videos (3 Required)

Each legacy creator must have at least 3 sample videos (`isSample: true`) that are visible to all users.

**Option A: Using MUX Upload API**

```bash
POST /api/legacy/upload
{
  "creatorId": "creator-id",
  "title": "Sample Video Title",
  "description": "Video description",
  "isSample": true
}
```

This returns a `uploadUrl` for direct upload to MUX. When the video is processed, the webhook automatically creates the video document.

**Option B: Manual Upload**

1. Upload video to MUX manually
2. Get `assetId` and `playbackId`
3. Create document in `legacy_creators/{creatorId}/videos`:
   ```javascript
   {
     title: "Sample Video",
     description: "...",
     muxAssetId: "asset-id",
     muxPlaybackId: "playback-id",
     muxAnimatedGifUrl: "https://image.mux.com/{playbackId}/animated.gif?width=320",
     durationSec: 300,
     isSample: true,
     createdAt: serverTimestamp(),
     updatedAt: serverTimestamp()
   }
   ```

## User Flow

### 1. Browse Creator Kits

- Home page shows all creators with 3+ samples
- Users can view sample videos from any creator
- Clicking a creator kit opens `/creator-kits/{kitSlug}`

### 2. Subscribe to Creator

1. User clicks "Upgrade to Legacy+" in header
2. Modal shows list of 5 legacy creators
3. User selects a creator
4. Stripe Checkout Session created on creator's Connect account
5. User completes payment
6. Webhook creates subscription document
7. User gains access to creator's full content

### 3. View Creator Kit

- **Without subscription**: Shows 3 sample videos only
- **With subscription**: Shows all videos (samples + exclusive content)
- Upgrade button shown for non-subscribers

### 4. Manage Subscriptions

- Dashboard → "Legacy+ Subscriptions" tab
- View all active subscriptions
- Click "View Kit" to access creator content

## APIs

### GET `/api/legacy/creators`
Returns list of all legacy creators (public fields only).

### POST `/api/legacy/subscribe`
Creates Stripe Checkout Session for subscription.
```json
{
  "creatorId": "creator-id",
  "buyerId": "user-id"
}
```

### GET `/api/legacy/subscriptions?userId={userId}`
Returns user's active Legacy+ subscriptions with creator info.

### POST `/api/legacy/upload`
Creates MUX direct upload URL for legacy creator videos.
```json
{
  "creatorId": "creator-id",
  "title": "Video Title",
  "description": "Description",
  "isSample": false
}
```

## Webhooks

### Stripe Webhooks

The existing webhook at `/api/webhooks/stripe` handles:
- `checkout.session.completed` - Creates subscription when subscription checkout completes
- `customer.subscription.updated` - Updates subscription status
- `customer.subscription.deleted` - Marks subscription as canceled

### MUX Webhooks

The existing webhook at `/api/webhooks/mux` handles:
- `video.asset.ready` - Creates video document when upload completes
- Supports legacy creator videos via `passthrough` metadata:
  ```json
  {
    "legacyCreatorId": "creator-id",
    "title": "Video Title",
    "description": "Description",
    "isSample": false
  }
  ```

## Content Gating

Videos are gated based on `isSample` flag:
- **Sample videos** (`isSample: true`): Visible to all users (max 3 shown)
- **Exclusive videos** (`isSample: false`): Only visible to subscribers

The creator kit page automatically:
1. Shows all sample videos to everyone
2. Shows exclusive videos only if user has active subscription
3. Displays upgrade prompt for non-subscribers viewing exclusive section

## Testing

### Test Subscription Flow

1. Create a test legacy creator in Firestore
2. Ensure they have Stripe Connect account with `charges_enabled: true`
3. Use Stripe test card: `4242 4242 4242 4242`
4. Complete checkout flow
5. Verify subscription created in `legacySubscriptions`
6. Verify user can see full content on creator kit page

### Test Content Gating

1. View creator kit as non-subscriber → should see only samples
2. Subscribe to creator
3. View creator kit again → should see all videos
4. Cancel subscription
5. View creator kit → should see only samples again

## Troubleshooting

### Creator not showing in modal
- Check `legacy_creators` collection exists
- Verify creator has `connectAccountId` set
- Check API endpoint `/api/legacy/creators` returns data

### Subscription not activating
- Check Stripe webhook is configured correctly
- Verify webhook secret in environment variables
- Check webhook logs for errors
- Verify `legacySubscriptions` document was created

### Videos not appearing
- Check MUX webhook is configured
- Verify `passthrough` metadata includes `legacyCreatorId`
- Check video document exists in `legacy_creators/{creatorId}/videos`
- Verify `isSample` flag is set correctly

### Content gating not working
- Verify user has active subscription with `status: 'active'` or `'trialing'`
- Check `creatorId` matches between subscription and creator
- Verify `isSample` flag on videos

## Next Steps

1. **Create 5 Legacy Creators** in Firestore
2. **Upload 3 sample videos** for each creator
3. **Test subscription flow** with Stripe test cards
4. **Verify content gating** works correctly
5. **Set up production Stripe Connect accounts** for creators

