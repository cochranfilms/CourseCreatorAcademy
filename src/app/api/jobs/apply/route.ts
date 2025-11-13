import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';

export async function POST(req: NextRequest) {
  try {
    if (!adminDb) {
      return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
    }

    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    let decodedToken;
    try {
      decodedToken = await adminAuth.verifyIdToken(token);
    } catch (error) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const userId = decodedToken.uid;
    const {
      opportunityId,
      name,
      email,
      phone,
      portfolioUrl,
      coverLetter,
      rate,
      availability,
      additionalInfo
    } = await req.json();

    if (!opportunityId || !name || !email || !coverLetter) {
      return NextResponse.json(
        { error: 'Missing required fields: opportunityId, name, email, coverLetter' },
        { status: 400 }
      );
    }

    // Verify opportunity exists
    const opportunityDoc = await adminDb.collection('opportunities').doc(opportunityId).get();
    if (!opportunityDoc.exists) {
      return NextResponse.json({ error: 'Opportunity not found' }, { status: 404 });
    }

    const opportunityData = opportunityDoc.data();
    
    // Prevent applying to own opportunity
    if (opportunityData?.posterId === userId) {
      return NextResponse.json({ error: 'Cannot apply to your own opportunity' }, { status: 400 });
    }

    // Check if already applied
    const existingApplication = await adminDb
      .collection('jobApplications')
      .where('opportunityId', '==', opportunityId)
      .where('applicantId', '==', userId)
      .limit(1)
      .get();

    if (!existingApplication.empty) {
      return NextResponse.json({ error: 'You have already applied to this opportunity' }, { status: 400 });
    }

    // Create application document
    const applicationData = {
      opportunityId,
      applicantId: userId,
      posterId: opportunityData?.posterId || '',
      opportunityTitle: opportunityData?.title || '',
      opportunityCompany: opportunityData?.company || '',
      name: String(name || ''),
      email: String(email || ''),
      phone: String(phone || ''),
      portfolioUrl: String(portfolioUrl || ''),
      coverLetter: String(coverLetter || ''),
      rate: String(rate || ''),
      availability: String(availability || ''),
      additionalInfo: String(additionalInfo || ''),
      status: 'pending', // pending, hired, rejected, completed
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    };

    const applicationRef = await adminDb.collection('jobApplications').add(applicationData);

    return NextResponse.json({
      success: true,
      applicationId: applicationRef.id
    });
  } catch (error: any) {
    console.error('Error submitting application:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to submit application' },
      { status: 500 }
    );
  }
}

export const runtime = 'nodejs';

