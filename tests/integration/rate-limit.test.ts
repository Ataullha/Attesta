import { randomUUID } from 'node:crypto';
import { eq, sql } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { db, schema } from '@/lib/db';
import { rateLimit } from '@/lib/security/rate-limit';
import { HttpError } from '@/lib/security/request';
import { hasDb } from './helpers';

const failure = (p: Promise<unknown>) => p.then(() => null, (e: unknown) => e);

describe.skipIf(!hasDb)('rateLimit (real Postgres)', () => {
  it('allows `max` calls, then refuses with how long to wait', async () => {
    const key = `test:${randomUUID()}`;
    for (let i = 0; i < 3; i++) await rateLimit(key, 3, 600);
    const err = (await failure(rateLimit(key, 3, 600))) as HttpError;
    expect(err).toBeInstanceOf(HttpError);
    expect(err.status).toBe(429);
    expect(err.code).toBe('rate_limited');
    expect(err.retryAfter).toBeGreaterThan(590);
    expect(err.retryAfter).toBeLessThanOrEqual(600);
    expect(err.message).toBe('Too many attempts. Try again in 10 minutes.');
  });

  it('keeps separate keys separate', async () => {
    const a = `test:${randomUUID()}`;
    const b = `test:${randomUUID()}`;
    await rateLimit(a, 1, 60);
    expect(await failure(rateLimit(a, 1, 60))).toBeInstanceOf(HttpError);
    await expect(rateLimit(b, 1, 60)).resolves.toBeUndefined();
  });

  it('starts a fresh window once the old one has ended', async () => {
    const key = `test:${randomUUID()}`;
    await rateLimit(key, 1, 60);
    expect(await failure(rateLimit(key, 1, 60))).toBeInstanceOf(HttpError);
    await db().update(schema.rateLimits).set({ resetAt: sql`now() - interval '1 second'` }).where(eq(schema.rateLimits.key, key));
    await expect(rateLimit(key, 1, 60)).resolves.toBeUndefined();
    const [row] = await db().select().from(schema.rateLimits).where(eq(schema.rateLimits.key, key));
    expect(row.count).toBe(1);
  });

  // A sliding window would let someone who keeps trying stay locked out for ever, and would let a patient
  // attacker's counter never reset: the end of the window is set by the first attempt and nothing later moves it.
  it('keeps the window fixed: later attempts do not push its end back', async () => {
    const key = `test:${randomUUID()}`;
    await rateLimit(key, 5, 600);
    await db().update(schema.rateLimits).set({ resetAt: sql`now() + interval '30 seconds'` }).where(eq(schema.rateLimits.key, key));
    await rateLimit(key, 5, 600);
    const [row] = await db().select({ left: sql<number>`extract(epoch from (reset_at - now()))::float` }).from(schema.rateLimits).where(eq(schema.rateLimits.key, key));
    expect(row.left).toBeGreaterThan(25);
    expect(row.left).toBeLessThanOrEqual(30);
  });

  it('counts exactly under concurrency, so parallel requests cannot slip past the limit', async () => {
    const key = `test:${randomUUID()}`;
    const outcomes = await Promise.all(Array.from({ length: 40 }, () => failure(rateLimit(key, 10, 60))));
    expect(outcomes.filter((o) => o === null)).toHaveLength(10);
    expect(outcomes.filter((o) => o instanceof HttpError)).toHaveLength(30);
  });
});
