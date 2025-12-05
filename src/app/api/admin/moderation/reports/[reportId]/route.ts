import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import { ensureAdmin } from '@/lib/api/admin';
import { FieldValue } from 'firebase-admin/firestore';

// GET /api/admin/moderation/reports/[reportId]
// Get single report details
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ reportId: string }> }
) {
  try {
    const adminId = await ensureAdmin(req);
    if (!adminId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!adminDb) {
      return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
    }

    const { reportId } = await params;
    const reportDoc = await adminDb.collection('userReports').doc(reportId).get();
    if (!reportDoc.exists) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 });
    }

    const data = reportDoc.data();
    return NextResponse.json({
      id: reportDoc.id,
      ...data,
      createdAt: data?.createdAt?.toDate ? data.createdAt.toDate().toISOString() : null,
      reviewedAt: data?.reviewedAt?.toDate ? data.reviewedAt.toDate().toISOString() : null,
    });
  } catch (error: any) {
    console.error('Error fetching report:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch report' },
      { status: 500 }
    );
  }
}

// PATCH /api/admin/moderation/reports/[reportId]
// Update report status
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ reportId: string }> }
) {
  try {
    const adminId = await ensureAdmin(req);
    if (!adminId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!adminDb) {
      return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
    }

    const { reportId } = await params;
    const body = await req.json();
    const { status } = body;

    if (!['pending', 'reviewed', 'resolved', 'dismissed'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    const updateData: any = {
      status,
      reviewedAt: FieldValue.serverTimestamp(),
      reviewedBy: adminId,
    };

    await adminDb.collection('userReports').doc(reportId).update(updateData);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error updating report:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update report' },
      { status: 500 }
    );
  }
}

