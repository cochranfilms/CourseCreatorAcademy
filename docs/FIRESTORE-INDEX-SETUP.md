# Firestore Index Setup

## Required Composite Indexes

Your application requires composite indexes for optimal performance. The code includes fallbacks if indexes don't exist, but creating them will improve performance.

### 1. Opportunities Index

**Collection:** `opportunities`  
**Fields:**
- `posterId` (Ascending)
- `posted` (Descending)

**Used by:**
- Dashboard - "My Posted Opportunities" section
- Opportunities page - "My Listings" modal

**Create Index Link:**
Click this link when you see the error in console:
```
https://console.firebase.google.com/v1/r/project/course-creator-academy-866d6/firestore/indexes?create_composite=CmJwcm9qZWN0cy9jb3Vyc2UtY3JlYXRvci1hY2FkZW15LTg2NmQ2L2RhdGFiYXNlcy8oZGVmYXVsdCkvY29sbGVjdGlvbkdyb3Vwcy9vcHBvcnR1bml0aWVzL2luZGV4ZXMvXxABGgwKCHBvc3RlcklkEAEaCgoGcG9zdGVkEAIaDAoIX19uYW1lX18QAg
```

### 2. Listings Index

**Collection:** `listings`  
**Fields:**
- `creatorId` (Ascending)
- `createdAt` (Descending)

**Used by:**
- Dashboard - "My Marketplace Listings" section

**Create Index Link:**
Click this link when you see the error in console:
```
https://console.firebase.google.com/v1/r/project/course-creator-academy-866d6/firestore/indexes?create_composite=Cl1wcm9qZWN0cy9jb3Vyc2UtY3JlYXRvci1hY2FkZW15LTg2NmQ2L2RhdGFiYXNlcy8oZGVmYXVsdCkvY29sbGVjdGlvbkdyb3Vwcy9saXN0aW5ncy9pbmRleGVzL18QARoNCgljcmVhdG9ySWQQARoNCgljcmVhdGVkQXQQAhoMCghfX25hbWVfXxAC
```

### 3. Job Applications - Applications Sent Index

**Collection:** `jobApplications`  
**Fields:**
- `applicantId` (Ascending)
- `createdAt` (Descending)

**Used by:**
- Jobs Tab - "Applications Sent" section

**Create Index:**
1. Go to [Firebase Console → Firestore → Indexes](https://console.firebase.google.com/project/course-creator-academy-866d6/firestore/indexes)
2. Click "Create Index"
3. Collection ID: `jobApplications`
4. Add fields:
   - Field: `applicantId`, Order: Ascending
   - Field: `createdAt`, Order: Descending
5. Click "Create"

### 4. Job Applications - Applications Received Index

**Collection:** `jobApplications`  
**Fields:**
- `posterId` (Ascending)
- `createdAt` (Descending)

**Used by:**
- Jobs Tab - "Applications Received" section

**Create Index:**
1. Go to [Firebase Console → Firestore → Indexes](https://console.firebase.google.com/project/course-creator-academy-866d6/firestore/indexes)
2. Click "Create Index"
3. Collection ID: `jobApplications`
4. Add fields:
   - Field: `posterId`, Order: Ascending
   - Field: `createdAt`, Order: Descending
5. Click "Create"

## How to Create Indexes

### Method 1: Via Error Links (Easiest)

1. When you see an index error in the browser console, click the link provided
2. Firebase Console will open with the index pre-configured
3. Click "Create Index"
4. Wait for the index to build (usually takes 1-2 minutes)

### Method 2: Via Firebase Console

1. Go to Firebase Console → Firestore Database → Indexes
2. Click "Create Index"
3. Follow the instructions above for each index
4. Click "Create"

## Fallback Behavior

The code includes error handling that:
- Catches index errors automatically
- Falls back to fetching without `orderBy` when index doesn't exist
- Sorts results client-side by date
- This ensures the app works even before indexes are created

## Testing

1. Post a job opportunity from the opportunities page
2. Check Firebase Console → Firestore → Data to verify it was created
3. Verify the `posterId` field matches your user's `uid`
4. Click "My Listings" button - your jobs should appear
5. Check the dashboard - opportunities should appear automatically

## Troubleshooting

**If jobs aren't showing:**
1. Check browser console for errors
2. Verify the `posterId` field in Firestore matches your user ID
3. Check Firestore security rules allow reading your own posts
4. Ensure Firebase is properly configured (check environment variables)
5. Create the required indexes using the links above

**Index status:**
- After creating an index, check Firebase Console → Firestore → Indexes
- Status will show "Building" → "Enabled" when ready
- Usually takes 1-2 minutes
