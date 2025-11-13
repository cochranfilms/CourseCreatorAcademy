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

    // Get application
    const applicationDoc = await adminDb.collection('jobApplications').doc(applicationId).get();
    if (!applicationDoc.exists) {
      return NextResponse.json({ error: 'Application not found' }, { status: 404 });
    }

    const applicationData = applicationDoc.data();
    
    // Verify the user is the poster
    if (applicationData?.posterId !== userId) {
      return NextResponse.json({ error: 'Unauthorized - only the poster can complete final payment' }, { status: 403 });
    }

    // Check if job is completed
    if (applicationData?.status !== 'completed') {
      return NextResponse.json({ error: 'Job must be marked as complete before final payment' }, { status: 400 });
    }

    // Check if already paid
    if (applicationData?.finalPaymentIntentId) {
      return NextResponse.json({ error: 'Final payment has already been processed' }, { status: 400 });
    }

    const totalAmount = applicationData?.totalAmount || 0;
    const depositAmount = applicationData?.depositAmount || 0;
    const remainingAmount = totalAmount - depositAmount; // 75% of total

    if (remainingAmount <= 0) {
      return NextResponse.json({ error: 'Invalid payment amount' }, { status: 400 });
    }

    // Get poster's customer ID
    const posterDoc = await adminDb.collection('users').doc(userId).get();
    if (!posterDoc.exists) {
      return NextResponse.json({ error: 'Poster account not found' }, { status: 404 });
    }

    const posterData = posterDoc.data();
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

    return NextResponse.json({
      success: true,
      remainingAmount,
      platformFeeOnRemaining
    });
  } catch (error: any) {
    console.error('Error creating final payment:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create final payment' },
      { status: 500 }
    );
  }
}

export const runtime = 'nodejs';

