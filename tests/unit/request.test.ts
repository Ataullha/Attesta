import { afterEach, describe, expect, it, vi } from 'vitest';
import { HttpError, isSameOrigin, json, readJson, route } from '@/lib/security/request';

const SITE = 'http://localhost:3000';
const post = (headers: Record<string, string> = {}, body?: string) =>
  new Request(`${SITE}/api/thing`, { method: 'POST', headers, body });

afterEach(() => vi.restoreAllMocks());

describe('isSameOrigin (CSRF defence)', () => {
  it('accepts what a browser sends from our own pages', () => {
    expect(isSameOrigin(post({ 'sec-fetch-site': 'same-origin', origin: SITE, host: 'localhost:3000' }))).toBe(true);
    expect(isSameOrigin(post({ origin: SITE, host: 'localhost:3000' }))).toBe(true);
    expect(isSameOrigin(post({ 'sec-fetch-site': 'same-origin' }))).toBe(true);
    expect(isSameOrigin(post({ 'sec-fetch-site': 'none' , origin: SITE, host: 'localhost:3000' }))).toBe(true);
  });

  it.each(['cross-site', 'same-site'])('refuses Sec-Fetch-Site: %s even if the Origin looks right', (site) => {
    expect(isSameOrigin(post({ 'sec-fetch-site': site, origin: SITE, host: 'localhost:3000' }))).toBe(false);
  });

  it('refuses a different Origin, a malformed one, and the literal "null" sent by sandboxed frames', () => {
    expect(isSameOrigin(post({ origin: 'https://evil.example', host: 'localhost:3000' }))).toBe(false);
    expect(isSameOrigin(post({ origin: 'http://localhost:3000.evil.example', host: 'localhost:3000' }))).toBe(false);
    expect(isSameOrigin(post({ origin: 'not a url', host: 'localhost:3000' }))).toBe(false);
    expect(isSameOrigin(post({ origin: 'null', host: 'localhost:3000' }))).toBe(false);
  });

  it('refuses a request that says nothing about where it came from', () => {
    expect(isSameOrigin(post({ host: 'localhost:3000' }))).toBe(false);
  });

  it('compares against the forwarded host when behind a proxy', () => {
    const headers = { origin: 'https://certs.example.com', host: 'internal:3000', 'x-forwarded-host': 'certs.example.com' };
    expect(isSameOrigin(post(headers))).toBe(true);
    expect(isSameOrigin(post({ ...headers, origin: 'https://other.example.com' }))).toBe(false);
  });
});

describe('route()', () => {
  const ok = route(async () => json({ fine: true }));
  const quiet = () => vi.spyOn(console, 'error').mockImplementation(() => {});

  it('refuses a cross-site POST before the handler runs', async () => {
    const handler = vi.fn(async () => json({ ran: true }));
    const res = await route(handler)(post({ 'sec-fetch-site': 'cross-site' }), undefined);
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'This request did not come from this site.' });
    expect(handler).not.toHaveBeenCalled();
  });

  it('lets same-origin writes through and marks every answer uncacheable', async () => {
    const res = await ok(post({ 'sec-fetch-site': 'same-origin' }), undefined);
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(await res.json()).toEqual({ fine: true });
  });

  it('does not demand an Origin on reads', async () => {
    const res = await ok(new Request(`${SITE}/api/thing`), undefined);
    expect(res.status).toBe(200);
  });

  it('honours mutating:false for a POST that is safe to call cross-site', async () => {
    const open = route(async () => json({ ok: true }), { mutating: false });
    expect((await open(post(), undefined)).status).toBe(200);
  });

  it('turns an HttpError into its status, message and code', async () => {
    const h = route(async () => {
      throw new HttpError(402, 'Buy a package.', 'needs_package');
    });
    const res = await h(post({ 'sec-fetch-site': 'same-origin' }), undefined);
    expect(res.status).toBe(402);
    expect(await res.json()).toEqual({ error: 'Buy a package.', code: 'needs_package' });
  });

  it('tells the client when it may try again, only when it knows', async () => {
    const limited = route(async () => {
      throw new HttpError(429, 'Slow down.', 'rate_limited', 90);
    });
    const res = await limited(post({ 'sec-fetch-site': 'same-origin' }), undefined);
    expect(res.status).toBe(429);
    expect(res.headers.get('retry-after')).toBe('90');
    const refused = route(async () => {
      throw new HttpError(402, 'Buy a package.', 'needs_package');
    });
    expect((await refused(post({ 'sec-fetch-site': 'same-origin' }), undefined)).headers.get('retry-after')).toBeNull();
  });

  it('hides the cause of an unexpected failure from the client but logs it', async () => {
    const log = quiet();
    const h = route(async () => {
      throw new Error('connect ECONNREFUSED postgres://admin:hunter2@db.internal/prod');
    });
    const res = await h(post({ 'sec-fetch-site': 'same-origin' }), undefined);
    const text = await res.text();
    expect(res.status).toBe(500);
    expect(text).not.toMatch(/hunter2|postgres|ECONNREFUSED/);
    expect(log).toHaveBeenCalled();
  });
});

describe('readJson', () => {
  it('parses valid JSON', async () => {
    expect(await readJson(post({}, '{"a":[1,2]}'))).toEqual({ a: [1, 2] });
  });

  it('answers 400 for invalid JSON and an empty body', async () => {
    await expect(readJson(post({}, '{nope'))).rejects.toMatchObject({ status: 400 });
    await expect(readJson(post({}, ''))).rejects.toMatchObject({ status: 400 });
  });

  it('answers 413 for a body over the limit, whether or not Content-Length was honest', async () => {
    await expect(readJson(post({ 'content-length': '5000' }, '{}'), 100)).rejects.toMatchObject({ status: 413 });
    await expect(readJson(post({}, JSON.stringify({ pad: 'x'.repeat(500) })), 100)).rejects.toMatchObject({ status: 413 });
  });
});
