import { adminDb } from './firebaseAdmin';

export async function recordAudit(event: string, details?: Record<string, any>) {
  try {
    if (!adminDb) return;
    await adminDb.collection('auditLogs').add({
      event,
      details: details || {},
      createdAt: new Date(),
    });
  } catch {
    // best-effort
  }
}


