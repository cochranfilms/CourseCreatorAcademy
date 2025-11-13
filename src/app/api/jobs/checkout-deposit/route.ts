import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebaseAdmin';
import { stripe } from '@/lib/stripe';

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

    if (applicationData?.depositPaid) {
      return NextResponse.json({ error: 'Deposit already paid' }, { status: 400 });
    }

    const depositAmount = applicationData?.depositAmount || 0;
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

    return NextResponse.json({ url: session.url, sessionId: session.id });
  } catch (error: any) {
    console.error('Error creating deposit checkout:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}

export const runtime = 'nodejs';

