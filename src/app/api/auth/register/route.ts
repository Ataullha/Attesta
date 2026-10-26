import { z } from 'zod';
import { after } from 'next/server';
import { eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { createSession } from '@/lib/auth/session';
import { issueEmailToken } from '@/lib/auth/tokens';
import { hashIp, hashPassword } from '@/lib/security/crypto';
import { isUniqueViolation } from '@/lib/security/db-errors';
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

const EXISTS = 'An account with this email already exists. Sign in instead.';

export const POST = route(async (req) => {
  const ip = hashIp(await clientIp());
  await rateLimit(`register:${ip}`, 5, 3600);
  const parsed = body.safeParse(await readJson(req, 10_000));
  if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message ?? 'Check the form.');
  const email = parsed.data.email.toLowerCase();
  if (isDisposableEmail(email)) throw new HttpError(400, 'Use a permanent email address — temporary inboxes are not accepted.');

  // A cheap early answer that also skips the (deliberately slow) password hash for a known address.
  const existing = await db().select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.email, email)).limit(1);
  if (existing.length) throw new HttpError(409, EXISTS);

  const passwordHash = await hashPassword(parsed.data.password);
  const mailable = emailConfigured();
  let created: { id: string; verifyToken: string | null };
  try {
    // The account and its confirmation token are created together or not at all.
    created = await db().transaction(async (tx) => {
      const [user] = await tx
        .insert(schema.users)
        .values({
          name: parsed.data.name,
          email,
          passwordHash,
          // Without an email provider there is no way to confirm addresses, so accounts start confirmed.
          emailVerifiedAt: mailable ? null : new Date(),
        })
        .returning({ id: schema.users.id });
      return { id: user.id, verifyToken: mailable ? await issueEmailToken(user.id, 'verify', tx) : null };
    });
  } catch (err) {
    // Two sign-ups for one address can both pass the check above; the unique index is what decides.
    if (isUniqueViolation(err)) throw new HttpError(409, EXISTS);
    throw err;
  }

  // Sent once the response is on its way, so a slow or failing mail provider cannot fail the sign-up.
  // (The dashboard offers "send the link again" if it never arrives.)
  if (created.verifyToken) {
    const link = `${site.url}/verify-email?token=${created.verifyToken}`;
    after(() => sendEmail(email, `Confirm your email for ${site.name}`, verifyEmailText(parsed.data.name, link)));
  }
  await createSession(created.id);
  return json({ ok: true, needsVerification: mailable });
});
