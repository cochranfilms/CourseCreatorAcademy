import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebaseAdmin';

// GET /api/admin/user-id
// Get admin user ID by email (info@cochranfilms.com)
export async function GET(req: NextRequest) {
  try {
    if (!adminAuth) {
      return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
    }

    const userRecord = await adminAuth.getUserByEmail('info@cochranfilms.com');
    return NextResponse.json({ userId: userRecord.uid });
  } catch (error: any) {
    console.error('Error getting admin user ID:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get admin user ID' },
      { status: 500 }
    );
  }
}

export const runtime = 'nodejs';

