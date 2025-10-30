import { getApps, initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "course-creator-academy-866d6.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "course-creator-academy-866d6",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "course-creator-academy-866d6.firebasestorage.app",
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


