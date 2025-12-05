import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebaseAdmin';
import { getUserIdFromAuthHeader } from '@/lib/api/auth';
import { FieldValue } from 'firebase-admin/firestore';
import { createNotification } from '@/lib/notifications';

const REPORT_REASONS = ['spam', 'harassment', 'inappropriate_content', 'fake_account', 'other'] as const;
type ReportReason = typeof REPORT_REASONS[number];

/**
 * Get admin user ID by email
 */
async function getAdminUserId(): Promise<string | null> {
  if (!adminAuth) return null;
  
  try {
    const userRecord = await adminAuth.getUserByEmail('info@cochranfilms.com');
    return userRecord.uid;
  } catch (error) {
    console.error('Error getting admin user ID:', error);
    return null;
  }
}

// POST /api/users/[id]/report
// Report a user
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const reporterId = await getUserIdFromAuthHeader(req);
    if (!reporterId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: reportedUserId } = await params;
    if (!reportedUserId || reportedUserId === reporterId) {
      return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 });
    }

    const body = await req.json();
    const reason = body.reason as ReportReason;
    const details = body.details as string | undefined;

    if (!reason || !REPORT_REASONS.includes(reason)) {
      return NextResponse.json(
        { error: 'Invalid reason. Must be one of: ' + REPORT_REASONS.join(', ') },
        { status: 400 }
      );
    }

    if (!adminDb) {
      return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
    }

    // Get reporter and reported user info for notification
    let reporterName = 'A user';
    let reportedUserName = 'a user';
    
    try {
      const reporterDoc = await adminDb.collection('users').doc(reporterId).get();
      if (reporterDoc.exists) {
        const reporterData = reporterDoc.data();
        reporterName = reporterData?.displayName || reporterData?.handle || reporterData?.email?.split('@')[0] || 'A user';
      }
      
      const reportedDoc = await adminDb.collection('users').doc(reportedUserId).get();
      if (reportedDoc.exists) {
        const reportedData = reportedDoc.data();
        reportedUserName = reportedData?.displayName || reportedData?.handle || reportedData?.email?.split('@')[0] || 'a user';
      }
    } catch (err) {
      console.error('Error fetching user info for notification:', err);
    }

    // Create report
    const reportRef = await adminDb.collection('userReports').add({
      reporterId,
      reportedUserId,
      reason,
      details: details || null,
      status: 'pending',
      createdAt: FieldValue.serverTimestamp(),
      strikeIssued: false,
    });

    // Notify admin about the report
    try {
      const adminUserId = await getAdminUserId();
      if (adminUserId) {
        const reasonDisplay = reason.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
        await createNotification(adminUserId, {
          type: 'user_reported',
          title: 'New User Report',
          message: `${reporterName} reported ${reportedUserName} for ${reasonDisplay}${details ? `: ${details.substring(0, 100)}${details.length > 100 ? '...' : ''}` : ''}`,
          actionUrl: `/admin/moderation`,
          actionLabel: 'Review Report',
          metadata: {
            reportId: reportRef.id,
            reporterId,
            reportedUserId,
            reason,
          },
        });
      }
    } catch (notifError) {
      // Don't fail the request if notification fails
      console.error('Error creating admin notification:', notifError);
    }

    return NextResponse.json({ 
      success: true,
      reportId: reportRef.id 
    });
  } catch (error: any) {
    console.error('Error reporting user:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to report user' },
      { status: 500 }
    );
  }
}

