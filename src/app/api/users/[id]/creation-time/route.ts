import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebaseAdmin';

// GET /api/users/[id]/creation-time
// Returns the user's creation time from Firebase Auth (public endpoint for profile viewing)
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: userId } = await params;

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    if (!adminAuth) {
      return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
    }

    try {
      const userRecord = await adminAuth.getUser(userId);
      const creationTime = userRecord.metadata.creationTime;

      if (creationTime) {
        return NextResponse.json({ 
          creationTime: new Date(creationTime).toISOString() 
        });
      }

      return NextResponse.json({ creationTime: null });
    } catch (error: any) {
      // User not found or other error
      if (error.code === 'auth/user-not-found') {
        return NextResponse.json({ creationTime: null });
      }
      throw error;
    }
  } catch (error: any) {
    console.error('Error fetching user creation time:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user creation time' },
      { status: 500 }
    );
  }
}

