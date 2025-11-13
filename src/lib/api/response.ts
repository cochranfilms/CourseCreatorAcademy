import { NextResponse } from 'next/server';

export function ok(data: Record<string, unknown> = {}, init?: number | ResponseInit) {
  return NextResponse.json({ success: true, ...data }, init);
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

import { NextResponse } from 'next/server';

type ErrorBody = { error: string; code?: string; details?: unknown };

export const ok = (body: unknown, init?: number) =>
  NextResponse.json(body, { status: init ?? 200 });

export const badRequest = (message: string, details?: unknown) =>
  NextResponse.json({ error: message, details } as ErrorBody, { status: 400 });

export const unauthorized = (message = 'Unauthorized') =>
  NextResponse.json({ error: message } as ErrorBody, { status: 401 });

export const forbidden = (message = 'Forbidden') =>
  NextResponse.json({ error: message } as ErrorBody, { status: 403 });

export const notFound = (message = 'Not found') =>
  NextResponse.json({ error: message } as ErrorBody, { status: 404 });

export const serverError = (message: string, details?: unknown) =>
  NextResponse.json({ error: message, details } as ErrorBody, { status: 500 });

export function handleApiError(error: unknown, fallback = 'Internal server error') {
  const message = (error as any)?.message || fallback;
  // eslint-disable-next-line no-console
  console.error(message, error);
  return serverError(message);
}


