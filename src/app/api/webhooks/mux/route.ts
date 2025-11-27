import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { adminDb } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';

function parsePassthrough(value: any): { courseId?: string; moduleId?: string; lessonId?: string; legacyCreatorId?: string; title?: string; description?: string; isSample?: boolean } {
  if (!value) return {};
  // Prefer JSON passthrough like: {"courseId":"foo","moduleId":"mod-1","lessonId":"les-1"} or {"legacyCreatorId":"...","title":"..."}
  if (typeof value === 'string') {
    const str = value.trim();
    try {
      const obj = JSON.parse(str);
      if (obj && (obj.courseId || obj.course || obj.slug || obj.legacyCreatorId)) {
        return {
          courseId: obj.courseId || obj.course || obj.slug,
          moduleId: obj.moduleId || obj.module,
          lessonId: obj.lessonId || obj.lesson,
          legacyCreatorId: obj.legacyCreatorId,
          title: obj.title,
          description: obj.description,
          isSample: Boolean(obj.isSample),
        };
      }
    } catch {}

    // Fallback: key=value pairs separated by | or , e.g. "course:foo|module:mod-1|lesson:les-1"
    const parts = str.split(/[|,]/).map(s => s.trim());
    const map: Record<string, string> = {};
    for (const p of parts) {
      const [k, v] = p.split(/[:=]/).map(s => s.trim());
      if (k && v) map[k.toLowerCase()] = v;
    }
    if (Object.keys(map).length) {
      return {
        courseId: map.courseid || map.course || map.slug,
        moduleId: map.moduleid || map.module,
        lessonId: map.lessonid || map.lesson,
        legacyCreatorId: map.legacycreatorid || map.legacycreator,
        title: map.title,
        description: map.description,
        isSample: map.issample === 'true' || map.issample === '1',
      };
    }

    // Fallback: slash-delimited path like "courseId/moduleId/lessonId"
    const slash = str.split('/');
    if (slash.length === 3) {
      return { courseId: slash[0], moduleId: slash[1], lessonId: slash[2] };
    }
  }
  return {};
}

