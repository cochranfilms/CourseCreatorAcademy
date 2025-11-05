import { NextRequest, NextResponse } from 'next/server';

function corsHeaders(origin?: string | null) {
  const allowOrigin = origin || '*';
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'OPTIONS, POST, PATCH, HEAD',
    'Access-Control-Allow-Headers': [
      'authorization',
      'content-type',
      'tus-resumable',
      'upload-length',
      'upload-offset',
      'upload-metadata',
      'x-requested-with',
    ].join(', '),
    'Access-Control-Expose-Headers': [
      'location',
      'upload-offset',
      'upload-length',
      'tus-resumable',
    ].join(', '),
    'Vary': 'Origin',
  } as Record<string, string>;
}

function isAllowedMuxUploadUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return (
      /(^|\.)mux\.com$/i.test(u.hostname) ||
      /(^|\.)production\.mux\.com$/i.test(u.hostname)
    ) && u.pathname.includes('/upload/');
  } catch {
    return false;
  }
}

async function handle(method: 'OPTIONS'|'POST'|'PATCH'|'HEAD', req: NextRequest) {
  const origin = req.headers.get('origin');
  if (method === 'OPTIONS') {
    return new NextResponse(null, { status: 204, headers: corsHeaders(origin) });
  }

  const target = req.nextUrl.searchParams.get('u');
  if (!target || !isAllowedMuxUploadUrl(target)) {
    return NextResponse.json({ error: 'Invalid target' }, { status: 400, headers: corsHeaders(origin) });
  }

  const headers = new Headers();
  // Forward relevant headers (keep case-insensitive)
  req.headers.forEach((value, key) => {
    // Do not forward Host/Origin to remote
    if (/^(host|origin|referer)$/i.test(key)) return;
    headers.set(key, value);
  });

  // Stream body when present
  const init: RequestInit = {
    method,
    headers,
    body: method === 'POST' || method === 'PATCH' ? (req.body as any) : undefined,
    // @ts-ignore
    duplex: 'half',
  };

  const upstream = await fetch(target, init);
  const resHeaders = new Headers(corsHeaders(origin));

  // Copy upstream headers
  upstream.headers.forEach((value, key) => {
    // Rewrite Location to point back to proxy, keep other headers
    if (key.toLowerCase() === 'location') {
      try {
        const newLoc = `${req.nextUrl.origin}${req.nextUrl.pathname}?u=${encodeURIComponent(value)}`;
        resHeaders.set('location', newLoc);
      } catch {
        resHeaders.set('location', value);
      }
    } else {
      resHeaders.set(key, value);
    }
  });

  return new NextResponse(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: resHeaders,
  });
}

export async function OPTIONS(req: NextRequest) { return handle('OPTIONS', req); }
export async function POST(req: NextRequest) { return handle('POST', req); }
export async function PATCH(req: NextRequest) { return handle('PATCH', req); }
export async function HEAD(req: NextRequest) { return handle('HEAD', req); }

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';


