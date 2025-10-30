# Vercel Environment Variables for Course Creator Academy

## Required Firebase Environment Variables

Add these to your Vercel project settings (Settings → Environment Variables):

### Client-Side Firebase Variables (NEXT_PUBLIC_*)
These are exposed to the browser and are required for Firebase Authentication and Firestore:

1. **NEXT_PUBLIC_FIREBASE_API_KEY**
   - Description: Firebase API Key for client-side authentication
   - How to get: Firebase Console → Project Settings → General → Your apps → Web app config
   - Example: `AIzaSyBxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

2. **NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN**
   - Description: Firebase Authentication domain
   - Value: `course-creator-academy-866d6.firebaseapp.com`
   - (Already set as default in code, but can be overridden)

3. **NEXT_PUBLIC_FIREBASE_PROJECT_ID**
   - Description: Firebase Project ID
   - Value: `course-creator-academy-866d6`
   - (Already set as default in code, but can be overridden)

4. **NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET**
   - Description: Firebase Storage bucket
   - Value: `course-creator-academy-866d6.firebasestorage.app`
   - (Already set as default in code, but can be overridden)

5. **NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID**
   - Description: Firebase Messaging Sender ID
   - Value: `653132189312`
   - (Already set as default in code, but can be overridden)

6. **NEXT_PUBLIC_FIREBASE_APP_ID**
   - Description: Firebase App ID
   - Value: `1:653132189312:web:a01e270f08d991a7932065`
   - (Already set as default in code, but can be overridden)

7. **NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID** (Optional)
   - Description: Firebase Analytics Measurement ID
   - Value: `G-83ZGTPSRYD`
   - (Already set as default in code, but can be overridden)

### Server-Side Firebase Admin Variables
These are used for server-side operations (API routes, webhooks):

8. **FIREBASE_ADMIN_PROJECT_ID**
   - Description: Firebase Admin Project ID
   - Value: `course-creator-academy-866d6`
   - How to get: Firebase Console → Project Settings → Service Accounts → Generate new private key

9. **FIREBASE_ADMIN_CLIENT_EMAIL**
   - Description: Firebase Admin Service Account Email
   - Example: `firebase-adminsdk-xxxxx@course-creator-academy-866d6.iam.gserviceaccount.com`
   - How to get: From the JSON key file downloaded from Firebase Console

10. **FIREBASE_ADMIN_PRIVATE_KEY**
    - Description: Firebase Admin Private Key
    - Format: The entire private key string (including `-----BEGIN PRIVATE KEY-----` and `-----END PRIVATE KEY-----`)
    - How to get: From the JSON key file downloaded from Firebase Console
    - Note: Replace `\n` with actual newlines, or Vercel will handle this automatically

## How to Get Firebase API Key

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: `course-creator-academy-866d6`
3. Click the gear icon → Project Settings
4. Scroll to "Your apps" section
5. Click on your Web app or create one if needed
6. Copy the configuration values

## How to Get Firebase Admin Credentials

1. Go to Firebase Console → Project Settings → Service Accounts
2. Click "Generate new private key"
3. Download the JSON file
4. Extract these values:
   - `project_id` → `FIREBASE_ADMIN_PROJECT_ID`
   - `client_email` → `FIREBASE_ADMIN_CLIENT_EMAIL`
   - `private_key` → `FIREBASE_ADMIN_PRIVATE_KEY`

## Important Notes

- **NEXT_PUBLIC_*** variables are exposed to the browser. Never put secrets in these.
- Firebase Admin credentials should ONLY be in server-side variables (without NEXT_PUBLIC_)
- The defaults in the code will work for testing, but you should set the actual API key for production
- Make sure to enable Email/Password authentication in Firebase Console → Authentication → Sign-in method

## Firebase Console Setup Checklist

- [ ] Enable Email/Password authentication in Firebase Console
- [ ] Copy the API Key from Firebase Console
- [ ] Add all environment variables to Vercel
- [ ] Deploy to Vercel
- [ ] Set up Firestore security rules (see `docs/firestore-rules.txt`)

