import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { db, schema } from '@/lib/db';
import { countOtherSessions, endOtherSessions } from '@/lib/auth/session';
import { hasDb, makeUser } from './helpers';

const inDays = (d: number) => new Date(Date.now() + d * 86_400_000);

async function addSession(userId: string, expiresAt = inDays(30)) {
  const id = randomUUID();
  await db().insert(schema.sessions).values({ id, userId, expiresAt });
  return id;
}
const idsOf = async (userId: string) => (await db().select({ id: schema.sessions.id }).from(schema.sessions).where(eq(schema.sessions.userId, userId))).map((r) => r.id).sort();

describe.skipIf(!hasDb)('signing out other devices (real Postgres)', () => {
  it('counts only the other, still-valid sessions', async () => {
    const user = await makeUser();
    const here = await addSession(user.id);
    await addSession(user.id);
    await addSession(user.id);
    await addSession(user.id, inDays(-1)); // already expired: not a device that is signed in any more
    expect(await countOtherSessions(user.id, here)).toBe(2);
    expect(await countOtherSessions(user.id, null)).toBe(3);
  });

  it('ends every other session but keeps the one making the request', async () => {
    const user = await makeUser();
    const here = await addSession(user.id);
    await addSession(user.id);
    await addSession(user.id);
    expect(await endOtherSessions(user.id, here)).toBe(2);
    expect(await idsOf(user.id)).toEqual([here]);
  });

  it("never touches another user's sessions", async () => {
    const me = await makeUser();
    const someoneElse = await makeUser();
    const mine = await addSession(me.id);
    const theirs = await addSession(someoneElse.id);
    await endOtherSessions(me.id, mine);
    expect(await idsOf(someoneElse.id)).toEqual([theirs]);
  });

  it('ends everything when there is no current session to keep', async () => {
    const user = await makeUser();
    await addSession(user.id);
    await addSession(user.id);
    expect(await endOtherSessions(user.id, null)).toBe(2);
    expect(await idsOf(user.id)).toEqual([]);
  });

  it('is a harmless no-op when there is nobody else', async () => {
    const user = await makeUser();
    const here = await addSession(user.id);
    expect(await endOtherSessions(user.id, here)).toBe(0);
    expect(await idsOf(user.id)).toEqual([here]);
  });
});
