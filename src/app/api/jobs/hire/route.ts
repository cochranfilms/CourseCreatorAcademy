import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import { stripe } from '@/lib/stripe';
import { computeApplicationFeeAmount } from '@/lib/fees';
import { FieldValue } from 'firebase-admin/firestore';
import { getUserIdFromAuthHeader } from '@/lib/api/auth';
import { getOrCreateCustomer } from '@/lib/api/stripeCustomer';
import { badRequest, forbidden, notFound, serverError } from '@/lib/api/responses';

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
    
    // Verify the user is the poster of the opportunity
    if (applicationData?.posterId !== userId) return forbidden('You can only hire for your own opportunities');

    // Check if already hired
    if (applicationData?.status === 'hired') {
      return NextResponse.json({ error: 'This applicant has already been hired' }, { status: 400 });
    }

    // Get opportunity to get amount
    const opportunityDoc = await adminDb.collection('opportunities').doc(applicationData?.opportunityId).get();
    if (!opportunityDoc.exists) return notFound('Opportunity not found');

    const opportunityData = opportunityDoc.data();
    const totalAmount = opportunityData?.amount || 0; // in cents

    if (totalAmount <= 0) return badRequest('Opportunity must have a valid amount set');

    // Get poster's Stripe Connect account
    const posterDoc = await adminDb.collection('users').doc(userId).get();
    if (!posterDoc.exists) return notFound('Poster account not found');

    const posterData = posterDoc.data();
    const posterConnectAccountId = posterData?.connectAccountId;

    if (!posterConnectAccountId) return badRequest('You must have a Stripe Connect account set up to hire. Please complete onboarding first.');

    // Verify Connect account is enabled
    try {
      const account = await stripe.accounts.retrieve(posterConnectAccountId);
      if (!account.charges_enabled) return badRequest('Your Stripe Connect account is not fully set up. Please complete onboarding.');
    } catch (error: any) {
      return serverError('Error verifying Stripe account: ' + (error.message || 'Unknown error'));
    }

    // Calculate deposit (25% of total)
    const depositAmount = Math.round(totalAmount * 0.25);
    // Check if poster has a no-fees plan (poster pays the platform fee on deposit)
    const platformFee = await computeApplicationFeeAmount(depositAmount, undefined, userId);
    const depositAfterFee = depositAmount - platformFee;

    // Ensure poster has a Stripe Customer (used in later flows)
    await getOrCreateCustomer(userId, posterData?.email);

    // Get applicant's Connect account (they need one to receive payment)
    const applicantDoc = await adminDb.collection('users').doc(applicationData?.applicantId).get();
    if (!applicantDoc.exists) return notFound('Applicant account not found');

    const applicantData = applicantDoc.data();
    const applicantConnectAccountId = applicantData?.connectAccountId;

    if (!applicantConnectAccountId) return badRequest('Applicant must have a Stripe Connect account set up to receive payment');

    // Update application status to 'hired' and store payment info
    // Payment will be handled via checkout session in separate endpoint
    await adminDb.collection('jobApplications').doc(applicationId).update({
      status: 'hired',
      hiredAt: FieldValue.serverTimestamp(),
      depositAmount,
      totalAmount,
      platformFee,
      applicantConnectAccountId,
      updatedAt: FieldValue.serverTimestamp()
    });

    return NextResponse.json({
      success: true,
      depositAmount,
      totalAmount,
      platformFee
    });
  } catch (error: any) {
    console.error('Error hiring applicant:', error);
    return serverError(error.message || 'Failed to hire applicant');
  }
}

export const runtime = 'nodejs';

