import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';

// GET /api/auth/check-membership
// Server-side membership check using admin SDK (bypasses Firestore rules)
export async function GET(req: NextRequest) {
  try {
    // Get auth token from Authorization header
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const idToken = authHeader.replace('Bearer ', '');
    
    if (!adminAuth || !adminDb) {
      return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
    }

    // Verify the Firebase ID token
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    const userId = decodedToken.uid;
    const email = decodedToken.email;

    // Check if user has active membership
    const userDoc = await adminDb.collection('users').doc(userId).get();
    let hasMembership = false;

    if (userDoc.exists()) {
      const userData = userDoc.data();
      hasMembership = Boolean(userData?.membershipActive);
    }

    // If no active membership, check for pending membership to claim
    if (!hasMembership && email) {
      const normalizedEmail = email.toLowerCase().trim();
      const claimsQ = adminDb
        .collection('pendingMemberships')
        .where('email', '==', normalizedEmail)
        .where('claimed', '==', false)
        .limit(1);
      
      const snap = await claimsQ.get();
      if (!snap.empty) {
        // User has pending membership - allow them to sign in to claim it
        hasMembership = true;
      }
    }

    return NextResponse.json({ hasMembership });
  } catch (error: any) {
    console.error('Error checking membership:', error);
    // On error, deny access (secure default)
    return NextResponse.json({ hasMembership: false, error: error.message }, { status: 500 });
  }
}

