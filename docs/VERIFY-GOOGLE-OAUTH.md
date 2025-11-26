# Verify Google OAuth Configuration - Step by Step

## Quick Checklist

- [ ] Domain added to Firebase Authorized Domains ✅ (You've done this)
- [ ] Domain added to Google Cloud Console Authorized JavaScript Origins ⚠️ (Check this!)
- [ ] Correct OAuth Client ID is being used
- [ ] Changes have propagated (wait 2-3 minutes)

## Detailed Verification Steps

### Step 1: Find Your Firebase OAuth Client ID

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select project: **course-creator-academy-866d6**
3. Go to **Authentication** → **Sign-in method**
4. Click on **Google**
5. Look for **Web client ID** - copy this ID (it starts with something like `123456789-abcdefg...`)

### Step 2: Verify Google Cloud Console Configuration

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select project: **course-creator-academy-866d6**
3. Navigate to **APIs & Services** → **Credentials**
4. Find the OAuth 2.0 Client ID that matches the one from Step 1
5. Click **Edit** (pencil icon)

### Step 3: Check Authorized JavaScript Origins

**⚠️ THIS IS THE CRITICAL STEP**

Under **Authorized JavaScript origins**, you should see:
- `https://course-creator-academy-866d6.firebaseapp.com` (Firebase default)
- `https://coursecreatoracademy.vercel.app` ⚠️ **MUST BE HERE**

**If `https://coursecreatoracademy.vercel.app` is NOT in the list:**

1. Click **+ ADD URI**
2. Enter: `https://coursecreatoracademy.vercel.app`
3. Click **Save**
4. **Wait 2-3 minutes** for changes to propagate

### Step 4: Verify Authorized Redirect URIs

Under **Authorized redirect URIs**, you should see:
- `https://course-creator-academy-866d6.firebaseapp.com/__/auth/handler`

**DO NOT add your Vercel domain here** - only Firebase's handler URL should be in redirect URIs.

### Step 5: Test After Changes

1. **Wait 2-3 minutes** after saving changes
2. **Clear browser cache** (Ctrl+Shift+Delete or Cmd+Shift+Delete)
3. **Close all browser tabs** with your site
4. Open a **new incognito/private window**
5. Visit `https://coursecreatoracademy.vercel.app/login`
6. Click **Sign in with Google**

## Common Mistakes

❌ **Adding Vercel domain to "Authorized redirect URIs"** - Wrong! Only add to "Authorized JavaScript origins"
❌ **Adding domain without `https://`** - Must include protocol
❌ **Adding domain with trailing slash** - Should be `https://coursecreatoracademy.vercel.app` not `https://coursecreatoracademy.vercel.app/`
❌ **Not waiting for propagation** - Changes can take 2-3 minutes to take effect

## Still Not Working?

If you've verified all steps and it's still not working:

1. **Check browser console** for any additional errors
2. **Try a different browser** (Chrome, Firefox, Safari)
3. **Disable browser extensions** (ad blockers, password managers)
4. **Check if popup blocker is enabled** - temporarily disable it
5. **Verify the OAuth Client ID** matches between Firebase and Google Cloud Console

## Alternative: Use Email/Password Sign-In

If Google OAuth continues to have issues, users can always use email/password sign-in as an alternative.

