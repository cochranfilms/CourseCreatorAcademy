import { NextRequest, NextResponse } from 'next/server';
import { ensureAdmin } from '@/lib/api/admin';
import { removeUserProfile, restoreUserProfile } from '@/lib/moderation';

// POST /api/admin/moderation/users/[userId]/remove-profile
// Remove user profile
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const adminId = await ensureAdmin(req);
    if (!adminId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { userId } = await params;
    const body = await req.json();
    const { reason } = body;

    if (!reason) {
      return NextResponse.json({ error: 'Reason is required' }, { status: 400 });
    }

    const success = await removeUserProfile(userId, adminId, reason);

    if (!success) {
      return NextResponse.json({ error: 'Failed to remove profile' }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error removing profile:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to remove profile' },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/moderation/users/[userId]/remove-profile
// Restore user profile
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const adminId = await ensureAdmin(req);
    if (!adminId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { userId } = await params;
    const success = await restoreUserProfile(userId, adminId);

    if (!success) {
      return NextResponse.json({ error: 'Failed to restore profile' }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error restoring profile:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to restore profile' },
      { status: 500 }
    );
  }
}

