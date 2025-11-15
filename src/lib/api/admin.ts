import { NextRequest } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebaseAdmin';
import { getUserIdFromAuthHeader } from './auth';

export async function ensureAdmin(req: NextRequest): Promise<string | null> {
  const uid = await getUserIdFromAuthHeader(req);
  if (!uid || !adminDb) return null;
  
  try {
    const snap = await adminDb.collection('users').doc(uid).get();
    const data = snap.exists ? (snap.data() as any) : null;
    const isAdmin = Boolean(data?.roles?.admin || data?.isAdmin);
    return isAdmin ? uid : null;
  } catch {
    return null;
  }
}

