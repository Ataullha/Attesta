import { z } from 'zod';
import { and, eq, gt, isNull } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { sha256Hex } from '@/lib/security/crypto';
import { HttpError, json, readJson, route } from '@/lib/security/request';

const body = z.object({ token: z.string().min(20).max(100) });

export const POST = route(async (req) => {
  const parsed = body.safeParse(await readJson(req, 2000));
  if (!parsed.success) throw new HttpError(400, 'This link is incomplete.');
  const id = sha256Hex(parsed.data.token);
  const [tok] = await db()
    .select()
    .from(schema.emailTokens)
    .where(and(eq(schema.emailTokens.id, id), eq(schema.emailTokens.purpose, 'verify'), isNull(schema.emailTokens.usedAt), gt(schema.emailTokens.expiresAt, new Date())))
    .limit(1);
  if (!tok) throw new HttpError(400, 'This link has expired or was already used. Sign in and ask for a new one.');
  await db().update(schema.emailTokens).set({ usedAt: new Date() }).where(eq(schema.emailTokens.id, id));
  await db().update(schema.users).set({ emailVerifiedAt: new Date() }).where(eq(schema.users.id, tok.userId));
  return json({ ok: true });
});
