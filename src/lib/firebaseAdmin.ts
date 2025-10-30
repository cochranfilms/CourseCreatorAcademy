import { getApps, initializeApp, cert, App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

let adminApp: App | null = null;
let adminAuth: any = null;
let adminDb: any = null;

if (!getApps().length) {
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (projectId && clientEmail && privateKey) {
    try {
      // Validate private key format
      if (!privateKey.includes('BEGIN PRIVATE KEY')) {
        console.error('Firebase Admin private key is missing BEGIN marker');
      } else if (!privateKey.includes('END PRIVATE KEY')) {
        console.error('Firebase Admin private key is missing END marker');
      } else {
        adminApp = initializeApp({
          credential: cert({
            projectId,
            clientEmail,
            privateKey
          })
        });
        adminAuth = getAuth(adminApp);
        adminDb = getFirestore(adminApp);
      }
    } catch (error: any) {
      console.error('Failed to initialize Firebase Admin:', error);
      console.error('Error code:', error.code);
      console.error('Error message:', error.message);
      if (error.message?.includes('UNAUTHENTICATED')) {
        console.error('This usually means the private key format is incorrect in Vercel.');
        console.error('Make sure FIREBASE_ADMIN_PRIVATE_KEY includes the entire key with BEGIN/END markers.');
      }
    }
  } else {
    console.warn('Firebase Admin credentials not found. Some features may not work.');
    console.warn('Missing:', {
      projectId: !projectId,
      clientEmail: !clientEmail,
      privateKey: !privateKey
    });
  }
} else {
  adminApp = getApps()[0] as App;
  adminAuth = getAuth(adminApp);
  adminDb = getFirestore(adminApp);
}

export { adminAuth, adminDb };


