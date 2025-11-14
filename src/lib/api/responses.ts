import { NextResponse } from 'next/server';

// Simple OK/ERROR helpers
export function jsonOk<T>(data: T, init?: number | ResponseInit) {
  return NextResponse.json(data, init);
}

export function jsonError(message: string, status: number = 400, extra?: Record<string, unknown>) {
  return NextResponse.json({ error: message, ...(extra || {}) }, { status });
}

// Verbose helpers compatible with earlier imports
export function ok(data: Record<string, unknown> = {}, init?: number | ResponseInit) {
  return NextResponse.json({ success: true, ...data }, init);
}

export function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export function unauthorized(message: string = 'Unauthorized') {
  return NextResponse.json({ error: message }, { status: 401 });
}

export function forbidden(message: string) {
  return NextResponse.json({ error: message }, { status: 403 });
}

export function notFound(message: string) {
  return NextResponse.json({ error: message }, { status: 404 });
}

export function serverError(message: string) {
  return NextResponse.json({ error: message }, { status: 500 });
}


