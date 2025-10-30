# Firebase Storage Rules Setup

## IMPORTANT: Update Your Firebase Storage Rules

You need to update your Firebase Storage security rules to allow listing image uploads.

### Steps to Update Storage Rules:

1. Go to Firebase Console → **Storage**
2. Click on the **Rules** tab
3. Replace the current rules with the rules from `docs/firebase-storage-rules.txt`
4. Click **Publish**

### What Changed:

The rules now include a new path for listing images:
- Path: `listing-images/{userId}/{allPaths=**}`
- Users can upload images to their own folder
- Users can read any listing image
- Users can delete their own images
- Max file size: 5MB
- Allowed types: images only

### The Rules You Need:

```javascript
rules_version = '2';

service firebase.storage {
  match /b/{bucket}/o {
    // Profile images - users can upload/read their own profile images
    match /profile-images/{userId}/{allPaths=**} {
      allow read: if request.auth != null;
      allow write: if request.auth != null 
        && request.auth.uid == userId
        && request.resource.size < 5 * 1024 * 1024
        && request.resource.contentType.matches('image/.*');
    }
    
    // Listing images - users can upload/read listing images
    match /listing-images/{userId}/{allPaths=**} {
      allow read: if request.auth != null;
      allow write: if request.auth != null 
        && request.auth.uid == userId
        && request.resource.size < 5 * 1024 * 1024
        && request.resource.contentType.matches('image/.*');
      allow delete: if request.auth != null && request.auth.uid == userId;
    }
    
    // Deny all other paths
    match /{allPaths=**} {
      allow read, write: if false;
    }
  }
}
```

### Testing:

After updating the rules:
1. Try uploading a listing image in the marketplace
2. The upload should work without permission errors
3. You should be able to delete images you've uploaded

## Firestore Index Required

You also need to create a Firestore index for listings queries. Click this link from the error message:

```
https://console.firebase.google.com/v1/r/project/course-creator-academy-866d6/firestore/indexes?create_composite=Cl1wcm9qZWN0cy9jb3Vyc2UtY3JlYXRvci1hY2FkZW15LTg2NmQ2L2RhdGFiYXNlcy8oZGVmYXVsdCkvY29sbGVjdGlvbkdyb3Vwcy9saXN0aW5ncy9pbmRleGVzL18QARoNCgljcmVhdG9ySWQQARoNCgljcmVhdGVkQXQQAhoMCghfX25hbWVfXxAC
```

Or manually create an index:
- Collection: `listings`
- Fields: `creatorId` (Ascending), `createdAt` (Descending)

## Favicon

The favicon is now set to use `/logo-hat.png`. If you want a proper `.ico` file, you can:
1. Convert your logo to `.ico` format
2. Save it as `public/favicon.ico`
3. The current setup will automatically use it

