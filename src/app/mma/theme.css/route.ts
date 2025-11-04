export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const base = process.env.MMA_API_BASE;
    const key = process.env.MMA_API_KEY as string | undefined;
    if (!base || !key) {
      // Gracefully degrade with empty CSS instead of a 500
      return new Response('', { headers: { 'Content-Type': 'text/css; charset=utf-8' } });
    }
    const r = await fetch(`${base}/api/v1/edu/templates/css`, {
      headers: { 'x-mma-key': key },
      cache: 'no-store',
    });
    if (!r.ok) {
      return new Response('', { headers: { 'Content-Type': 'text/css; charset=utf-8' } });
    }
    const css = await r.text();
    return new Response(css, { headers: { 'Content-Type': 'text/css; charset=utf-8' } });
  } catch {
    return new Response('', { headers: { 'Content-Type': 'text/css; charset=utf-8' } });
  }
}


