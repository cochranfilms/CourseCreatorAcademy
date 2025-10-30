import { getApps, initializeApp, cert, App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

let adminApp: App | null = null;
let adminAuth: any = null;
let adminDb: any = null;

if (!getApps().length) {
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  // Handle both escaped and actual newlines
  let privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY;
  if (privateKey) {
    // Replace escaped newlines with actual newlines
    privateKey = privateKey.replace(/\\n/g, '\n');
    // Also handle literal \n strings
    privateKey = privateKey.replace(/\\\\n/g, '\n');
    // Trim any extra whitespace
    privateKey = privateKey.trim();
  }

  if (projectId && clientEmail && privateKey) {
    try {
      // Validate private key format
      if (!privateKey.includes('BEGIN PRIVATE KEY')) {
        console.error('Firebase Admin private key is missing BEGIN marker');
      } else if (!privateKey.includes('END PRIVATE KEY')) {
        console.error('Firebase Admin private key is missing END marker');
      } else {
        // Clean up the private key - ensure proper format
        const cleanedPrivateKey = privateKey.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
        
        adminApp = initializeApp({
          credential: cert({
            projectId,
            clientEmail,
            privateKey: cleanedPrivateKey
          }),
          // Explicitly set project ID to avoid potential issues
          projectId: projectId
        });
        adminAuth = getAuth(adminApp);
        adminDb = getFirestore(adminApp);
        
        // Test the connection immediately
        adminDb.settings({ ignoreUndefinedProperties: true });
        
        console.log('Firebase Admin initialized successfully');
      }
    } catch (error: any) {
      console.error('Failed to initialize Firebase Admin:', error);
      console.error('Error code:', error.code);
      console.error('Error message:', error.message);
      console.error('Project ID:', projectId);
      console.error('Client Email:', clientEmail);
      console.error('Private Key length:', privateKey?.length);
      console.error('Private Key first 50 chars:', privateKey?.substring(0, 50));
      if (error.message?.includes('UNAUTHENTICATED')) {
        console.error('UNAUTHENTICATED error - Possible causes:');
        console.error('1. Private key format is incorrect');
        console.error('2. Service account email mismatch');
        console.error('3. Private key has extra characters or whitespace');
        console.error('4. Service account was deleted or regenerated');
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


