import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import { getUserIdFromAuthHeader } from '@/lib/api/auth';
import { QueryDocumentSnapshot } from 'firebase-admin/firestore';

// GET /api/users/strikes
// Get strikes for the authenticated user
export async function GET(req: NextRequest) {
  try {
    const userId = await getUserIdFromAuthHeader(req);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!adminDb) {
      return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
    }

    // Get user's strike count
    const userDoc = await adminDb.collection('users').doc(userId).get();
    const strikeCount = userDoc.exists ? (userDoc.data()?.strikes || 0) : 0;

    // If no strikes, return early
    if (strikeCount === 0) {
      return NextResponse.json({ strikes: [], strikeCount: 0 });
    }

    // Get all strikes for this user
    // Try ordered query first, fallback to unordered if index missing
    let strikesSnap;
    try {
      strikesSnap = await adminDb
        .collection('userStrikes')
        .where('userId', '==', userId)
        .orderBy('issuedAt', 'desc')
        .get();
    } catch (error: any) {
      // Fallback if index is missing - fetch all and sort client-side
      // Check for various error formats that indicate missing index
      const errorCode = error?.code || error?.status || '';
      const errorMessage = String(error?.message || error || '');
      const isIndexError = 
        errorCode === 'failed-precondition' || 
        errorCode === 9 || 
        errorCode === '9' ||
        errorMessage.includes('index') ||
        errorMessage.includes('FAILED_PRECONDITION') ||
        errorMessage.includes('requires an index') ||
        errorMessage.includes('9 FAILED_PRECONDITION');
      
      if (isIndexError) {
        console.warn('Missing index for userStrikes query, falling back to client-side sort');
        try {
          const allStrikesSnap = await adminDb
            .collection('userStrikes')
            .where('userId', '==', userId)
            .get();
          
          // Sort client-side by issuedAt descending
          const strikesArray = allStrikesSnap.docs.map((doc: QueryDocumentSnapshot) => ({
            doc,
            data: doc.data(),
          }));
          
          strikesArray.sort((a: { doc: QueryDocumentSnapshot; data: any }, b: { doc: QueryDocumentSnapshot; data: any }) => {
            const aTime = a.data.issuedAt?.toDate ? a.data.issuedAt.toDate().getTime() : 0;
            const bTime = b.data.issuedAt?.toDate ? b.data.issuedAt.toDate().getTime() : 0;
            return bTime - aTime;
          });
          
          strikesSnap = {
            docs: strikesArray.map((item: { doc: QueryDocumentSnapshot; data: any }) => item.doc),
          } as any;
        } catch (fallbackError: any) {
          console.error('Error in fallback query:', fallbackError);
          throw fallbackError;
        }
      } else {
        console.error('Unexpected error fetching strikes:', error);
        throw error;
      }
    }

    const strikes = strikesSnap.docs.map((doc: QueryDocumentSnapshot) => {
      const data = doc.data();
      return {
        id: doc.id,
        reportId: data.reportId,
        reason: data.reason,
        details: data.details || null,
        issuedAt: data.issuedAt?.toDate ? data.issuedAt.toDate().toISOString() : null,
        strikeNumber: data.strikeNumber,
      };
    });

    return NextResponse.json({ strikes, strikeCount });
  } catch (error: any) {
    console.error('Error fetching user strikes:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch strikes' },
      { status: 500 }
    );
  }
}

export const runtime = 'nodejs';

