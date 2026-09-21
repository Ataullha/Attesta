import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { createSession } from '@/lib/auth/session';
import { hashIp, hashPassword, randomToken, sha256Hex } from '@/lib/security/crypto';
import { clientIp, HttpError, json, readJson, route } from '@/lib/security/request';
import { rateLimit } from '@/lib/security/rate-limit';
import { emailConfigured, sendEmail, verifyEmailText } from '@/lib/email';
import { isDisposableEmail } from '@/lib/security/disposable';
import { site } from '@/lib/site';

const body = z.object({
  name: z.string().trim().min(2, 'Enter your name').max(80),
  email: z.email('Enter a valid email address').max(200),
  password: z.string().min(10, 'Use at least 10 characters').max(200),
});

export const POST = route(async (req) => {
  const ip = hashIp(await clientIp());
  await rateLimit(`register:${ip}`, 5, 3600);
  const parsed = body.safeParse(await readJson(req, 10_000));
  if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message ?? 'Check the form.');
  const email = parsed.data.email.toLowerCase();
  if (isDisposableEmail(email)) throw new HttpError(400, 'Use a permanent email address — temporary inboxes are not accepted.');

  const existing = await db().select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.email, email)).limit(1);
  if (existing.length) throw new HttpError(409, 'An account with this email already exists. Sign in instead.');

  const [user] = await db()
    .insert(schema.users)
    .values({
      name: parsed.data.name,
      email,
      passwordHash: await hashPassword(parsed.data.password),
      // Without an email provider there is no way to confirm addresses, so accounts start confirmed.
      emailVerifiedAt: emailConfigured() ? null : new Date(),
    })
    .returning({ id: schema.users.id });

  if (emailConfigured()) {
    const token = randomToken(32);
    await db().insert(schema.emailTokens).values({
      id: sha256Hex(token),
      userId: user.id,
      purpose: 'verify',
      expiresAt: new Date(Date.now() + 86400_000),
    });
    await sendEmail(email, `Confirm your email for ${site.name}`, verifyEmailText(parsed.data.name, `${site.url}/verify-email?token=${token}`));
  }
  await createSession(user.id);
  return json({ ok: true, needsVerification: emailConfigured() });
});
