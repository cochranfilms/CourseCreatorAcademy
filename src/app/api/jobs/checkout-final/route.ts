import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebaseAdmin';
import { stripe } from '@/lib/stripe';
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

    // Get application to verify ownership and get payment details
    const applicationDoc = await adminDb.collection('jobApplications').doc(applicationId).get();
    if (!applicationDoc.exists) {
      return NextResponse.json({ error: 'Application not found' }, { status: 404 });
    }

    const applicationData = applicationDoc.data();
    if (applicationData?.posterId !== userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    if (applicationData?.status !== 'completed') {
      return NextResponse.json({ error: 'Job must be completed before final payment' }, { status: 400 });
    }

    if (applicationData?.finalPaymentPaid) {
      return NextResponse.json({ error: 'Final payment already paid' }, { status: 400 });
    }

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
      return NextResponse.json({ 
        error: `Invalid payment amount. Total: $${(totalAmount / 100).toFixed(2)}, Deposit: $${(depositAmount / 100).toFixed(2)}, Remaining: $${(remainingAmount / 100).toFixed(2)}` 
      }, { status: 400 });
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
    let customerId = posterData?.stripeCustomerId;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: posterData?.email || undefined,
        metadata: { userId }
      });
      customerId = customer.id;
      await adminDb.collection('users').doc(userId).update({ stripeCustomerId: customerId });
    }

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

    return NextResponse.json({ url: session.url, sessionId: session.id });
  } catch (error: any) {
    console.error('Error creating final payment checkout:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}

export const runtime = 'nodejs';

