import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebaseAdmin';
import { mux } from '@/lib/mux';
import crypto from 'crypto';
import { recordAudit } from '@/lib/audit';

type Row = Record<string, string>;

function parseCsv(text: string): Row[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];
  const headers = lines[0].split(',').map((h) => h.trim());
  const rows: Row[] = [];
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(','); // simple CSV (no quoted commas)
    const row: Row = {};
    headers.forEach((h, idx) => {
      row[h] = (parts[idx] ?? '').trim();
    });
    rows.push(row);
  }
  return rows;
}

async function ensureAdmin(uid: string): Promise<boolean> {
  if (!adminDb) return false;
  try {
    const snap = await adminDb.collection('users').doc(uid).get();
    const data = snap.exists ? (snap.data() as any) : null;
    return Boolean(data?.roles?.admin || data?.isAdmin);
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!adminDb || !adminAuth) {
      return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
    }

    // AuthZ
    const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
    let uid: string | null = null;
    if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
      const idToken = authHeader.split(' ')[1];
      try {
        const decoded = await adminAuth.verifyIdToken(idToken);
        uid = decoded.uid || null;
      } catch {}
    }
    if (!uid || !(await ensureAdmin(uid))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const form = await req.formData();
    const mode = String(form.get('mode') || 'dry_run');
    const file = form.get('file') as File | null;
    if (!file) {
      return NextResponse.json({ error: 'Missing file' }, { status: 400 });
    }
    const csvText = await file.text();
    const rows = parseCsv(csvText);

    const jobId = `job_${Date.now()}`;
    const summary: Record<string, number> = {
      course: 0, module: 0, lesson: 0, asset_overlay: 0, asset_sfx: 0, skipped: 0, mux_ingest: 0
    };
    const dryRun = mode !== 'commit';

    for (const r of rows) {
      const type = (r['row_type'] || '').trim();
      const rowHash = crypto.createHash('sha1').update(JSON.stringify(r)).digest('hex');
      const idempotentRef = adminDb.collection('importJobs').doc(jobId).collection('rows').doc(rowHash);
      if (!dryRun) {
        const exists = await idempotentRef.get();
        if (exists.exists && (exists.data() as any)?.applied) {
          summary.skipped++;
          continue;
        }
      }

      if (type === 'course') {
        const courseId = (r['course_id'] || '').trim();
        if (!courseId) { summary.skipped++; continue; }
        const data: any = {
          title: r['course_title'] || '',
          summary: r['description'] || '',
          updatedAt: new Date(),
        };
        if (!dryRun) {
          await adminDb.collection('courses').doc(courseId).set(data, { merge: true });
          await idempotentRef.set({ applied: true, type, at: new Date() });
        }
        summary.course++;
      } else if (type === 'module') {
        const courseId = (r['course_id'] || '').trim();
        const moduleId = (r['module_id'] || '').trim();
        if (!courseId || !moduleId) { summary.skipped++; continue; }
        const index = parseInt(r['module_index'] || '0', 10) || 0;
        const data: any = { index, title: r['title'] || moduleId, updatedAt: new Date() };
        if (!dryRun) {
          await adminDb.collection('courses').doc(courseId).collection('modules').doc(moduleId).set(data, { merge: true });
          await idempotentRef.set({ applied: true, type, at: new Date() });
        }
        summary.module++;
      } else if (type === 'lesson') {
        const courseId = (r['course_id'] || '').trim();
        const moduleId = (r['module_id'] || '').trim();
        const lessonId = (r['lesson_id'] || '').trim();
        if (!courseId || !moduleId || !lessonId) { summary.skipped++; continue; }
        const index = parseInt(r['lesson_index'] || '0', 10) || 0;
        const freePreview = String(r['free_preview'] || '').toLowerCase() === 'true';
        const data: any = {
          title: r['title'] || lessonId,
          index,
          freePreview,
          updatedAt: new Date(),
        };
        if (!dryRun) {
          const ref = adminDb.collection('courses').doc(courseId).collection('modules').doc(moduleId).collection('lessons').doc(lessonId);
          await ref.set(data, { merge: true });
          const muxUrl = (r['mux_input_url'] || '').trim();
          if (muxUrl) {
            // Course content should be signed playback
            await mux.video.assets.create({
              input: muxUrl,
              playback_policy: ['signed'],
              passthrough: JSON.stringify({ courseId, moduleId, lessonId }),
            } as any);
            summary.mux_ingest++;
          }
          await idempotentRef.set({ applied: true, type, at: new Date() });
        }
        summary.lesson++;
      } else if (type === 'asset_overlay' || type === 'asset_sfx') {
        const creatorId = (r['creator_id'] || '').trim();
        if (!creatorId) { summary.skipped++; continue; }
        const category = type === 'asset_overlay' ? 'overlays' : 'sfx';
        const title = (r['title'] || '').trim();
        const tag = (r['asset_tag'] || '').trim();
        const image = (r['asset_image'] || '').trim();
        if (!dryRun) {
          const cRef = adminDb.collection('legacy_creators').doc(creatorId);
          const snap = await cRef.get();
          const data = snap.exists ? (snap.data() as any) : {};
          const list: Array<any> = (data?.assets && Array.isArray(data.assets[category])) ? data.assets[category] : [];
          const existsIdx = list.findIndex((x: any) => String(x?.title || '') === title && String(x?.tag || '') === tag);
          const updatedItem = { title, tag, image };
          if (existsIdx >= 0) list[existsIdx] = updatedItem; else list.push(updatedItem);
          const newAssets = { ...(data.assets || {}), [category]: list };
          await cRef.set({ assets: newAssets, updatedAt: new Date() }, { merge: true });
          await idempotentRef.set({ applied: true, type, at: new Date() });
        }
        summary[type as 'asset_overlay' | 'asset_sfx']++;
      } else {
        summary.skipped++;
      }
    }

    await recordAudit('admin_import_completed', { jobId, dryRun, summary });
    return NextResponse.json({ dryRun, jobId, summary, rows: rows.length });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Import failed' }, { status: 500 });
  }
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';


