import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import { getUserIdFromAuthHeader } from '@/lib/api/auth';
import { FieldValue } from 'firebase-admin/firestore';

const REPORT_REASONS = ['spam', 'harassment', 'inappropriate_content', 'fake_account', 'other'] as const;
type ReportReason = typeof REPORT_REASONS[number];

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

