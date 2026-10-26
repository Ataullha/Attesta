import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { db, schema } from '@/lib/db';
import { consumeEmailToken, issueEmailToken } from '@/lib/auth/tokens';
import { sha256Hex } from '@/lib/security/crypto';
import { hasDb, makeUser } from './helpers';

describe.skipIf(!hasDb)('one-time email tokens (real Postgres)', () => {
  it('stores only a hash of the token, never the token', async () => {
    const user = await makeUser();
    const token = await issueEmailToken(user.id, 'reset');
    const rows = await db().select().from(schema.emailTokens).where(eq(schema.emailTokens.userId, user.id));
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(sha256Hex(token));
    expect(rows[0].id).not.toBe(token);
    expect(JSON.stringify(rows)).not.toContain(token);
  });

  it('can be spent once, by whoever holds it', async () => {
    const user = await makeUser();
    const token = await issueEmailToken(user.id, 'verify');
    expect(await consumeEmailToken(token, 'verify')).toBe(user.id);
    expect(await consumeEmailToken(token, 'verify')).toBeNull();
  });

  it('is only good for the purpose it was issued for', async () => {
    const user = await makeUser();
    const resetToken = await issueEmailToken(user.id, 'reset');
    expect(await consumeEmailToken(resetToken, 'verify')).toBeNull();
    // ...and the failed attempt must not have used it up.
    expect(await consumeEmailToken(resetToken, 'reset')).toBe(user.id);
  });

  it('is refused once it has expired, and when it never existed', async () => {
    const user = await makeUser();
    const token = await issueEmailToken(user.id, 'reset');
    await db().update(schema.emailTokens).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(schema.emailTokens.id, sha256Hex(token)));
    expect(await consumeEmailToken(token, 'reset')).toBeNull();
    expect(await consumeEmailToken('x'.repeat(43), 'reset')).toBeNull();
  });

  // The regression this guards: select-then-update let 9 of 10 simultaneous requests spend one token.
  it('lets exactly one of many simultaneous spends win', async () => {
    const user = await makeUser();
    const token = await issueEmailToken(user.id, 'reset');
    const results = await Promise.all(Array.from({ length: 25 }, () => consumeEmailToken(token, 'reset')));
    expect(results.filter((r) => r === user.id)).toHaveLength(1);
    expect(results.filter((r) => r === null)).toHaveLength(24);
  });

  it('is spent only if the surrounding transaction commits', async () => {
    const user = await makeUser();
    const token = await issueEmailToken(user.id, 'reset');
    await expect(
      db().transaction(async (tx) => {
        expect(await consumeEmailToken(token, 'reset', tx)).toBe(user.id);
        throw new Error('something later in the request failed');
      }),
    ).rejects.toThrow('something later');
    expect(await consumeEmailToken(token, 'reset')).toBe(user.id);
  });
});
