# Firebase Storage Rules Setup

## IMPORTANT: Update Your Firebase Storage Rules

You need to update your Firebase Storage security rules to allow listing image uploads.

### Steps to Update Storage Rules:

1. Go to Firebase Console → **Storage**
2. Click on the **Rules** tab
3. Replace the current rules with the rules from `docs/firebase-storage-rules.txt`
4. Click **Publish**

### What Changed:

The rules now include explicit paths for both listing and project images:
- Path: `listing-images/{userId}/{allPaths=**}`
- Path: `project-images/{userId}/{allPaths=**}`
- Users can upload images to their own folder only
- Users can read any image
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

## CORS Configuration

**IMPORTANT**: Firebase Storage requires CORS configuration to allow uploads from your production domain. If you're seeing CORS errors like:

```
Access to XMLHttpRequest at 'https://firebasestorage.googleapis.com/...' from origin 'https://coursecreatoracademy.vercel.app' has been blocked by CORS policy
```

You need to configure CORS for your Firebase Storage bucket.

### Option 1: Using gsutil (Recommended)

1. Install Google Cloud SDK if you haven't already:
   ```bash
   # macOS
   brew install google-cloud-sdk
   
   # Or download from: https://cloud.google.com/sdk/docs/install
   ```

2. Authenticate with Google Cloud:
   ```bash
   gcloud auth login
   ```

3. Set your project:
   ```bash
   gcloud config set project course-creator-academy-866d6
   ```

4. Apply the CORS configuration:
   ```bash
   gsutil cors set docs/firebase-storage-cors.json gs://course-creator-academy-866d6.appspot.com
   ```

5. Verify the CORS configuration:
   ```bash
   gsutil cors get gs://course-creator-academy-866d6.appspot.com
   ```

### Option 2: Using Firebase Console (Alternative)

Unfortunately, Firebase Console doesn't provide a direct UI for CORS configuration. You'll need to use gsutil (Option 1) or Google Cloud Console.

### Option 3: Using Google Cloud Console

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select project: `course-creator-academy-866d6`
3. Navigate to **Cloud Storage** → **Buckets**
4. Click on your bucket: `course-creator-academy-866d6.appspot.com`
5. Go to the **Configuration** tab
6. Scroll to **CORS configuration**
7. Click **Edit CORS configuration**
8. Paste the JSON from `docs/firebase-storage-cors.json`
9. Click **Save**

### CORS Configuration File

The CORS configuration file (`docs/firebase-storage-cors.json`) includes:
- Production domain: `https://coursecreatoracademy.vercel.app`
- Custom domain (if you have one): `https://coursecreatoracademy.com`
- Local development: `http://localhost:3000`

**Note**: If you add a custom domain later, update the CORS configuration file and re-apply it.

## Favicon

The favicon is now set to use `/logo-hat.png`. If you want a proper `.ico` file, you can:
1. Convert your logo to `.ico` format
2. Save it as `public/favicon.ico`
3. The current setup will automatically use it

