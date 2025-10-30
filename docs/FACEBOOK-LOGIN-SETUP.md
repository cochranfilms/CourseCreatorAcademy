# Facebook Login Setup Guide

This guide will walk you through setting up Facebook authentication for your Course Creator Academy application.

## Prerequisites

- A Facebook Developer account
- Access to your Firebase Console
- Your Firebase project: `course-creator-academy-866d6`

## Step-by-Step Instructions

### Step 1: Create a Facebook App

1. Go to [Facebook Developers](https://developers.facebook.com/)
2. Click **"My Apps"** in the top right corner
3. Click **"Create App"**
4. Choose **"Consumer"** as the app type
5. Fill in:
   - **App Name**: Course Creator Academy (or your preferred name)
   - **App Contact Email**: Your email address
6. Click **"Create App"**

### Step 2: Add Facebook Login Product

1. In your Facebook App dashboard, find **"Add Product"** or go to **"Products"** in the left sidebar
2. Find **"Facebook Login"** and click **"Set Up"**
3. Choose **"Web"** as the platform
4. Click **"Continue"**

### Step 3: Configure Facebook Login Settings

1. In the left sidebar, go to **"Facebook Login"** → **"Settings"**
2. Under **"Valid OAuth Redirect URIs"**, add:
   ```
   https://course-creator-academy-866d6.firebaseapp.com/_/auth/handler
   ```
   **Important**: This is the exact URI you'll see in Firebase Console. Copy it exactly.

3. Under **"Deauthorize Callback URL"**, add:
   ```
   https://course-creator-academy-866d6.firebaseapp.com/_/auth/handler
   ```

4. Under **"Data Deletion Instructions URL"** (optional), you can add:
   ```
   https://yourdomain.com/privacy
   ```

5. Click **"Save Changes"**

### Step 4: Get Your App ID and App Secret

1. In your Facebook App dashboard, go to **"Settings"** → **"Basic"**
2. Copy your **App ID** (you'll need this for Firebase)
3. Copy your **App Secret** (click **"Show"** next to App Secret to reveal it)
   - **Important**: Keep this secret safe! Never commit it to version control.

### Step 5: Configure Firebase Authentication

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: **course-creator-academy-866d6**
3. Navigate to **Authentication** → **Sign-in method**
4. Find **"Facebook"** in the list and click on it
5. Toggle **"Enable"** to turn on Facebook authentication
6. Enter your **App ID** from Step 4
7. Enter your **App Secret** from Step 4
8. Copy the **OAuth redirect URI** shown:
   ```
   https://course-creator-academy-866d6.firebaseapp.com/_/auth/handler
   ```
9. Click **"Save"**

### Step 6: Add OAuth Redirect URI to Facebook App

1. Go back to your Facebook App dashboard
2. Navigate to **"Facebook Login"** → **"Settings"**
3. Verify that the OAuth redirect URI from Firebase is added:
   ```
   https://course-creator-academy-866d6.firebaseapp.com/_/auth/handler
   ```
4. If it's not there, add it and click **"Save Changes"**

### Step 7: Configure App Domains (Optional but Recommended)

1. In Facebook App dashboard, go to **"Settings"** → **"Basic"**
2. Scroll down to **"App Domains"**
3. Add your domain(s):
   - `course-creator-academy-866d6.firebaseapp.com`
   - Your production domain (if you have one, e.g., `yourdomain.com`)
4. Click **"Save Changes"**

### Step 8: Set App Privacy Policy URL (Required for Production)

1. In Facebook App dashboard, go to **"Settings"** → **"Basic"**
2. Scroll down to **"Privacy Policy URL"**
3. Add your privacy policy URL:
   ```
   https://yourdomain.com/privacy
   ```
   **Note**: If you don't have a privacy policy yet, you can use a placeholder, but Facebook requires this for production apps.

4. Click **"Save Changes"**

### Step 9: Test Facebook Login

1. Make sure your app is deployed or running locally
2. Go to your login page (`/login`)
3. Click **"Sign in with Facebook"**
4. You should see a Facebook login popup
5. After logging in with Facebook, you should be redirected back to your app

### Step 10: Submit App for Review (Required for Production)

If you want to make your app public, you'll need to submit it for Facebook review:

1. In Facebook App dashboard, go to **"App Review"**
2. Click **"Permissions and Features"**
3. Request the `email` permission (if you need user email)
4. Fill out the required information
5. Submit for review

**Note**: For development/testing, you can add test users without going through review:
- Go to **"Roles"** → **"Test Users"**
- Click **"Add"** to create test users
- You can log in with these test users during development

## Troubleshooting

### Common Issues:

1. **"Invalid OAuth Redirect URI"**
   - Make sure the URI in Firebase exactly matches the one in Facebook App settings
   - Check for trailing slashes or extra characters

2. **"App Not Setup"**
   - Verify Facebook Login product is added to your Facebook App
   - Check that you've completed all required fields in Facebook App settings

3. **"App Secret Mismatch"**
   - Double-check that you copied the App Secret correctly from Facebook
   - Make sure there are no extra spaces or characters

4. **"Development Mode"**
   - If you see errors about the app being in development mode, you need to either:
     - Add test users to your Facebook App
     - Submit your app for review to make it public

### Testing Checklist:

- [ ] Facebook App created
- [ ] Facebook Login product added
- [ ] OAuth Redirect URI added to Facebook App
- [ ] Firebase Facebook authentication enabled
- [ ] App ID and App Secret entered in Firebase
- [ ] OAuth Redirect URI matches between Facebook and Firebase
- [ ] Test login works on your site

## Security Notes

- **Never commit your App Secret to version control**
- Keep your App Secret secure and rotate it periodically
- Use environment variables for sensitive data
- Regularly review your Facebook App permissions
- Monitor your Facebook App usage in the Facebook Developer dashboard

## Additional Resources

- [Facebook Login Documentation](https://developers.facebook.com/docs/facebook-login/)
- [Firebase Facebook Authentication](https://firebase.google.com/docs/auth/web/facebook-login)
- [Facebook App Review Guidelines](https://developers.facebook.com/docs/app-review)

## Support

If you encounter issues:
1. Check the browser console for error messages
2. Check Firebase Console → Authentication → Sign-in method for configuration errors
3. Check Facebook App dashboard → Settings for app configuration issues
4. Review Firebase and Facebook documentation

---

**Last Updated**: 2025
**Firebase Project**: course-creator-academy-866d6

