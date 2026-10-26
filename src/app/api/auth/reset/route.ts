import { z } from 'zod';
import { and, eq, sql } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { audit } from '@/lib/audit';
import { createSession } from '@/lib/auth/session';
import { consumeEmailToken } from '@/lib/auth/tokens';
import { hashIp, hashPassword } from '@/lib/security/crypto';
import { clientIp, HttpError, json, readJson, route } from '@/lib/security/request';
import { rateLimit } from '@/lib/security/rate-limit';

const body = z.object({ token: z.string().min(20).max(100), password: z.string().min(10, 'Use at least 10 characters').max(200) });

export const POST = route(async (req) => {
  await rateLimit(`reset:${hashIp(await clientIp())}`, 10, 3600);
  const parsed = body.safeParse(await readJson(req, 2000));
  if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message ?? 'Check the form.');
  // Hashed before the transaction: scrypt is deliberately slow and must not hold row locks while it runs.
  const passwordHash = await hashPassword(parsed.data.password);

  const userId = await db().transaction(async (tx) => {
    // Spending the token is atomic, so a link can set a password once even if it is used many times at once.
    const id = await consumeEmailToken(parsed.data.token, 'reset', tx);
    if (!id) throw new HttpError(400, 'This reset link has expired or was already used. Ask for a new one.');
    const [user] = await tx.select({ bannedAt: schema.users.bannedAt }).from(schema.users).where(eq(schema.users.id, id)).limit(1);
    // A link emailed before an account was suspended must not reopen it (rolls the token back too).
    if (!user || user.bannedAt) throw new HttpError(403, 'This account has been suspended. Contact support if you think this is a mistake.');
    await tx
      .update(schema.users)
      // Being able to open the link proves the address, so it also counts as confirming it (keeping any earlier date).
      .set({ passwordHash, emailVerifiedAt: sql`coalesce(${schema.users.emailVerifiedAt}, now())` })
      .where(eq(schema.users.id, id));
    // Sign out everywhere, and void every other reset link that was emailed.
    await tx.delete(schema.sessions).where(eq(schema.sessions.userId, id));
    await tx.delete(schema.emailTokens).where(and(eq(schema.emailTokens.userId, id), eq(schema.emailTokens.purpose, 'reset')));
    return id;
  });

  await audit(userId, 'auth.password_reset', userId);
  await createSession(userId);
  return json({ ok: true });
});
