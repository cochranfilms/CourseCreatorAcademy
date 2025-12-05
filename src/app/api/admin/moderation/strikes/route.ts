import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import { ensureAdmin } from '@/lib/api/admin';
import { issueStrike, getUserStrikes } from '@/lib/moderation';
import { QueryDocumentSnapshot } from 'firebase-admin/firestore';

// POST /api/admin/moderation/strikes
// Issue a strike to a user
export async function POST(req: NextRequest) {
  try {
    const adminId = await ensureAdmin(req);
    if (!adminId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { userId, reportId, reason, details } = body;

    if (!userId || !reportId || !reason) {
      return NextResponse.json(
        { error: 'userId, reportId, and reason are required' },
        { status: 400 }
      );
    }

    const result = await issueStrike(userId, reportId, reason, adminId, details);

    if (!result.success) {
      return NextResponse.json(
        { error: 'Failed to issue strike. User may already have 3 strikes.' },
        { status: 400 }
      );
    }

    // Update report to mark strike as issued
    if (adminDb) {
      await adminDb.collection('userReports').doc(reportId).update({
        strikeIssued: true,
        status: 'reviewed',
        reviewedAt: new Date(),
        reviewedBy: adminId,
      });
    }

    return NextResponse.json({
      success: true,
      strikeId: result.strikeId,
      strikeCount: result.strikeCount,
      shouldRemove: result.shouldRemove,
    });
  } catch (error: any) {
    console.error('Error issuing strike:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to issue strike' },
      { status: 500 }
    );
  }
}

// GET /api/admin/moderation/strikes
// List all strikes
export async function GET(req: NextRequest) {
  try {
    const adminId = await ensureAdmin(req);
    if (!adminId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!adminDb) {
      return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
    }

    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');

    let strikesQuery: any = adminDb.collection('userStrikes').orderBy('issuedAt', 'desc');

    if (userId) {
      strikesQuery = strikesQuery.where('userId', '==', userId);
    }

    const strikesSnap = await strikesQuery.limit(100).get();

    const strikes = await Promise.all(
      strikesSnap.docs.map(async (doc: QueryDocumentSnapshot) => {
        const data = doc.data();
        
        // Get user info
        let userInfo = null;
        if (data.userId) {
          try {
            const userDoc = await adminDb.collection('users').doc(data.userId).get();
            if (userDoc.exists) {
              const userData = userDoc.data();
              userInfo = {
                id: data.userId,
                displayName: userData?.displayName,
                handle: userData?.handle,
                photoURL: userData?.photoURL,
                strikes: userData?.strikes || 0,
              };
            }
          } catch (err) {
            console.error('Error fetching user info:', err);
          }
        }

        // Get admin info
        let adminInfo = null;
        if (data.issuedBy) {
          try {
            const adminDoc = await adminDb.collection('users').doc(data.issuedBy).get();
            if (adminDoc.exists) {
              const adminData = adminDoc.data();
              adminInfo = {
                id: data.issuedBy,
                displayName: adminData?.displayName,
              };
            }
          } catch (err) {
            console.error('Error fetching admin info:', err);
          }
        }

        return {
          id: doc.id,
          userId: data.userId,
          reportId: data.reportId,
          reason: data.reason,
          details: data.details,
          issuedBy: data.issuedBy,
          issuedAt: data.issuedAt?.toDate ? data.issuedAt.toDate().toISOString() : null,
          strikeNumber: data.strikeNumber,
          userInfo,
          adminInfo,
        };
      })
    );

    return NextResponse.json({ strikes });
  } catch (error: any) {
    console.error('Error fetching strikes:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch strikes' },
      { status: 500 }
    );
  }
}

