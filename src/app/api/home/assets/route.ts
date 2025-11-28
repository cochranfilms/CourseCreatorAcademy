import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import { getUserIdFromAuthHeader } from '@/lib/api/auth';
import { hasGlobalMembership } from '@/lib/entitlements';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: NextRequest) {
  try {
    if (!adminDb) {
      return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
    }

    // Verify user is authenticated
    const uid = await getUserIdFromAuthHeader(req);
    if (!uid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check membership (includes legacy creators)
    const hasMembership = await hasGlobalMembership(uid);
    if (!hasMembership) {
      return NextResponse.json({ error: 'Membership required' }, { status: 403 });
    }

    // Fetch the most recent asset
    const assetsSnapshot = await adminDb
      .collection('assets')
      .orderBy('createdAt', 'desc')
      .limit(1)
      .get();

    console.log(`[Home Assets API] Found ${assetsSnapshot.docs.length} assets for user ${uid}`);

    if (assetsSnapshot.empty) {
      return NextResponse.json({ asset: null });
    }

    const assetDoc = assetsSnapshot.docs[0];
    const assetData = assetDoc.data();

    const asset = {
      id: assetDoc.id,
      title: assetData.title || 'Untitled Asset',
      category: assetData.category || '',
      thumbnailUrl: assetData.thumbnailUrl || '',
      description: assetData.description || '',
    };

    return NextResponse.json({ asset });
  } catch (error: any) {
    console.error('[Home Assets API] Error fetching asset:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch asset' },
      { status: 500 }
    );
  }
}

export const runtime = 'nodejs';

