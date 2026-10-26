import 'server-only';
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';

export async function clientIp() {
  const h = await headers();
  const fwd = h.get('x-forwarded-for');
  return (fwd?.split(',')[0] ?? h.get('x-real-ip') ?? '0.0.0.0').trim();
}

/**
 * CSRF defence for every state-changing route: the browser must say the request
 * came from our own origin. Session cookies are also SameSite=Lax.
 */
export function isSameOrigin(req: Request) {
  const site = req.headers.get('sec-fetch-site');
  if (site && site !== 'same-origin' && site !== 'none') return false;
  const origin = req.headers.get('origin');
  if (!origin) return site === 'same-origin';
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host');
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
    /** Seconds until the request may be retried; sent as the Retry-After header. */
    public retryAfter?: number,
  ) {
    super(message);
  }
}

export function json(data: unknown, status = 200, headers: Record<string, string> = {}) {
  return NextResponse.json(data, { status, headers: { 'Cache-Control': 'no-store', ...headers } });
}

/** Wraps a route handler with origin checks and uniform error responses. */
export function route<Ctx = unknown>(
  handler: (req: Request, ctx: Ctx) => Promise<Response>,
  opts: { mutating?: boolean } = {},
) {
  return async (req: Request, ctx: Ctx) => {
    try {
      const mutating = opts.mutating ?? req.method !== 'GET';
      if (mutating && !isSameOrigin(req)) throw new HttpError(403, 'This request did not come from this site.');
      return await handler(req, ctx);
    } catch (err) {
      if (err instanceof HttpError) {
        return json({ error: err.message, code: err.code }, err.status, err.retryAfter ? { 'Retry-After': String(err.retryAfter) } : {});
      }
      console.error(err);
      return json({ error: 'Something went wrong on our side. Try again in a moment.' }, 500);
    }
  };
}

export async function readJson(req: Request, maxBytes = 1_000_000): Promise<unknown> {
  const len = Number(req.headers.get('content-length') ?? 0);
  if (len > maxBytes) throw new HttpError(413, 'Request is too large.');
  const text = await req.text();
  if (text.length > maxBytes) throw new HttpError(413, 'Request is too large.');
  try {
    return JSON.parse(text);
  } catch {
    throw new HttpError(400, 'Request body is not valid JSON.');
  }
}
