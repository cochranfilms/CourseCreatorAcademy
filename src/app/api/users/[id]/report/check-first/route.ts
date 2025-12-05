import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import { getUserIdFromAuthHeader } from '@/lib/api/auth';

// GET /api/users/[id]/report/check-first
// Check if this is the first report from the current user to the reported user
export async function GET(
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

    if (!adminDb) {
      return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
    }

    // Check if any reports exist from this reporter to this reported user
    const existingReportsSnap = await adminDb
      .collection('userReports')
      .where('reporterId', '==', reporterId)
      .where('reportedUserId', '==', reportedUserId)
      .limit(1)
      .get();

    const isFirstReport = existingReportsSnap.empty;

    return NextResponse.json({ isFirstReport });
  } catch (error: any) {
    console.error('Error checking first report:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to check report status' },
      { status: 500 }
    );
  }
}

export const runtime = 'nodejs';

