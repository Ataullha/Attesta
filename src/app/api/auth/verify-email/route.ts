import { z } from 'zod';
import { and, eq, sql } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { consumeEmailToken } from '@/lib/auth/tokens';
import { hashIp, sha256Hex } from '@/lib/security/crypto';
import { clientIp, HttpError, json, readJson, route } from '@/lib/security/request';
import { rateLimit } from '@/lib/security/rate-limit';

const body = z.object({ token: z.string().min(20).max(100) });

export const POST = route(async (req) => {
  await rateLimit(`verify:${hashIp(await clientIp())}`, 30, 3600);
  const parsed = body.safeParse(await readJson(req, 2000));
  if (!parsed.success) throw new HttpError(400, 'This link is incomplete.');

  const userId = await consumeEmailToken(parsed.data.token, 'verify');
  if (userId) {
    await db()
      .update(schema.users)
      .set({ emailVerifiedAt: sql`coalesce(${schema.users.emailVerifiedAt}, now())` })
      .where(eq(schema.users.id, userId));
    return json({ ok: true });
  }

  // A spent link is not an error if it did its job: mail scanners open links before people do, and
  // people open the same link twice. Say "confirmed" when the address it was for is confirmed.
  const [row] = await db()
    .select({ verified: schema.users.emailVerifiedAt })
    .from(schema.emailTokens)
    .innerJoin(schema.users, eq(schema.users.id, schema.emailTokens.userId))
    .where(and(eq(schema.emailTokens.id, sha256Hex(parsed.data.token)), eq(schema.emailTokens.purpose, 'verify')))
    .limit(1);
  if (row?.verified) return json({ ok: true });
  throw new HttpError(400, 'This link has expired or was already used. Sign in and ask for a new one.');
});
