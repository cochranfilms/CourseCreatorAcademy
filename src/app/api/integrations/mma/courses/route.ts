import { NextResponse } from 'next/server';
import { mmaClient } from '@/lib/mmaClient';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const data = await mmaClient.getCourses();
    return NextResponse.json(data, { status: 200 });
  } catch (err) {
    const message = (err as any)?.message || 'Failed to fetch courses';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}


