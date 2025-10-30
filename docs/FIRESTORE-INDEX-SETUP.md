# Firestore Index Setup for Opportunities Page

## Required Composite Index

The opportunities page uses a query that requires a composite index in Firestore:

**Collection:** `opportunities`  
**Fields:** 
- `posterId` (Ascending)
- `posted` (Descending)

## How to Create the Index

1. **Via Firebase Console:**
   - Go to Firebase Console → Firestore Database → Indexes
   - Click "Create Index"
   - Collection ID: `opportunities`
   - Add fields:
     - Field: `posterId`, Order: Ascending
     - Field: `posted`, Order: Descending
   - Click "Create"

2. **Via Error Link (Recommended):**
   - When you first run the query, Firebase will show an error in the console
   - The error includes a link to create the index automatically
   - Click the link and Firebase will create it for you

## Fallback Behavior

The code includes a fallback that:
- If the index doesn't exist, it fetches without `orderBy`
- Sorts the results client-side by date
- This ensures the page works even before the index is created

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

