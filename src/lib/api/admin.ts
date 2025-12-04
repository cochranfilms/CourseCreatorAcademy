import { NextRequest } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebaseAdmin';
import { getUserIdFromAuthHeader } from './auth';

export async function ensureAdmin(req: NextRequest): Promise<string | null> {
  const uid = await getUserIdFromAuthHeader(req);
  if (!uid || !adminDb) return null;
  
  try {
    // Check user document for admin role
    const snap = await adminDb.collection('users').doc(uid).get();
    const data = snap.exists ? (snap.data() as any) : null;
    const isAdmin = Boolean(data?.roles?.admin || data?.isAdmin);
    
    // Also check if email is info@cochranfilms.com
    let isAdminEmail = false;
    if (adminAuth) {
      try {
        const userRecord = await adminAuth.getUser(uid);
        isAdminEmail = userRecord.email === 'info@cochranfilms.com';
      } catch {
        // If we can't get user record, continue without email check
      }
    }
    
    return (isAdmin || isAdminEmail) ? uid : null;
  } catch {
    return null;
  }
}

