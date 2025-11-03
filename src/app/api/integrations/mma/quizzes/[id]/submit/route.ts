import { NextRequest, NextResponse } from 'next/server';
import { mmaClient } from '@/lib/mmaClient';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params;
    const body = await req.json().catch(() => ({}));
    const answers = Array.isArray(body?.answers) ? body.answers : undefined;
    if (!answers || !answers.every((n: any) => typeof n === 'number')) {
      return NextResponse.json({ error: 'Invalid body: { answers: number[] } required' }, { status: 400 });
    }

    const incomingKey = req.headers.get('idempotency-key') || undefined;
    const data = await mmaClient.submitQuiz(id, answers, incomingKey);
    return NextResponse.json(data, { status: 200 });
  } catch (err) {
    const message = (err as any)?.message || 'Failed to submit quiz';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}


