import { NextRequest, NextResponse } from 'next/server';
import { mux } from '@/lib/mux';

/**
 * GET /api/show/episode?assetId=xxx
 * Fetches MUX asset metadata for the show episode
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const assetId = searchParams.get('assetId');

    if (!assetId) {
      return NextResponse.json({ error: 'Missing assetId parameter' }, { status: 400 });
    }

    // Fetch asset from MUX
    const asset: any = await mux.video.assets.retrieve(assetId);
    
    if (!asset || !asset.id) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
    }

    const playbackId = asset.playback_ids?.[0]?.id || null;
    const durationSec = asset.duration ? Math.round(Number(asset.duration)) : 0;
    
    // Parse passthrough data if it exists (often contains custom metadata)
    let passthroughData: any = {};
    if (asset.passthrough) {
      try {
        passthroughData = typeof asset.passthrough === 'string' 
          ? JSON.parse(asset.passthrough) 
          : asset.passthrough;
      } catch {
        // If passthrough isn't JSON, treat it as a string
        passthroughData = { raw: asset.passthrough };
      }
    }

    // Extract title from passthrough or use a default
    const title = passthroughData.title || asset.id;
    
    // Format duration
    const minutes = Math.floor(durationSec / 60);
    const seconds = durationSec % 60;
    const durationFormatted = minutes > 0 ? `${minutes}m` : `${seconds}s`;

    // Get created date
    const createdAt = asset.created_at 
      ? new Date(asset.created_at * 1000) 
      : new Date();
    const dateFormatted = createdAt.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });

    return NextResponse.json({
      assetId: asset.id,
      playbackId,
      title,
      durationSec,
      durationFormatted,
      dateFormatted,
      createdAt: createdAt.toISOString(),
      status: asset.status,
      passthrough: passthroughData,
    });
  } catch (error: any) {
    console.error('Error fetching MUX asset:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch asset' },
      { status: 500 }
    );
  }
}

