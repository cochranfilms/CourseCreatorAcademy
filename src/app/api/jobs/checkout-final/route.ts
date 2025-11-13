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

    // Get application to verify ownership and get payment details
    const applicationDoc = await adminDb.collection('jobApplications').doc(applicationId).get();
    if (!applicationDoc.exists) return jsonError('Application not found', 404);

    const applicationData = applicationDoc.data();
    if (applicationData?.posterId !== userId) return jsonError('Unauthorized', 403);

    if (applicationData?.status !== 'completed') return jsonError('Job must be completed before final payment', 400);

    if (applicationData?.finalPaymentPaid) return jsonError('Final payment already paid', 400);

    // Calculate remaining amount if not already set
    // remainingAmount = totalAmount - depositAmount (75% of total)
    const totalAmount = applicationData?.totalAmount || 0;
    const depositAmount = applicationData?.depositAmount || 0;
    let remainingAmount = applicationData?.remainingAmount;
    
    // If remainingAmount is not set or is 0, calculate it
    if (!remainingAmount || remainingAmount === 0) {
      remainingAmount = totalAmount - depositAmount;
    }
    
    if (remainingAmount <= 0) {
      return jsonError(
        `Invalid payment amount. Total: $${(totalAmount / 100).toFixed(2)}, Deposit: $${(depositAmount / 100).toFixed(2)}, Remaining: $${(remainingAmount / 100).toFixed(2)}`,
        400
      );
    }
    
    // No platform fee on the remaining amount (only charge on deposit)
    const platformFeeOnRemaining = 0;
    const existingPlatformFee = applicationData?.platformFee || 0;
    const totalPlatformFee = existingPlatformFee; // unchanged
    
    // Amount to transfer to applicant is the full remaining amount
    const transferAmount = remainingAmount;
    
    // Update application with calculated amounts if not already set
    if (!applicationData?.remainingAmount || applicationData?.remainingAmount === 0) {
      await adminDb.collection('jobApplications').doc(applicationId).update({
        remainingAmount,
        platformFeeOnRemaining,
        totalPlatformFee,
        transferAmount,
        updatedAt: FieldValue.serverTimestamp()
      });
    }
    
    const opportunityTitle = applicationData?.opportunityTitle || 'Job Opportunity';

    // Get or create customer
    const posterDoc = await adminDb.collection('users').doc(userId).get();
    const posterData = posterDoc.data();
    const customerId = await getOrCreateCustomer(userId, posterData?.email);

    const origin = req.headers.get('origin') || process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

    // Create checkout session for final payment
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer: customerId,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'usd',
            unit_amount: remainingAmount,
            product_data: {
              name: `Final Payment (75%) - ${opportunityTitle}`,
              description: 'Job final payment'
            }
          }
        }
      ],
      payment_intent_data: {
        metadata: {
          type: 'job_final_payment',
          applicationId,
          opportunityId: applicationData?.opportunityId || '',
          posterId: userId,
          applicantId: applicationData?.applicantId || '',
          applicantConnectAccountId: applicationData?.applicantConnectAccountId || '',
          totalAmount: String(totalAmount),
          remainingAmount: String(remainingAmount),
          platformFee: String(0),
          depositAmount: String(depositAmount)
        }
      },
      success_url: `${origin}/profile/${userId}?payment=success&type=final`,
      cancel_url: `${origin}/profile/${userId}?payment=cancelled`,
      metadata: {
        type: 'job_final_payment',
        applicationId
      }
    });

    return jsonOk({ url: session.url, sessionId: session.id });
  } catch (error: any) {
    console.error('Error creating final payment checkout:', error);
    return jsonError(error.message || 'Failed to create checkout session', 500);
  }
}

export const runtime = 'nodejs';

