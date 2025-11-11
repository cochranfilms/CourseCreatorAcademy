import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

// Simple in-memory rate limiter (best-effort per instance)
const buckets = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 60_000; // 1 minute
const MAX_REQUESTS = 60;  // 60 req/min by IP+route

function keyFor(req: NextRequest): string {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const path = req.nextUrl.pathname;
  return `${ip}:${path}`;
}

function rateLimit(req: NextRequest): { ok: boolean; headers?: Record<string, string> } {
  const key = keyFor(req);
  const now = Date.now();
  let b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    b = { count: 0, resetAt: now + WINDOW_MS };
  }
  b.count += 1;
  buckets.set(key, b);
  const remaining = Math.max(0, MAX_REQUESTS - b.count);
  const headers = {
    'X-RateLimit-Limit': String(MAX_REQUESTS),
    'X-RateLimit-Remaining': String(remaining),
    'X-RateLimit-Reset': String(Math.floor(b.resetAt / 1000)),
  };
  if (b.count > MAX_REQUESTS) {
    return { ok: false, headers };
  }
  return { ok: true, headers };
}

export function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;
  // Apply to sensitive endpoints
  const guarded = [
    /^\/api\/legacy\/upload/,
    /^\/api\/legacy\/upload-from-url/,
    /^\/api\/mux\/tus-proxy/,
    /^\/api\/webhooks\//,
    /^\/api\/mux\/token/,
    /^\/api\/admin\/import/,
  ];
  if (guarded.some((re) => re.test(path))) {
    const { ok, headers } = rateLimit(req);
    if (!ok) {
      return new NextResponse(JSON.stringify({ error: 'Too Many Requests' }), {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          ...(headers || {}),
        },
      });
    }
    if (headers) {
      const res = NextResponse.next();
      Object.entries(headers).forEach(([k, v]) => res.headers.set(k, v));
      return res;
    }
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/api/legacy/upload/:path*',
    '/api/legacy/upload-from-url/:path*',
    '/api/mux/tus-proxy/:path*',
    '/api/webhooks/:path*',
    '/api/mux/token/:path*',
    '/api/admin/import/:path*',
  ],
};


