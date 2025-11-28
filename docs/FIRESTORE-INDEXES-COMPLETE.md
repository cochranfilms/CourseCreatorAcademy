# Complete Firestore Index Reference

This document lists ALL Firestore indexes needed for the application, with direct creation links.

## How to Get Index Creation Links

### Method 1: From Browser Console (Easiest)
When a query fails due to missing index, Firebase will show an error with a clickable link:
```
The query requires an index. You can create it here: [LINK]
```
**Just click the link** - it will open Firebase Console with the index pre-configured!

### Method 2: Manual Creation
1. Go to [Firebase Console → Firestore → Indexes](https://console.firebase.google.com/project/course-creator-academy-866d6/firestore/indexes)
2. Click "Create Index"
3. Fill in the collection and fields as specified below
4. Click "Create"

---

## Required Composite Indexes (where + orderBy)

### 1. Opportunities - User's Posted Jobs
**Collection:** `opportunities`  
**Fields:**
- `posterId` (Ascending)
- `posted` (Descending)

**Used by:**
- Dashboard - "My Posted Opportunities"
- Opportunities page - "My Listings" modal

**Direct Link:**
```
https://console.firebase.google.com/v1/r/project/course-creator-academy-866d6/firestore/indexes?create_composite=CmJwcm9qZWN0cy9jb3Vyc2UtY3JlYXRvci1hY2FkZW15LTg2NmQ2L2RhdGFiYXNlcy8oZGVmYXVsdCkvY29sbGVjdGlvbkdyb3Vwcy9vcHBvcnR1bml0aWVzL2luZGV4ZXMvXxABGgwKCHBvc3RlcklkEAEaCgoGcG9zdGVkEAIaDAoIX19uYW1lX18QAg
```

### 2. Listings - User's Marketplace Listings
**Collection:** `listings`  
**Fields:**
- `creatorId` (Ascending)
- `createdAt` (Descending)

**Used by:**
- Dashboard - "My Marketplace Listings"
- Profile pages - User's listings

**Direct Link:**
```
https://console.firebase.google.com/v1/r/project/course-creator-academy-866d6/firestore/indexes?create_composite=Cl1wcm9qZWN0cy9jb3Vyc2UtY3JlYXRvci1hY2FkZW15LTg2NmQ2L2RhdGFiYXNlcy8oZGVmYXVsdCkvY29sbGVjdGlvbkdyb3Vwcy9saXN0aW5ncy9pbmRleGVzL18QARoNCgljcmVhdG9ySWQQARoNCgljcmVhdGVkQXQQAhoMCghfX25hbWVfXxAC
```

### 3. Projects - User's Projects
**Collection:** `projects`  
**Fields:**
- `creatorId` (Ascending)
- `createdAt` (Descending)

**Used by:**
- Dashboard - "My Projects"
- Profile pages - User's projects

**Manual Creation Required** (no direct link available):
1. Go to [Firebase Console → Firestore → Indexes](https://console.firebase.google.com/project/course-creator-academy-866d6/firestore/indexes)
2. Click "Create Index"
3. Collection ID: `projects`
4. Add fields:
   - Field: `creatorId`, Order: Ascending
   - Field: `createdAt`, Order: Descending
5. Click "Create"

### 4. Job Applications - Applications Sent
**Collection:** `jobApplications`  
**Fields:**
- `applicantId` (Ascending)
- `createdAt` (Descending)

**Used by:**
- Jobs Tab - "Applications Sent" section

**Manual Creation Required:**
1. Go to [Firebase Console → Firestore → Indexes](https://console.firebase.google.com/project/course-creator-academy-866d6/firestore/indexes)
2. Click "Create Index"
3. Collection ID: `jobApplications`
4. Add fields:
   - Field: `applicantId`, Order: Ascending
   - Field: `createdAt`, Order: Descending
5. Click "Create"

### 5. Job Applications - Applications Received
**Collection:** `jobApplications`  
**Fields:**
- `posterId` (Ascending)
- `createdAt` (Descending)

**Used by:**
- Jobs Tab - "Applications Received" section

**Manual Creation Required:**
1. Go to [Firebase Console → Firestore → Indexes](https://console.firebase.google.com/project/course-creator-academy-866d6/firestore/indexes)
2. Click "Create Index"
3. Collection ID: `jobApplications`
4. Add fields:
   - Field: `posterId`, Order: Ascending
   - Field: `createdAt`, Order: Descending
5. Click "Create"

### 6. Orders - Sold Orders (by Seller)
**Collection:** `orders`  
**Fields:**
- `sellerId` (Ascending)
- `trackingDeadlineAtMs` (Descending)

**Used by:**
- Dashboard Orders Tab - "Sold" section
- Orders page - Seller's orders

**Manual Creation Required:**
1. Go to [Firebase Console → Firestore → Indexes](https://console.firebase.google.com/project/course-creator-academy-866d6/firestore/indexes)
2. Click "Create Index"
3. Collection ID: `orders`
4. Add fields:
   - Field: `sellerId`, Order: Ascending
   - Field: `trackingDeadlineAtMs`, Order: Descending
5. Click "Create"

### 7. Orders - Bought Orders (by Buyer)
**Collection:** `orders`  
**Fields:**
- `buyerId` (Ascending)
- `trackingDeadlineAtMs` (Descending)

**Used by:**
- Dashboard Orders Tab - "Bought" section
- Orders page - Buyer's orders

**Manual Creation Required:**
1. Go to [Firebase Console → Firestore → Indexes](https://console.firebase.google.com/project/course-creator-academy-866d6/firestore/indexes)
2. Click "Create Index"
3. Collection ID: `orders`
4. Add fields:
   - Field: `buyerId`, Order: Ascending
   - Field: `trackingDeadlineAtMs`, Order: Descending
5. Click "Create"

### 8. Orders - Orders by Email
**Collection:** `orders`  
**Fields:**
- `customerEmail` (Ascending)
- `trackingDeadlineAtMs` (Descending)

**Used by:**
- Orders page - Fallback for guest purchases

**Manual Creation Required:**
1. Go to [Firebase Console → Firestore → Indexes](https://console.firebase.google.com/project/course-creator-academy-866d6/firestore/indexes)
2. Click "Create Index"
3. Collection ID: `orders`
4. Add fields:
   - Field: `customerEmail`, Order: Ascending
   - Field: `trackingDeadlineAtMs`, Order: Descending
5. Click "Create"

### 9. Threads - User's Message Threads
**Collection:** `threads`  
**Fields:**
- `members` (Array Contains)
- `lastMessageAt` (Descending)

**Used by:**
- Messages component - List of user's threads

**Manual Creation Required:**
1. Go to [Firebase Console → Firestore → Indexes](https://console.firebase.google.com/project/course-creator-academy-866d6/firestore/indexes)
2. Click "Create Index"
3. Collection ID: `threads`
4. Add fields:
   - Field: `members`, Order: Array Contains
   - Field: `lastMessageAt`, Order: Descending
5. Click "Create"

---

## Single-Field Indexes (Usually Auto-Created)

These queries use `orderBy` on a single field. Firestore usually creates these automatically, but if you see errors, you can create them manually:

### 10. Assets - Latest Assets
**Collection:** `assets`  
**Field:** `createdAt` (Descending)

**Used by:**
- Home page - "What's New" featured asset
- Assets page - All assets listing

**Manual Creation (if needed):**
1. Go to [Firebase Console → Firestore → Indexes](https://console.firebase.google.com/project/course-creator-academy-866d6/firestore/indexes)
2. Click "Create Index"
3. Collection ID: `assets`
4. Add field:
   - Field: `createdAt`, Order: Descending
5. Click "Create"

### 11. Listings - All Listings
**Collection:** `listings`  
**Field:** `createdAt` (Descending)

**Used by:**
- Home page - Marketplace preview
- Marketplace page - All listings

**Note:** Usually auto-created, but if you see errors, create manually.

### 12. Opportunities - All Opportunities
**Collection:** `opportunities`  
**Field:** `posted` (Descending)

**Used by:**
- Opportunities page - All jobs listing

**Note:** Usually auto-created, but if you see errors, create manually.

### 13. Discounts - Active Discounts
**Collection:** `discounts`  
**Field:** `createdAt` (Descending)

**Used by:**
- Discounts API - Active discounts listing

**Note:** Usually auto-created, but if you see errors, create manually.

### 14. Notifications - User Notifications
**Collection:** `users/{userId}/notifications`  
**Field:** `createdAt` (Descending)

**Used by:**
- Notifications hook - User's notifications

**Note:** Usually auto-created, but if you see errors, create manually.

---

## Quick Checklist

- [ ] Opportunities - posterId + posted
- [ ] Listings - creatorId + createdAt
- [ ] Projects - creatorId + createdAt
- [ ] Job Applications - applicantId + createdAt
- [ ] Job Applications - posterId + createdAt
- [ ] Orders - sellerId + trackingDeadlineAtMs
- [ ] Orders - buyerId + trackingDeadlineAtMs
- [ ] Orders - customerEmail + trackingDeadlineAtMs
- [ ] Threads - members (array) + lastMessageAt
- [ ] Assets - createdAt (if errors occur)

---

## How to Check Index Status

1. Go to [Firebase Console → Firestore → Indexes](https://console.firebase.google.com/project/course-creator-academy-866d6/firestore/indexes)
2. Look for your indexes in the list
3. Status will show:
   - **Building** - Index is being created (wait 1-2 minutes)
   - **Enabled** - Index is ready to use
   - **Error** - Something went wrong (check the error message)

---

## Troubleshooting

**If you see "Missing or insufficient permissions":**
- This is NOT an index issue - it's a Firestore security rules issue
- Check `docs/firestore-rules.txt` and update rules in Firebase Console

**If you see "The query requires an index":**
- Click the link in the error message (easiest method)
- Or manually create using the instructions above

**If queries are slow:**
- Make sure all composite indexes are created
- Check index status in Firebase Console
- Wait for indexes to finish building (status: Enabled)

---

## Notes

- Single-field indexes (`orderBy` on one field) are usually auto-created by Firestore
- Composite indexes (where + orderBy) MUST be created manually
- Index creation usually takes 1-2 minutes
- The app includes fallback logic to work without indexes (client-side sorting), but indexes improve performance significantly

