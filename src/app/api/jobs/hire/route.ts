import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebaseAdmin';
import { stripe } from '@/lib/stripe';
import { computeApplicationFeeAmount } from '@/lib/fees';
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
    
    // Verify the user is the poster of the opportunity
    if (applicationData?.posterId !== userId) {
      return NextResponse.json({ error: 'Unauthorized - you can only hire for your own opportunities' }, { status: 403 });
    }

    // Check if already hired
    if (applicationData?.status === 'hired') {
      return NextResponse.json({ error: 'This applicant has already been hired' }, { status: 400 });
    }

    // Get opportunity to get amount
    const opportunityDoc = await adminDb.collection('opportunities').doc(applicationData?.opportunityId).get();
    if (!opportunityDoc.exists) {
      return NextResponse.json({ error: 'Opportunity not found' }, { status: 404 });
    }

    const opportunityData = opportunityDoc.data();
    const totalAmount = opportunityData?.amount || 0; // in cents

    if (totalAmount <= 0) {
      return NextResponse.json({ error: 'Opportunity must have a valid amount set' }, { status: 400 });
    }

    // Get poster's Stripe Connect account
    const posterDoc = await adminDb.collection('users').doc(userId).get();
    if (!posterDoc.exists) {
      return NextResponse.json({ error: 'Poster account not found' }, { status: 404 });
    }

    const posterData = posterDoc.data();
    const posterConnectAccountId = posterData?.connectAccountId;

    if (!posterConnectAccountId) {
      return NextResponse.json({ 
        error: 'You must have a Stripe Connect account set up to hire. Please complete onboarding first.' 
      }, { status: 400 });
    }

    // Verify Connect account is enabled
    try {
      const account = await stripe.accounts.retrieve(posterConnectAccountId);
      if (!account.charges_enabled) {
        return NextResponse.json({ 
          error: 'Your Stripe Connect account is not fully set up. Please complete onboarding.' 
        }, { status: 400 });
      }
    } catch (error: any) {
      return NextResponse.json({ 
        error: 'Error verifying Stripe account: ' + (error.message || 'Unknown error') 
      }, { status: 500 });
    }

    // Calculate deposit (25% of total)
    const depositAmount = Math.round(totalAmount * 0.25);
    const platformFee = computeApplicationFeeAmount(depositAmount); // 3% of deposit
    const depositAfterFee = depositAmount - platformFee;

    // Get poster's Stripe customer ID or create one
    let customerId = posterData?.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: posterData?.email || undefined,
        metadata: { userId }
      });
      customerId = customer.id;
      await adminDb.collection('users').doc(userId).update({
        stripeCustomerId: customerId
      });
    }

    // Get applicant's Connect account (they need one to receive payment)
    const applicantDoc = await adminDb.collection('users').doc(applicationData?.applicantId).get();
    if (!applicantDoc.exists) {
      return NextResponse.json({ error: 'Applicant account not found' }, { status: 404 });
    }

    const applicantData = applicantDoc.data();
    const applicantConnectAccountId = applicantData?.connectAccountId;

    if (!applicantConnectAccountId) {
      return NextResponse.json({ 
        error: 'Applicant must have a Stripe Connect account set up to receive payment' 
      }, { status: 400 });
    }

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
    return NextResponse.json(
      { error: error.message || 'Failed to hire applicant' },
      { status: 500 }
    );
  }
}

export const runtime = 'nodejs';

