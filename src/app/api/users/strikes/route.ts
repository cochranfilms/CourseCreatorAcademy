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
    const strikesSnap = await adminDb
      .collection('userStrikes')
      .where('userId', '==', userId)
      .orderBy('issuedAt', 'desc')
      .get();

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

