import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';
import { getUserIdFromAuthHeader } from '@/lib/api/auth';
import { badRequest, forbidden, notFound, serverError } from '@/lib/api/responses';
import { createJobNotification } from '@/lib/notifications';

export async function POST(req: NextRequest) {
  try {
    if (!adminDb) return serverError('Server not configured');

    const userId = await getUserIdFromAuthHeader(req);
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { applicationId } = await req.json();
    if (!applicationId) return badRequest('Missing applicationId');

    // Get application
    const applicationDoc = await adminDb.collection('jobApplications').doc(applicationId).get();
    if (!applicationDoc.exists) return notFound('Application not found');

    const applicationData = applicationDoc.data();
    
    // Verify the user is the hired applicant
    if (applicationData?.applicantId !== userId) return forbidden('Only the hired applicant can mark job as complete');

    // Check if already completed
    if (applicationData?.status === 'completed') return badRequest('Job is already marked as complete');

    // Check if hired
    if (applicationData?.status !== 'hired') return badRequest('Job must be hired before it can be marked as complete');

    // Verify deposit payment was successful
    // Check for depositPaid flag, depositPaymentIntentId, or depositCheckoutSessionId
    // This handles cases where payment was made via checkout session or direct payment intent
    const hasDepositPayment = applicationData?.depositPaid || 
                               applicationData?.depositPaymentIntentId || 
                               applicationData?.depositCheckoutSessionId;
    
    if (!hasDepositPayment) return badRequest('Deposit payment not found. Please ensure the deposit payment has been completed before marking the job as complete.');

    // Update application status to 'completed'
    await adminDb.collection('jobApplications').doc(applicationId).update({
      status: 'completed',
      completedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    });

    // Create notification for employer (job completed)
    try {
      await createJobNotification(String(applicationData?.posterId), 'job_completed', {
        jobTitle: applicationData?.opportunityTitle || 'Job Opportunity',
        companyName: applicationData?.opportunityCompany || '',
        applicationId,
      });
    } catch (notifErr) {
      console.error('Error creating job completed notification:', notifErr);
      // Don't fail the request if notification fails
    }

    return NextResponse.json({ success: true, message: 'Job marked as complete. The poster will be notified to complete final payment.' });
  } catch (error: any) {
    console.error('Error marking job as complete:', error);
    return serverError(error.message || 'Failed to mark job as complete');
  }
}

export const runtime = 'nodejs';

