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
  
  // Only forward TUS-specific headers - use standard TUS header case (Title-Case)
  // MUX is strict about header names and case - must be Title-Case
  const lowerKeyMap = new Map<string, string>();
  req.headers.forEach((value, key) => {
    lowerKeyMap.set(key.toLowerCase(), value); // Map lowercase key to value
  });
  
  // Forward only TUS protocol headers using standard TUS Title-Case
  const tusHeaderMapping: Record<string, string> = {
    'tus-resumable': 'Tus-Resumable',
    'upload-length': 'Upload-Length',
    'upload-offset': 'Upload-Offset',
    'upload-metadata': 'Upload-Metadata',
  };
  
  Object.entries(tusHeaderMapping).forEach(([lowerKey, standardKey]) => {
    const value = lowerKeyMap.get(lowerKey);
    if (value) {
      headers.set(standardKey, value);
    }
  });
  
  // Ensure TUS-Resumable header is set (use standard Title-Case)
  if (!headers.has('Tus-Resumable')) {
    headers.set('Tus-Resumable', '1.0.0');
  }
  
  // Explicitly set Content-Length for POST (TUS protocol requirement)
  if (method === 'POST') {
    headers.set('Content-Length', '0');
  }

  // Log headers for debugging
  if (method === 'POST') {
    console.log('[TUS PROXY] POST headers being sent to MUX:', Object.fromEntries(Array.from(headers.entries())));
    console.log('[TUS PROXY] Target URL:', target);
  }

  // Per TUS: POST (create) has empty body; PATCH streams bytes
  let body: ReadableStream | null = null;
  if (method === 'PATCH') {
    body = req.body;
  } else if (method === 'POST') {
    // For TUS POST, body must be empty
    body = null;
  }

  // Convert Headers to plain object to preserve exact Title-Case
  // Headers object may normalize case, but MUX requires exact Title-Case
  const headerObj: Record<string, string> = {};
  headers.forEach((value, key) => {
    // Preserve the exact case we set (Title-Case)
    headerObj[key] = value;
  });

  const init: RequestInit = {
    method,
    headers: headerObj, // Use plain object to preserve exact case
    body: body || undefined, // Use undefined instead of null for empty body
    // @ts-ignore - duplex needed for streaming
    duplex: method === 'PATCH' ? 'half' : undefined,
  };

  console.log(`[TUS PROXY] ${method} forwarding to:`, target);
  console.log(`[TUS PROXY] ${method} forwarded headers (exact case):`, headerObj);
  
  const upstream = await fetch(target, init);
  
  console.log(`[TUS PROXY] ${method} upstream response status:`, upstream.status);
  console.log(`[TUS PROXY] ${method} upstream response headers:`, Object.fromEntries(Array.from(upstream.headers.entries())));
  
  // Log response body for debugging 405 errors (clone before reading)
  if (upstream.status === 405) {
    try {
      const clonedResponse = upstream.clone();
      const responseText = await clonedResponse.text();
      console.log(`[TUS PROXY] ${method} 405 error response body:`, responseText);
      console.log(`[TUS PROXY] ${method} Request that failed:`, {
        method,
        url: target,
        headers: Object.fromEntries(Array.from(headers.entries())),
      });
    } catch (e) {
      console.log(`[TUS PROXY] Could not read 405 response body:`, e);
    }
  }
  
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
    console.log('[TUS PROXY] POST request received');
    console.log('[TUS PROXY] URL:', req.url);
    console.log('[TUS PROXY] Method:', req.method);
    console.log('[TUS PROXY] Headers:', Object.fromEntries(req.headers.entries()));
    
    const result = await handle('POST', req);
    console.log('[TUS PROXY] Response status:', result.status);
    return result;
  } catch (err: unknown) {
    console.error('[TUS PROXY] POST error:', err);
    const error = err as Error;
    const origin = req.headers.get('origin');
    return NextResponse.json({ 
      error: error?.message || 'Proxy error',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500, headers: corsHeaders(origin) });
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


// Route segment config
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes for large uploads

