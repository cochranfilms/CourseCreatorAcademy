import { NextRequest, NextResponse } from 'next/server';

function getAllowedOrigin(requestOrigin?: string | null): string | null {
  const isDev = process.env.NODE_ENV !== 'production';
  if (isDev) return requestOrigin || '*';
  const allowlist = (process.env.CORS_ALLOWED_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (!allowlist.length) {
    const fallback = process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || null;
    return fallback;
  }
  if (requestOrigin && allowlist.includes(requestOrigin)) return requestOrigin;
  return allowlist[0] || null;
}

function corsHeaders(origin?: string | null) {
  const allowOrigin = origin || '';
  const headers: Record<string, string> = {
    ...(allowOrigin ? { 'Access-Control-Allow-Origin': allowOrigin } : {}),
    'Access-Control-Allow-Methods': 'OPTIONS, POST, PATCH, HEAD',
    'Access-Control-Allow-Headers': [
      'authorization',
      'content-type',
      'tus-resumable', 'Tus-Resumable',
      'upload-length', 'Upload-Length',
      'upload-offset', 'Upload-Offset',
      'upload-metadata', 'Upload-Metadata',
      'origin', 'Origin',
      'x-requested-with',
    ].join(', '),
    'Access-Control-Expose-Headers': [
      'location', 'Location',
      'upload-offset', 'Upload-Offset',
      'upload-length', 'Upload-Length',
      'tus-resumable', 'Tus-Resumable',
    ].join(', '),
    'Vary': 'Origin',
  };
  return headers;
}

function isAllowedMuxUploadUrl(url: string): boolean {
  try {
    const u = new URL(url);
    // Match MUX direct upload URLs (various subdomains)
    const isMuxDomain = /\.mux\.com$/i.test(u.hostname) || u.hostname === 'mux.com';
    const hasUploadPath = u.pathname.includes('/upload/');
    return isMuxDomain && hasUploadPath;
  } catch {
    return false;
  }
}

async function handle(method: 'OPTIONS'|'POST'|'PATCH'|'HEAD', req: NextRequest) {
  const requestOrigin = req.headers.get('origin');
  const allowedOrigin = getAllowedOrigin(requestOrigin);
  // In production, block disallowed origins for CORS handshake
  if (process.env.NODE_ENV === 'production' && method === 'OPTIONS') {
    if (!allowedOrigin) {
      return new NextResponse(null, { status: 403 });
    }
    return new NextResponse(null, { status: 204, headers: corsHeaders(allowedOrigin) });
  }
  if (method === 'OPTIONS') {
    return new NextResponse(null, { status: 204, headers: corsHeaders(allowedOrigin) });
  }

  const target = req.nextUrl.searchParams.get('u');
  if (!target) {
    console.error('TUS proxy: Missing target URL parameter');
    return NextResponse.json({ error: 'Missing target URL' }, { status: 400, headers: corsHeaders(allowedOrigin) });
  }
  
  if (!isAllowedMuxUploadUrl(target)) {
    console.error('TUS proxy: Invalid target URL:', target);
    return NextResponse.json({ error: 'Invalid target URL' }, { status: 400, headers: corsHeaders(allowedOrigin) });
  }

  const headers = new Headers();
  // Forward relevant headers (keep case-insensitive)
  req.headers.forEach((value, key) => {
    // Do not forward Host/Origin/Referer to remote
    if (/^(host|origin|referer)$/i.test(key)) return;
    // Forward all TUS-related headers
    headers.set(key, value);
  });

  // Ensure TUS-Resumable header is set for TUS protocol compliance
  if (!headers.has('tus-resumable') && !headers.has('Tus-Resumable')) {
    headers.set('Tus-Resumable', '1.0.0');
  }

  // Per TUS: POST (create) has empty body; PATCH streams bytes
  let body: ReadableStream | null = null;
  if (method === 'PATCH') {
    body = req.body;
  } else if (method === 'POST') {
    // Ensure POST has Content-Length: 0 for TUS create request
    if (!headers.has('content-length') && !headers.has('Content-Length')) {
      headers.set('Content-Length', '0');
    }
    // Explicitly set empty body for POST
    body = null;
  }

  const init: RequestInit = {
    method,
    headers,
    body: body || null,
    // @ts-ignore - duplex needed for streaming
    duplex: method === 'PATCH' ? 'half' : undefined,
  };

  const upstream = await fetch(target, init);
  const resHeaders = new Headers(corsHeaders(allowedOrigin));

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

export async function OPTIONS(req: NextRequest) {
  try {
    return await handle('OPTIONS', req);
  } catch (err: any) {
    console.error('TUS proxy OPTIONS error:', err);
    return NextResponse.json({ error: err?.message || 'Proxy error' }, { status: 500, headers: corsHeaders(req.headers.get('origin')) });
  }
}

export async function POST(req: NextRequest) {
  try {
    console.log('TUS proxy POST request received');
    const result = await handle('POST', req);
    console.log('TUS proxy POST response:', result.status);
    return result;
  } catch (err: unknown) {
    console.error('TUS proxy POST error:', err);
    const error = err as Error;
    return NextResponse.json({ error: error?.message || 'Proxy error' }, { status: 500, headers: corsHeaders(req.headers.get('origin')) });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    return await handle('PATCH', req);
  } catch (err: any) {
    console.error('TUS proxy PATCH error:', err);
    return NextResponse.json({ error: err?.message || 'Proxy error' }, { status: 500, headers: corsHeaders(req.headers.get('origin')) });
  }
}

export async function HEAD(req: NextRequest) {
  try {
    return await handle('HEAD', req);
  } catch (err: any) {
    console.error('TUS proxy HEAD error:', err);
    return NextResponse.json({ error: err?.message || 'Proxy error' }, { status: 500, headers: corsHeaders(req.headers.get('origin')) });
  }
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';


