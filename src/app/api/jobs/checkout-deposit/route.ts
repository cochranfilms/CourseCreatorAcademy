import type { NextRequest } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import { stripe } from '@/lib/stripe';
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

    if (applicationData?.depositPaid) return jsonError('Deposit already paid', 400);

    const depositAmount = applicationData?.depositAmount || 0;
    const opportunityTitle = applicationData?.opportunityTitle || 'Job Opportunity';

    // Get or create customer
    const posterDoc = await adminDb.collection('users').doc(userId).get();
    const posterData = posterDoc.data();
    const customerId = await getOrCreateCustomer(userId, posterData?.email);

    const origin = req.headers.get('origin') || process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

    // Create checkout session for deposit
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer: customerId,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'usd',
            unit_amount: depositAmount,
            product_data: {
              name: `Deposit (25%) - ${opportunityTitle}`,
              description: 'Job deposit payment'
            }
          }
        }
      ],
      payment_intent_data: {
        metadata: {
          type: 'job_deposit',
          applicationId,
          opportunityId: applicationData?.opportunityId || '',
          posterId: userId,
          applicantId: applicationData?.applicantId || '',
          applicantConnectAccountId: applicationData?.applicantConnectAccountId || '',
          totalAmount: String(applicationData?.totalAmount || 0),
          depositAmount: String(depositAmount),
          platformFee: String(applicationData?.platformFee || 0)
        }
      },
      success_url: `${origin}/profile/${userId}?payment=success&type=deposit`,
      cancel_url: `${origin}/profile/${userId}?payment=cancelled`,
      metadata: {
        type: 'job_deposit',
        applicationId
      }
    });

    return jsonOk({ url: session.url, sessionId: session.id });
  } catch (error) {
    console.error('Error creating deposit checkout:', error);
    const message = error instanceof Error ? error.message : 'Failed to create checkout session';
    return jsonError(message, 500);
  }
}

export const runtime = 'nodejs';

