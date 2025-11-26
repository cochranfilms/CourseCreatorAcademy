# Fix Google OAuth Popup Not Loading

## Problem
Google sign-in popup redirects to `course-creator-academy-866d6.firebaseapp.com` but the app is hosted on `coursecreatoracademy.vercel.app`, causing the popup to fail.

## Solution: Add Vercel Domain to Firebase Authorized Domains

### Step 1: Add Authorized Domain in Firebase Console

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: **course-creator-academy-866d6**
3. Navigate to **Authentication** → **Settings** → **Authorized domains**
4. Click **Add domain**
5. Add these domains:
   - `coursecreatoracademy.vercel.app`
   - `www.coursecreatoracademy.vercel.app` (if you use www)
   - Your custom domain if you have one (e.g., `coursecreatoracademy.com`)
6. Click **Add**

### Step 2: Verify Google OAuth Configuration

1. In Firebase Console, go to **Authentication** → **Sign-in method**
2. Click on **Google**
3. Ensure Google sign-in is **Enabled**
4. Verify the **OAuth redirect URI** shows:
   ```
   https://course-creator-academy-866d6.firebaseapp.com/__/auth/handler
   ```
   This is correct - Firebase handles the redirect internally.

### Step 3: Verify Google Cloud Console OAuth Settings

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select project: **course-creator-academy-866d6**
3. Navigate to **APIs & Services** → **Credentials**
4. Find your **OAuth 2.0 Client ID** (the one used by Firebase)
5. Click to edit it
6. Under **Authorized JavaScript origins**, ensure you have:
   - `https://coursecreatoracademy.vercel.app`
   - `https://www.coursecreatoracademy.vercel.app` (if using www)
   - `https://course-creator-academy-866d6.firebaseapp.com` (Firebase default)
   - Your custom domain if applicable
7. Under **Authorized redirect URIs**, ensure you have:
   - `https://course-creator-academy-866d6.firebaseapp.com/__/auth/handler`
   - (This is the Firebase handler - don't add your Vercel domain here)
8. Click **Save**

### Step 4: Test the Fix

1. Clear your browser cache and cookies
2. Visit `https://coursecreatoracademy.vercel.app/login`
3. Click **Sign in with Google**
4. The popup should now load correctly

## Why This Happens

Firebase Auth uses the `authDomain` from your config (`course-creator-academy-866d6.firebaseapp.com`) for OAuth redirects. However, Firebase needs to know that requests from your Vercel domain are authorized. Adding the Vercel domain to the authorized domains list tells Firebase to accept authentication requests from that domain.

## Troubleshooting

### If popup still doesn't load:

1. **Check browser console** for specific errors
2. **Disable browser extensions** temporarily (ad blockers, password managers can interfere)
3. **Try incognito/private mode** to rule out extension issues
4. **Check Firebase Console** → Authentication → Settings → Authorized domains to verify your domain is listed
5. **Verify environment variables** in Vercel are set correctly:
   - `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` should be `course-creator-academy-866d6.firebaseapp.com`
   - Don't change this - it's the Firebase auth domain, not your hosting domain

### Common Errors:

- **"Popup blocked"**: Browser is blocking popups - allow popups for your site
- **"Redirect URI mismatch"**: Check Google Cloud Console authorized redirect URIs
- **"Unauthorized domain"**: Domain not added to Firebase authorized domains

## Alternative: Use Redirect Instead of Popup

If popups continue to cause issues, you can switch to redirect-based OAuth (full page redirect instead of popup). This requires code changes - contact support if needed.

