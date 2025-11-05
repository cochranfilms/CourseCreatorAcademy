import { getApps, initializeApp } from 'firebase/app';
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// Storage bucket: accept either the legacy appspot.com or the new
// firebasestorage.app bucket names as-is. Do not force-convert between them.
// Provide a sane default that matches the bucket shown in Cloud Console.
const rawStorageBucket =
  process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ||
  "course-creator-academy-866d6.appspot.com";

const normalizedStorageBucket = rawStorageBucket
  .replace(/^https?:\/\/[^/]+\//i, '') // strip accidental protocol/host if provided
  .trim();

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "course-creator-academy-866d6.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "course-creator-academy-866d6",
  storageBucket: normalizedStorageBucket,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "653132189312",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:653132189312:web:a01e270f08d991a7932065",
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || "G-83ZGTPSRYD"
};

const requiredKeys = [
  firebaseConfig.apiKey,
  firebaseConfig.authDomain,
  firebaseConfig.projectId,
  firebaseConfig.storageBucket,
  firebaseConfig.appId
];

export const firebaseReady = requiredKeys.every(Boolean);

let app: ReturnType<typeof initializeApp> | undefined;
if (firebaseReady) {
  app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig as any);
}

export const auth = firebaseReady && app ? getAuth(app) : (null as any);
export const db = firebaseReady && app ? getFirestore(app) : (null as any);
export const storage = firebaseReady && app ? getStorage(app) : (null as any);

// Initialize App Check in the browser when configured. This prevents
// Storage uploads from failing with CORS-like 401 preflight errors when
// App Check enforcement is enabled in Firebase Console.
if (typeof window !== 'undefined' && firebaseReady && app) {
  try {
    const debugToken = process.env.NEXT_PUBLIC_APP_CHECK_DEBUG_TOKEN;
    if (debugToken) {
      // true => auto-generate; or an explicit token string
      (self as any).FIREBASE_APPCHECK_DEBUG_TOKEN =
        debugToken === 'true' ? true : debugToken;
    }

    // Accept both public and non-public env names for convenience in dev
    const siteKey =
      process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY ||
      process.env.RECAPTCHA_SITE_KEY ||
      '';

    // Initialize only if we have a site key or debug token; otherwise skip
    if (siteKey || debugToken) {
      initializeAppCheck(app as any, {
        provider: new ReCaptchaV3Provider(siteKey || 'dev-placeholder'),
        isTokenAutoRefreshEnabled: true,
      });
    }
  } catch (err) {
    // Swallow initialization errors in development to avoid SSR crashes
    // and continue without App Check if misconfigured locally.
    console.warn('App Check init skipped:', (err as any)?.message || err);
  }
}
