import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';

async function getUserFromAuthHeader(req: NextRequest): Promise<string | null> {
  const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
  if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) return null;
  const idToken = authHeader.split(' ')[1];
  if (!adminAuth) return null;
  try {
    const decoded = await adminAuth.verifyIdToken(idToken);
    return decoded.uid || null;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!adminDb) {
      return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
    }

    const userId = await getUserFromAuthHeader(req);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { applicationId } = await req.json();
    if (!applicationId) {
      return NextResponse.json({ error: 'Missing applicationId' }, { status: 400 });
    }

    // Get application
    const applicationDoc = await adminDb.collection('jobApplications').doc(applicationId).get();
    if (!applicationDoc.exists) {
      return NextResponse.json({ error: 'Application not found' }, { status: 404 });
    }

    const applicationData = applicationDoc.data();
    
    // Verify the user is the hired applicant
    if (applicationData?.applicantId !== userId) {
      return NextResponse.json({ error: 'Unauthorized - only the hired applicant can mark job as complete' }, { status: 403 });
    }

    // Check if already completed
    if (applicationData?.status === 'completed') {
      return NextResponse.json({ error: 'Job is already marked as complete' }, { status: 400 });
    }

    // Check if hired
    if (applicationData?.status !== 'hired') {
      return NextResponse.json({ error: 'Job must be hired before it can be marked as complete' }, { status: 400 });
    }

    // Verify deposit payment was successful
    // Check for depositPaid flag, depositPaymentIntentId, or depositCheckoutSessionId
    // This handles cases where payment was made via checkout session or direct payment intent
    const hasDepositPayment = applicationData?.depositPaid || 
                               applicationData?.depositPaymentIntentId || 
                               applicationData?.depositCheckoutSessionId;
    
    if (!hasDepositPayment) {
      return NextResponse.json({ 
        error: 'Deposit payment not found. Please ensure the deposit payment has been completed before marking the job as complete.' 
      }, { status: 400 });
    }

    // Update application status to 'completed'
    await adminDb.collection('jobApplications').doc(applicationId).update({
      status: 'completed',
      completedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    });

    return NextResponse.json({
      success: true,
      message: 'Job marked as complete. The poster will be notified to complete final payment.'
    });
  } catch (error: any) {
    console.error('Error marking job as complete:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to mark job as complete' },
      { status: 500 }
    );
  }
}

export const runtime = 'nodejs';

