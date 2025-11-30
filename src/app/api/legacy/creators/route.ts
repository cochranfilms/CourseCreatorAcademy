import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import type { QueryDocumentSnapshot } from 'firebase-admin/firestore';

// GET /api/legacy/creators
// Returns the list of Legacy creators (public fields only)
// Includes content counts and activity data for featured creator selection
export async function GET(req: NextRequest) {
  try {
    if (!adminDb) {
      return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
    }

    const snap = await adminDb.collection('legacy_creators').orderBy('order', 'asc').get().catch(async () => {
      // If no index for order, just list all
      return await adminDb.collection('legacy_creators').get();
    });
    
    // Get content counts for each creator
    const creatorsWithCounts = await Promise.all(
      snap.docs.map(async (d: QueryDocumentSnapshot) => {
        const data = d.data() as any;
        const creatorId = d.id;
        
        // Count videos (all videos, not just samples)
        let videoCount = 0;
        try {
          const videosSnap = await adminDb.collection(`legacy_creators/${creatorId}/videos`).get();
          videoCount = videosSnap.size;
        } catch (error) {
          // If collection doesn't exist or error, count is 0
          videoCount = 0;
        }
        
        // Get most recent activity timestamp (from updatedAt or createdAt)
        const updatedAt = data.updatedAt || data.createdAt || null;
        const createdAt = data.createdAt || null;
        // Use updatedAt if available, otherwise createdAt, otherwise null
        const lastActivity = updatedAt || createdAt || null;
        
        return {
          id: creatorId,
          handle: data.handle || '',
          displayName: data.displayName || '',
          avatarUrl: data.avatarUrl || null,
          bannerUrl: data.bannerUrl || null,
          connectAccountId: data.connectAccountId || null,
          samplesCount: Number(data.samplesCount || 0),
          kitSlug: data.kitSlug || creatorId,
          contentCount: videoCount,
          lastActivity: lastActivity,
        };
      })
    );
    
    return NextResponse.json({ creators: creatorsWithCounts });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to list creators' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';


