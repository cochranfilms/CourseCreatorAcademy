# Firebase Configuration & Error Troubleshooting Guide

## Common Errors and Solutions

### 1. Authentication Errors (400 Status)

**Error**: `identitytoolkit.googleapis.com/v1/accounts:lookup?key=... Failed to load resource: the server responded with a status of 400`

**Causes**:
- Invalid or expired Firebase API key
- Incorrect Firebase project configuration
- Missing or incorrect environment variables

**Solutions**:

1. **Verify Firebase API Key**:
   - Go to [Firebase Console](https://console.firebase.google.com/)
   - Select your project: `course-creator-academy-866d6`
   - Go to **Project Settings** (gear icon) → **General**
   - Scroll to **Your apps** section
   - Copy the API Key (starts with `AIza...`)
   - Ensure it matches your environment variable: `NEXT_PUBLIC_FIREBASE_API_KEY`

2. **Check Environment Variables**:
   - Verify all required environment variables are set in Vercel
   - Ensure variable names match exactly (case-sensitive)
   - Redeploy after updating environment variables

3. **Verify Firebase Authentication is Enabled**:
   - Go to Firebase Console → **Authentication** → **Sign-in method**
   - Ensure Email/Password is enabled
   - If using Google/Facebook, ensure they are configured correctly

### 2. Cross-Origin-Opener-Policy (COOP) Warnings

**Error**: `Cross-Origin-Opener-Policy policy would block the window.closed call`

**Explanation**: This is a browser security warning related to OAuth popup windows (Google/Facebook login). It's a warning, not an error, and typically doesn't break functionality.

**Solutions**:

1. **For Development**: These warnings can be safely ignored during development
2. **For Production**: Add COOP headers to your Next.js config:
   ```javascript
   // next.config.js
   async headers() {
     return [
       {
         source: '/(.*)',
         headers: [
           {
             key: 'Cross-Origin-Opener-Policy',
             value: 'same-origin-allow-popups',
           },
         ],
       },
     ];
   }
   ```

### 3. Firestore Permission Errors

**Error**: `Missing or insufficient permissions`

**Solution**: Update your Firestore Security Rules in Firebase Console:

1. Go to Firebase Console → **Firestore Database** → **Rules** tab
2. Copy the rules from `docs/firestore-rules.txt`
3. Paste into the rules editor
4. Click **Publish**

**Important**: The updated rules include:
- `threads` collection for messaging
- `threads/{threadId}/messages` subcollection
- `projects` collection for user projects

### 4. Firestore Index Errors

**Error**: `The query requires an index`

**Solution**: Click the link provided in the error message to create the index automatically, OR:

1. Go to Firebase Console → **Firestore Database** → **Indexes** tab
2. Click **Create Index**
3. Follow the instructions in `docs/FIRESTORE-INDEX-SETUP.md`

**Required Indexes**:
- `listings`: `creatorId` (Ascending) + `createdAt` (Descending)
- `opportunities`: `posterId` (Ascending) + `posted` (Descending)
- `threads`: `members` (Array Contains) + `lastMessageAt` (Descending)

### 5. Firebase Storage CORS Errors

**Error**: `Access to XMLHttpRequest at 'https://firebasestorage.googleapis.com/...' from origin 'https://coursecreatoracademy.vercel.app' has been blocked by CORS policy: Response to preflight request doesn't pass access control check`

**Causes**:
- Firebase Storage bucket doesn't have CORS configured for your production domain
- CORS configuration is missing or incorrect

**Solutions**:

1. **Configure CORS using gsutil** (Recommended):
   ```bash
   # Install Google Cloud SDK if needed
   brew install google-cloud-sdk
   
   # Authenticate
   gcloud auth login
   
   # Set project
   gcloud config set project course-creator-academy-866d6
   
   # Apply CORS configuration
   gsutil cors set docs/firebase-storage-cors.json gs://course-creator-academy-866d6.appspot.com
   ```

2. **Verify CORS configuration**:
   ```bash
   gsutil cors get gs://course-creator-academy-866d6.appspot.com
   ```

3. **Alternative: Use Google Cloud Console**:
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Navigate to **Cloud Storage** → **Buckets** → `course-creator-academy-866d6.appspot.com`
   - Go to **Configuration** tab → **CORS configuration**
   - Edit and paste the JSON from `docs/firebase-storage-cors.json`

**See**: `docs/STORAGE-RULES-SETUP.md` for detailed CORS configuration instructions.

## Firebase Configuration Checklist

### Required Environment Variables

Ensure these are set in your Vercel project:

```bash
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSy...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=course-creator-academy-866d6.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=course-creator-academy-866d6
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=course-creator-academy-866d6.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=653132189312
NEXT_PUBLIC_FIREBASE_APP_ID=1:653132189312:web:a01e270f08d991a7932065
```

### Firebase Console Setup Checklist

- [ ] Firebase project created: `course-creator-academy-866d6`
- [ ] Firestore Database created
- [ ] Authentication enabled:
  - [ ] Email/Password authentication enabled
  - [ ] Google authentication enabled (if using)
  - [ ] Facebook authentication configured (if using)
- [ ] Firestore Security Rules updated from `docs/firestore-rules.txt`
- [ ] Required Firestore indexes created
- [ ] Storage rules configured (if using file uploads)

## Testing Authentication

1. **Check Firebase Console**:
   - Go to Authentication → Users
   - Verify test users are created

2. **Test Login Flow**:
   - Try logging in with email/password
   - Try logging in with Google (if enabled)
   - Try logging in with Facebook (if enabled)
   - Check browser console for errors

3. **Check Firestore Access**:
   - After logging in, check if you can read/write data
   - Check browser console for permission errors

## Debugging Steps

1. **Clear Browser Cache**:
   - Clear cache and cookies
   - Try in incognito/private mode

2. **Check Browser Console**:
   - Look for specific error messages
   - Check Network tab for failed requests

3. **Verify Firebase Project**:
   - Confirm you're using the correct project ID
   - Check Firebase Console for any service outages

4. **Check Environment Variables**:
   - Verify variables are set correctly
   - Ensure they're prefixed with `NEXT_PUBLIC_` for client-side access
   - Redeploy after updating variables

## Getting Help

If errors persist:

1. Check Firebase Console for service status
2. Review Firebase documentation for your specific error
3. Check Next.js logs in Vercel dashboard
4. Review browser console for detailed error messages

---

**Last Updated**: 2025-10-30
**Firebase Project**: course-creator-academy-866d6

