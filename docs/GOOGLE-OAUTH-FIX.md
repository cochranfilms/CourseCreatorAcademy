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

### Step 3: ⚠️ CRITICAL - Add Vercel Domain to Google Cloud Console OAuth Settings

**This is the most common cause of "popup-closed-by-user" errors!**

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select project: **course-creator-academy-866d6**
3. Navigate to **APIs & Services** → **Credentials**
4. Find your **OAuth 2.0 Client ID** (look for one with name like "Web client" or "Firebase")
   - If you see multiple, check which one Firebase is using in Firebase Console → Authentication → Sign-in method → Google
5. Click to **edit** the OAuth client
6. Under **Authorized JavaScript origins**, click **+ ADD URI** and add:
   - `https://coursecreatoracademy.vercel.app` ⚠️ **MUST ADD THIS**
   - `https://www.coursecreatoracademy.vercel.app` (if using www)
   - `https://course-creator-academy-866d6.firebaseapp.com` (should already be there)
   - Your custom domain if applicable
7. Under **Authorized redirect URIs**, ensure you have:
   - `https://course-creator-academy-866d6.firebaseapp.com/__/auth/handler`
   - (This is the Firebase handler - don't add your Vercel domain here)
8. Click **Save**
9. **Wait 1-2 minutes** for changes to propagate

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

- **"auth/popup-closed-by-user"**: ⚠️ **Most common cause**: Vercel domain not added to Google Cloud Console "Authorized JavaScript origins". See Step 3 above.
- **"Popup blocked"**: Browser is blocking popups - allow popups for your site
- **"Redirect URI mismatch"**: Check Google Cloud Console authorized redirect URIs
- **"Unauthorized domain"**: Domain not added to Firebase authorized domains

### ⚠️ If you're still getting "popup-closed-by-user" error:

1. **Double-check Google Cloud Console** - Go to APIs & Services → Credentials → Edit your OAuth client
2. **Verify** `https://coursecreatoracademy.vercel.app` is in "Authorized JavaScript origins" (NOT redirect URIs)
3. **Save and wait 2-3 minutes** for changes to propagate
4. **Clear browser cache** and try again
5. **Check browser console** for any additional error messages

## Alternative: Use Redirect Instead of Popup

If popups continue to cause issues, you can switch to redirect-based OAuth (full page redirect instead of popup). This requires code changes - contact support if needed.

