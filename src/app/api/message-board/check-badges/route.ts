import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromAuthHeader } from '@/lib/api/auth';
import { checkAndAwardBadges } from '@/lib/badges';

// POST /api/message-board/check-badges
// Checks and awards badges for a user after actions like posting
export async function POST(req: NextRequest) {
  try {
    const uid = await getUserIdFromAuthHeader(req);
    if (!uid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const userId = body.userId || uid;

    // Only allow users to check their own badges
    if (userId !== uid) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const awarded = await checkAndAwardBadges(userId);

    return NextResponse.json({ 
      awarded,
      count: awarded.length 
    });
  } catch (error: any) {
    console.error('Error checking badges:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to check badges' },
      { status: 500 }
    );
  }
}

