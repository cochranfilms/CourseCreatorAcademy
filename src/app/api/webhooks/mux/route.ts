import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { adminDb } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';

function parsePassthrough(value: any): { courseId?: string; moduleId?: string; lessonId?: string } {
  if (!value) return {};
  // Prefer JSON passthrough like: {"courseId":"foo","moduleId":"mod-1","lessonId":"les-1"}
  if (typeof value === 'string') {
    const str = value.trim();
    try {
      const obj = JSON.parse(str);
      if (obj && (obj.courseId || obj.course || obj.slug)) {
        return {
          courseId: obj.courseId || obj.course || obj.slug,
          moduleId: obj.moduleId || obj.module,
          lessonId: obj.lessonId || obj.lesson,
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

    try {
      const { courseId, moduleId, lessonId } = parsePassthrough(passthrough);
      let updates = 0;

      if (courseId && moduleId && lessonId && adminDb) {
        const ref = adminDb
          .collection('courses').doc(courseId)
          .collection('modules').doc(moduleId)
          .collection('lessons').doc(lessonId);
        await ref.set({
          muxAssetId: assetId,
          muxPlaybackId: playbackId || null,
          durationSec: durationSec || 0,
          updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
        updates++;
      } else if (adminDb) {
        // Fallback: find lessons that already reference this assetId
        const snap = await adminDb.collectionGroup('lessons')
          .where('muxAssetId', '==', assetId)
          .get();
        for (const doc of snap.docs) {
          await doc.ref.set({
            muxPlaybackId: playbackId || null,
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


