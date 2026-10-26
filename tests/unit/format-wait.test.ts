import { describe, expect, it } from 'vitest';
import { waitText } from '@/lib/format-wait';
import { HttpError, json } from '@/lib/security/request';
import { isUniqueViolation } from '@/lib/security/db-errors';

describe('waitText', () => {
  it.each([
    [1, 'a minute'],
    [45, 'a minute'],
    [60, 'a minute'],
    [61, '2 minutes'],
    [90, '2 minutes'],
    [600, '10 minutes'],
    [3540, '59 minutes'],
    [3600, 'an hour'],
    [3601, '2 hours'],
    [7200, '2 hours'],
    [86_400, '24 hours'],
  ])('%i seconds reads as "%s"', (seconds, text) => {
    expect(waitText(seconds)).toBe(text);
  });

  it('never understates the wait', () => {
    for (let s = 1; s < 20_000; s += 7) {
      const t = waitText(s);
      const n = /^\d+/.test(t) ? parseInt(t, 10) : 1;
      const seconds = t.includes('hour') ? n * 3600 : n * 60;
      expect(seconds, `${s}s -> "${t}"`).toBeGreaterThanOrEqual(s);
    }
  });
});

describe('Retry-After', () => {
  it('is sent as a header when an error carries a wait', async () => {
    const { route } = await import('@/lib/security/request');
    const handler = route(async () => {
      throw new HttpError(429, 'Slow down.', 'rate_limited', 120);
    });
    const res = await handler(new Request('http://localhost:3000/api/x'), undefined);
    expect(res.status).toBe(429);
    expect(res.headers.get('retry-after')).toBe('120');
    expect(await res.json()).toEqual({ error: 'Slow down.', code: 'rate_limited' });
  });

  it('is absent for errors that are not about waiting', async () => {
    expect(json({ ok: true }).headers.get('retry-after')).toBeNull();
  });
});

describe('isUniqueViolation', () => {
  it('recognises the Postgres code directly and when an ORM wraps it', () => {
    expect(isUniqueViolation({ code: '23505' })).toBe(true);
    expect(isUniqueViolation({ cause: { code: '23505' } })).toBe(true);
  });

  it('does not mistake other failures for a duplicate', () => {
    expect(isUniqueViolation({ code: '23503' })).toBe(false);
    expect(isUniqueViolation(new Error('boom'))).toBe(false);
    expect(isUniqueViolation(null)).toBe(false);
    expect(isUniqueViolation(undefined)).toBe(false);
  });
});
