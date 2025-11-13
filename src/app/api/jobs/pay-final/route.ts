import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import { stripe } from '@/lib/stripe';
import { FieldValue } from 'firebase-admin/firestore';
import { getUserIdFromAuthHeader } from '@/lib/api/auth';
import { getOrCreateCustomer } from '@/lib/api/stripeCustomer';
import { jsonError, jsonOk } from '@/lib/api/responses';

export async function POST(req: NextRequest) {
  try {
    if (!adminDb) return jsonError('Server not configured', 500);

    const userId = await getUserIdFromAuthHeader(req);
    if (!userId) return jsonError('Unauthorized', 401);

    const { applicationId } = await req.json();
    if (!applicationId) return jsonError('Missing applicationId', 400);

    // Get application
    const applicationDoc = await adminDb.collection('jobApplications').doc(applicationId).get();
    if (!applicationDoc.exists) return jsonError('Application not found', 404);

    const applicationData = applicationDoc.data();
    
    // Verify the user is the poster
    if (applicationData?.posterId !== userId) return jsonError('Unauthorized - only the poster can complete final payment', 403);

    // Check if job is completed
    if (applicationData?.status !== 'completed') return jsonError('Job must be marked as complete before final payment', 400);

    // Check if already paid
    if (applicationData?.finalPaymentIntentId) return jsonError('Final payment has already been processed', 400);

    const totalAmount = applicationData?.totalAmount || 0;
    const depositAmount = applicationData?.depositAmount || 0;
    const remainingAmount = totalAmount - depositAmount; // 75% of total

    if (remainingAmount <= 0) return jsonError('Invalid payment amount', 400);

    // Get poster's customer ID
    const posterDoc = await adminDb.collection('users').doc(userId).get();
    if (!posterDoc.exists) return jsonError('Poster account not found', 404);

    const posterData = posterDoc.data();
    const customerId = await getOrCreateCustomer(userId, posterData?.email);

    const applicantConnectAccountId = applicationData?.applicantConnectAccountId;
    if (!applicantConnectAccountId) {
      return NextResponse.json({ error: 'Applicant Connect account not found' }, { status: 400 });
    }

    // No platform fee on the remaining amount (fee only on deposit)
    const platformFeeOnRemaining = 0;
    const totalPlatformFee = (applicationData?.platformFee || 0);
    
    // Amount to transfer to applicant is the full remaining amount
    const transferAmount = remainingAmount;

    // Update application with final payment info
    // Payment will be handled via checkout session in separate endpoint
    await adminDb.collection('jobApplications').doc(applicationId).update({
      remainingAmount,
      platformFeeOnRemaining,
      totalPlatformFee,
      transferAmount,
      updatedAt: FieldValue.serverTimestamp()
    });

    return jsonOk({ success: true, remainingAmount, platformFeeOnRemaining });
  } catch (error: any) {
    console.error('Error creating final payment:', error);
    return jsonError(error.message || 'Failed to create final payment', 500);
  }
}

export const runtime = 'nodejs';

