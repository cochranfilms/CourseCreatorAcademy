import { NextRequest, NextResponse } from 'next/server';
import { ensureAdmin } from '@/lib/api/admin';
import { removeStrike } from '@/lib/moderation';

// DELETE /api/admin/moderation/strikes/[strikeId]
// Remove a strike
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ strikeId: string }> }
) {
  try {
    const adminId = await ensureAdmin(req);
    if (!adminId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { strikeId } = await params;
    const success = await removeStrike(strikeId, adminId);

    if (!success) {
      return NextResponse.json({ error: 'Failed to remove strike' }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error removing strike:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to remove strike' },
      { status: 500 }
    );
  }
}

