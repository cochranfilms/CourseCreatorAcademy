# Firestore Index Setup

> **📋 For a complete list of ALL indexes, see [FIRESTORE-INDEXES-COMPLETE.md](./FIRESTORE-INDEXES-COMPLETE.md)**

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

### Method 1: Via Error Links (Easiest - Recommended!)

**This is the easiest way!** When a query fails due to missing index, Firebase shows an error with a clickable link:

1. Open your browser console (F12 or Cmd+Option+I)
2. Navigate to a page that uses the query (e.g., Dashboard, Opportunities page)
3. Look for an error like: `The query requires an index. You can create it here: [LINK]`
4. **Click the link** - Firebase Console opens with the index pre-configured!
5. Click "Create Index"
6. Wait 1-2 minutes for the index to build

**Pro Tip:** You can intentionally trigger these errors by visiting pages that use the queries. The error message will always include the creation link.

### Method 2: Via Firebase Console (Manual)

1. Go to [Firebase Console → Firestore → Indexes](https://console.firebase.google.com/project/course-creator-academy-866d6/firestore/indexes)
2. Click "Create Index"
3. Follow the instructions in [FIRESTORE-INDEXES-COMPLETE.md](./FIRESTORE-INDEXES-COMPLETE.md) for each index
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
