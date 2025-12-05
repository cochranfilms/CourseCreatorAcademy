import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import { ensureAdmin } from '@/lib/api/admin';
import { QueryDocumentSnapshot } from 'firebase-admin/firestore';

// GET /api/admin/moderation/reports
// List all reports with filters
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
    const status = searchParams.get('status');
    const userId = searchParams.get('userId');

    let reportsQuery: any = adminDb.collection('userReports').orderBy('createdAt', 'desc');

    if (status) {
      reportsQuery = reportsQuery.where('status', '==', status);
    }
    if (userId) {
      reportsQuery = reportsQuery.where('reportedUserId', '==', userId);
    }

    const reportsSnap = await reportsQuery.limit(100).get();
    
    const reports = await Promise.all(
      reportsSnap.docs.map(async (doc: QueryDocumentSnapshot) => {
        const data = doc.data();
        
        // Get reporter info
        let reporterInfo = null;
        if (data.reporterId) {
          try {
            const reporterDoc = await adminDb.collection('users').doc(data.reporterId).get();
            if (reporterDoc.exists) {
              const reporterData = reporterDoc.data();
              reporterInfo = {
                id: data.reporterId,
                displayName: reporterData?.displayName,
                handle: reporterData?.handle,
                photoURL: reporterData?.photoURL,
              };
            }
          } catch (err) {
            console.error('Error fetching reporter info:', err);
          }
        }

        // Get reported user info and strike count
        let reportedUserInfo = null;
        let strikeCount = 0;
        if (data.reportedUserId) {
          try {
            const reportedDoc = await adminDb.collection('users').doc(data.reportedUserId).get();
            if (reportedDoc.exists) {
              const reportedData = reportedDoc.data();
              reportedUserInfo = {
                id: data.reportedUserId,
                displayName: reportedData?.displayName,
                handle: reportedData?.handle,
                photoURL: reportedData?.photoURL,
              };
              strikeCount = reportedData?.strikes || 0;
            }
          } catch (err) {
            console.error('Error fetching reported user info:', err);
          }
        }

        return {
          id: doc.id,
          reporterId: data.reporterId,
          reportedUserId: data.reportedUserId,
          reason: data.reason,
          details: data.details,
          attachments: data.attachments || null,
          status: data.status,
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : null,
          reviewedAt: data.reviewedAt?.toDate ? data.reviewedAt.toDate().toISOString() : null,
          reviewedBy: data.reviewedBy,
          strikeIssued: data.strikeIssued || false,
          reporterInfo,
          reportedUserInfo,
          strikeCount,
        };
      })
    );

    return NextResponse.json({ reports });
  } catch (error: any) {
    console.error('Error fetching reports:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch reports' },
      { status: 500 }
    );
  }
}

