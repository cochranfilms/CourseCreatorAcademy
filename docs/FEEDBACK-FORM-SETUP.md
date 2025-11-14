# Feedback Form Setup

## Overview
A feedback form has been created at `/feedback` for test users to submit feedback and upload screenshots.

## What Was Created

### 1. Feedback Page
- **Location**: `src/app/feedback/page.tsx`
- **Route**: `/feedback` (not added to navigation - direct link only)
- **Features**:
  - Thank you message section for test participants
  - Feedback text input (required)
  - Screenshot upload (optional, up to 5 images, 5MB max per image)
  - Form validation and error handling
  - Success message with auto-redirect
  - Matches app theme (dark background, ccaBlue accents)

### 2. Firestore Collection
- **Collection**: `feedback`
- **Document Structure**:
  ```typescript
  {
    userId: string,
    userEmail: string,
    userName: string,
    feedback: string,
    screenshotUrls: string[],
    createdAt: Timestamp,
    status: 'new'
  }
  ```

### 3. Firebase Storage
- **Path**: `feedback-screenshots/{userId}/{filename}`
- **Limits**: 5MB per image, images only

## Firebase Rules Updates Required

### Firestore Rules
Add the following rules to your Firestore security rules (already added to `docs/firestore-rules.txt`):

```javascript
// Feedback collection - test users can submit feedback
match /feedback/{feedbackId} {
  // Users can read their own feedback submissions
  allow read: if isAuthenticated() && resource.data.userId == request.auth.uid;
  
  // Authenticated users can create feedback submissions
  // User ID must match the authenticated user
  allow create: if isAuthenticated()
    && request.resource.data.userId == request.auth.uid
    && request.resource.data.keys().hasAll(['userId', 'feedback', 'createdAt', 'status'])
    && request.resource.data.status == 'new';
  
  // Users can update their own feedback (e.g., to add more details)
  allow update: if isAuthenticated()
    && resource.data.userId == request.auth.uid
    && request.resource.data.userId == request.auth.uid;
  
  // Deletion not allowed (for audit trail)
  allow delete: if false;
}
```

**Location**: Add this before the final `match /{document=**} { allow read, write: if false; }` rule.

### Storage Rules
Add the following rules to your Firebase Storage security rules (already added to `storage.rules` and `docs/firebase-storage-rules.txt`):

```javascript
// Feedback screenshots - users can upload/read their own feedback screenshots
match /feedback-screenshots/{userId}/{allPaths=**} {
  // Allow authenticated users to read feedback screenshots (for admin review)
  allow read: if request.auth != null;
  
  // Allow users to write only to their own folder
  allow write: if request.auth != null
    && request.auth.uid == userId
    && request.resource.size < 5 * 1024 * 1024  // 5MB max
    && request.resource.contentType.matches('image/.*');
  
  // Allow users to delete their own screenshots
  allow delete: if request.auth != null && request.auth.uid == userId;
}
```

**Location**: Add this before the final `match /{allPaths=**} { allow read, write: if false; }` rule.

## Deployment Steps

1. **Deploy Firestore Rules**:
   - Copy the updated rules from `docs/firestore-rules.txt`
   - Deploy to Firebase Console → Firestore Database → Rules
   - Or use Firebase CLI: `firebase deploy --only firestore:rules`

2. **Deploy Storage Rules**:
   - Copy the updated rules from `storage.rules`
   - Deploy to Firebase Console → Storage → Rules
   - Or use Firebase CLI: `firebase deploy --only storage`

3. **Deploy the Application**:
   - The feedback page is ready to use at `/feedback`
   - Share the link directly with test users (not in navigation)

## Testing

1. Navigate to `/feedback` while authenticated
2. Fill out the feedback form
3. Upload test screenshots (optional)
4. Submit and verify:
   - Success message appears
   - Data is saved to Firestore `feedback` collection
   - Screenshots are uploaded to Storage under `feedback-screenshots/{userId}/`
   - Auto-redirect to `/home` after 3 seconds

## Accessing Feedback

To view submitted feedback:
1. Go to Firebase Console → Firestore Database
2. Navigate to the `feedback` collection
3. Each document contains:
   - User information (userId, userEmail, userName)
   - Feedback text
   - Array of screenshot URLs (if any)
   - Timestamp
   - Status (initially 'new')

## Notes

- The form requires authentication (users must be signed in)
- Screenshots are limited to 5 images, 5MB each
- Feedback cannot be deleted (for audit trail)
- Users can only read/update their own feedback submissions
- The page is not in the main navigation - share the direct link

