import { NextResponse } from 'next/server';

export function jsonOk<T>(data: T, init?: number | ResponseInit) {
  return NextResponse.json(data as any, init);
}

export function jsonError(message: string, status: number = 400, extra?: Record<string, unknown>) {
  return NextResponse.json({ error: message, ...(extra || {}) }, { status });
}


