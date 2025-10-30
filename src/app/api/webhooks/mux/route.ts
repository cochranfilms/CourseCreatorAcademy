import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const payload = await req.json();
  // TODO: verify Mux signature if configured, then update lesson asset status
  console.log('MUX webhook', payload?.type);
  return NextResponse.json({ received: true });
}

export const dynamic = 'force-dynamic';


