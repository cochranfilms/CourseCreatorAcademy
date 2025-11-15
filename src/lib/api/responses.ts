import { NextResponse } from 'next/server';

// Simple OK/ERROR helpers
export function jsonOk<T>(data: T, init?: number | ResponseInit) {
  const responseInit: ResponseInit | undefined = typeof init === 'number' ? { status: init } : init;
  return NextResponse.json(data, responseInit);
}

export function jsonError(message: string, status: number = 400, extra?: Record<string, unknown>) {
  return NextResponse.json({ error: message, ...(extra || {}) }, { status });
}

// Verbose helpers compatible with earlier imports
export function ok(data: Record<string, unknown> = {}, init?: number | ResponseInit) {
  const responseInit: ResponseInit | undefined = typeof init === 'number' ? { status: init } : init;
  return NextResponse.json({ success: true, ...data }, responseInit);
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

// Helper to safely parse JSON from request body
export async function safeJsonParse<T = any>(req: Request): Promise<{ success: true; data: T } | { success: false; error: string }> {
  try {
    const data = await req.json();
    return { success: true, data };
  } catch (error: any) {
    return { 
      success: false, 
      error: error instanceof SyntaxError 
        ? 'Invalid JSON in request body' 
        : 'Failed to parse request body' 
    };
  }
}


