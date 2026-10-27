import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { createSession } from '@/lib/auth/session';
import { googleConfigured } from '@/lib/auth/google';
import { DUMMY_PASSWORD_HASH, hashIp, verifyPassword } from '@/lib/security/crypto';
import { clientIp, HttpError, json, readJson, route } from '@/lib/security/request';
import { rateLimit } from '@/lib/security/rate-limit';

const body = z.object({ email: z.email().max(200), password: z.string().min(1).max(200) });

export const POST = route(async (req) => {
  const parsed = body.safeParse(await readJson(req, 10_000));
  if (!parsed.success) throw new HttpError(400, 'Enter your email and password.');
  const email = parsed.data.email.toLowerCase();
  const ip = hashIp(await clientIp());
  await rateLimit(`login:ip:${ip}`, 20, 900);
  await rateLimit(`login:email:${email}`, 8, 900);

  const [user] = await db().select().from(schema.users).where(eq(schema.users.email, email)).limit(1);
  const ok = await verifyPassword(parsed.data.password, user?.passwordHash ?? DUMMY_PASSWORD_HASH);
  // One answer for an unknown address, a wrong password and an account with no password (it signs in with
  // Google), so the answer says nothing about which addresses have accounts.
  if (!user || !ok) {
    throw new HttpError(401, `That email and password do not match an account.${googleConfigured() ? ' If you signed up with Google, use “Continue with Google”.' : ''}`);
  }
  if (user.bannedAt) throw new HttpError(403, 'This account has been suspended. Contact support if you think this is a mistake.');
  await createSession(user.id);
  return json({ ok: true, role: user.role });
});
