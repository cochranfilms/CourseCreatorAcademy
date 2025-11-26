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
      console.warn('[Membership API] Server not configured, returning null to allow access');
      return NextResponse.json({ 
        hasMembership: null, 
        error: 'Server not configured',
        note: 'Could not verify membership status'
      }, { status: 200 });
    }

    // Verify the Firebase ID token
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    const userId = decodedToken.uid;
    const email = decodedToken.email;

    // Check if user has active membership
    const userDoc = await adminDb.collection('users').doc(userId).get();
    let hasMembership = false;

    if (userDoc.exists) {
      const userData = userDoc.data();
      hasMembership = Boolean(userData?.membershipActive);
    }

    // If no active membership, check if user is a legacy creator
    // Legacy creators should be able to login without a membership
    if (!hasMembership) {
      try {
        // Check if user's userId matches an ownerUserId in legacy_creators collection
        const legacyCreatorQuery = adminDb
          .collection('legacy_creators')
          .where('ownerUserId', '==', userId)
          .limit(1);
        
        const legacyCreatorSnap = await legacyCreatorQuery.get();
        if (!legacyCreatorSnap.empty) {
          // User is a legacy creator - allow them to sign in
          hasMembership = true;
        }
      } catch (legacyCheckError) {
        // If legacy check fails, continue to check for pending membership
        console.warn('[Membership API] Error checking legacy creator status:', legacyCheckError);
      }
    }

    // If no active membership and not a legacy creator, check for pending membership to claim
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
    console.error('[Membership API] Error checking membership:', error);
    // On error, return null status to indicate we couldn't verify
    // This allows the client to decide whether to allow access
    // We don't want to block legitimate users due to API errors
    return NextResponse.json({ 
      hasMembership: null, 
      error: error.message,
      note: 'Could not verify membership status'
    }, { status: 200 }); // Return 200 so client can handle gracefully
  }
}

