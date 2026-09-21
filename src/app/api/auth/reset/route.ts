import { z } from 'zod';
import { and, eq, gt, isNull } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { hashPassword, sha256Hex } from '@/lib/security/crypto';
import { HttpError, json, readJson, route } from '@/lib/security/request';
import { createSession } from '@/lib/auth/session';

const body = z.object({ token: z.string().min(20).max(100), password: z.string().min(10, 'Use at least 10 characters').max(200) });

export const POST = route(async (req) => {
  const parsed = body.safeParse(await readJson(req, 2000));
  if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message ?? 'Check the form.');
  const id = sha256Hex(parsed.data.token);
  const [tok] = await db()
    .select()
    .from(schema.emailTokens)
    .where(and(eq(schema.emailTokens.id, id), eq(schema.emailTokens.purpose, 'reset'), isNull(schema.emailTokens.usedAt), gt(schema.emailTokens.expiresAt, new Date())))
    .limit(1);
  if (!tok) throw new HttpError(400, 'This reset link has expired or was already used. Ask for a new one.');
  await db().update(schema.emailTokens).set({ usedAt: new Date() }).where(eq(schema.emailTokens.id, id));
  await db()
    .update(schema.users)
    .set({ passwordHash: await hashPassword(parsed.data.password), emailVerifiedAt: new Date() })
    .where(eq(schema.users.id, tok.userId));
  // Sign out everywhere else, then sign in here.
  await db().delete(schema.sessions).where(eq(schema.sessions.userId, tok.userId));
  await createSession(tok.userId);
  return json({ ok: true });
});
