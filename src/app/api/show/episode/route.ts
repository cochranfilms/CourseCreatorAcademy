import { NextRequest, NextResponse } from 'next/server';
import { mux } from '@/lib/mux';
import { adminDb } from '@/lib/firebaseAdmin';

/**
 * GET /api/show/episode?assetId=xxx
 * Fetches MUX asset metadata for the show episode
 * Also fetches description from Firestore config/show document
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

    // Fetch title and description from Firestore config/show document
    let title = '';
    let description = '';
    if (adminDb) {
      try {
        const configDoc = await adminDb.collection('config').doc('show').get();
        if (configDoc.exists) {
          const configData = configDoc.data();
          title = configData?.title || '';
          description = configData?.description || '';
          console.log('Fetched from Firestore config/show:', { title, description });
        } else {
          console.log('Firestore config/show document does not exist');
        }
      } catch (firestoreError: any) {
        console.error('Error fetching config from Firestore:', firestoreError);
        console.error('Error details:', {
          message: firestoreError?.message,
          code: firestoreError?.code,
          stack: firestoreError?.stack
        });
        // Continue without config - not a critical error
      }
    } else {
      console.warn('adminDb is not initialized - cannot fetch title/description from Firestore');
    }
    
    // Extract title from MUX asset metadata if not found in Firestore
    // Priority: Firestore title > passthrough.title > asset.test (MUX test field) > fallback
    if (!title) {
      title = passthroughData.title || asset.test || null;
      
      // If still no title, use a more user-friendly fallback
      if (!title) {
        // Try to extract from playback ID or use a generic episode title
        title = `Episode ${asset.id.slice(-4)}`; // Last 4 chars of asset ID as episode number
      }
    }
    
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

    const responseData = {
      assetId: asset.id,
      playbackId,
      title,
      description,
      durationSec,
      durationFormatted,
      dateFormatted,
      createdAt: createdAt.toISOString(),
      status: asset.status,
      passthrough: passthroughData,
    };
    
    console.log('Returning episode data:', {
      title: responseData.title,
      description: responseData.description,
      hasTitle: !!responseData.title,
      hasDescription: !!responseData.description
    });
    
    return NextResponse.json(responseData);
  } catch (error: any) {
    console.error('Error fetching MUX asset:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch asset' },
      { status: 500 }
    );
  }
}