export async function POST(req: NextRequest) {
  // Read raw body for signature verification
  const raw = await req.text();
  const sig = req.headers.get('mux-signature') || req.headers.get('Mux-Signature') || '';

  // Verify if secret configured
  const secret = process.env.MUX_WEBHOOK_SECRET;
  if (secret) {
    try {
      // Verify Mux signature: header format "t=timestamp,v1=signature"
      const parts = String(sig)
        .split(',')
        .map((s) => s.trim())
        .reduce((acc: Record<string, string>, kv) => {
          const [k, v] = kv.split('=');
          if (k && v) acc[k] = v;
          return acc;
        }, {} as Record<string, string>);
      const timestamp = parts['t'];
      const signature = parts['v1'];
      if (!timestamp || !signature) throw new Error('Missing signature fields');
      const payload = `${timestamp}.${raw}`;
      const computed = crypto
        .createHmac('sha256', secret)
        .update(payload, 'utf8')
        .digest('hex');
      // timing-safe compare
      const a = Buffer.from(computed);
      const b = Buffer.from(signature);
      if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
        throw new Error('Signature mismatch');
      }
    } catch (err: any) {
      return NextResponse.json({ error: 'Invalid Mux signature' }, { status: 400 });
    }
  }

  let payload: any = null;
  try {
    payload = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const type = payload?.type as string | undefined;
  // Idempotency: prevent duplicate handling (best-effort)
  try {
    if (adminDb) {
      const idKey = `${String(type || '')}:${String(payload?.data?.id || '')}`;
      if (idKey) {
        const ref = adminDb.collection('webhookEventsProcessed').doc(idKey);
        const snap = await ref.get();
        if (snap.exists) {
          return NextResponse.json({ received: true, duplicate: true });
        }
        await ref.set({ source: 'mux', type: type || '', created: new Date() }, { merge: true });
      }
    }
  } catch {}
  // Handle asset ready to populate playbackId/duration
  if (type === 'video.asset.ready' || type === 'video.asset.updated') {
    const data = payload?.data || {};
    const assetId: string | undefined = data?.id;
    const playbackId: string | undefined = data?.playback_ids?.[0]?.id;
    const durationSec: number = data?.duration ? Math.round(Number(data.duration)) : 0;
    const passthrough = data?.passthrough;

    if (!assetId) {
      return NextResponse.json({ error: 'Missing asset id' }, { status: 400 });
    }

    // Generate animated GIF thumbnail URL (MUX generates on-demand)
    // Format: https://image.mux.com/{PLAYBACK_ID}/animated.gif?width=320
    const animatedGifUrl = playbackId 
      ? `https://image.mux.com/${playbackId}/animated.gif?width=320`
      : null;

    try {
      const { courseId, moduleId, lessonId, legacyCreatorId, title, description, isSample } = parsePassthrough(passthrough);
      let updates = 0;

      // Handle legacy creator video uploads
      if (legacyCreatorId && adminDb) {
        const creatorId = String(legacyCreatorId);
        const videoRef = adminDb.collection(`legacy_creators/${creatorId}/videos`);
        await videoRef.add({
          muxAssetId: assetId,
          muxPlaybackId: playbackId || null,
          muxAnimatedGifUrl: animatedGifUrl,
          title: title || 'Untitled Video',
          description: description || '',
          durationSec: durationSec || 0,
          isSample: Boolean(isSample),
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
        updates++;

        // If creator has no featured video yet and this is a sample, set it
        try {
          const creatorDocRef = adminDb.collection('legacy_creators').doc(creatorId);
          const creatorSnap = await creatorDocRef.get();
          const cdata = creatorSnap.exists ? (creatorSnap.data() as any) : null;
          const hasFeatured = Boolean(cdata?.featured?.playbackId);
          if (!hasFeatured && playbackId) {
            await creatorDocRef.set({
              featured: {
                playbackId: playbackId,
                title: title || 'Featured',
                description: description || '',
                durationSec: durationSec || 0,
              },
              updatedAt: FieldValue.serverTimestamp(),
            }, { merge: true });
            updates++;
          }
        } catch {}
      } else if (courseId && moduleId && lessonId && adminDb) {
        // Handle regular course lesson videos
        const ref = adminDb
          .collection('courses').doc(courseId)
          .collection('modules').doc(moduleId)
          .collection('lessons').doc(lessonId);
        const updateData: any = {
          muxAssetId: assetId,
          muxPlaybackId: playbackId || null,
          muxAnimatedGifUrl: animatedGifUrl,
          durationSec: durationSec || 0,
          updatedAt: FieldValue.serverTimestamp(),
        };
        // Preserve title and description from passthrough if provided
        if (title) updateData.title = title;
        if (description !== undefined) updateData.description = description;
        await ref.set(updateData, { merge: true });
        updates++;
      } else if (adminDb) {
        // Fallback: find lessons that already reference this assetId
        const snap = await adminDb.collectionGroup('lessons')
          .where('muxAssetId', '==', assetId)
          .get();
        for (const doc of snap.docs) {
          await doc.ref.set({
            muxPlaybackId: playbackId || null,
            muxAnimatedGifUrl: animatedGifUrl,
            durationSec: durationSec || 0,
            updatedAt: FieldValue.serverTimestamp(),
          }, { merge: true });
          updates++;
        }
      }

      return NextResponse.json({ received: true, updated: updates });
    } catch (err: any) {
      console.error('MUX webhook handling error:', err);
      return NextResponse.json({ error: err?.message || 'Update failed' }, { status: 500 });
    }
  }

  // For other events, just acknowledge
  return NextResponse.json({ received: true });
}

export const dynamic = 'force-dynamic';


