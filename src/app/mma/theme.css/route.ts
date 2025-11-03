export const dynamic = 'force-dynamic';

export async function GET() {
  const r = await fetch(`${process.env.MMA_API_BASE}/api/v1/edu/templates/css`, {
    headers: { 'x-mma-key': process.env.MMA_API_KEY as string },
    cache: 'no-store',
  });
  const css = await r.text();
  return new Response(css, { headers: { 'Content-Type': 'text/css; charset=utf-8' } });
}


