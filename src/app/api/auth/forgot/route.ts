import { z } from 'zod';
import { after } from 'next/server';
import { eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { issueEmailToken } from '@/lib/auth/tokens';
import { hashIp } from '@/lib/security/crypto';
import { clientIp, json, readJson, route } from '@/lib/security/request';
import { rateLimit } from '@/lib/security/rate-limit';
import { resetEmailText, sendEmail } from '@/lib/email';
import { site } from '@/lib/site';

const body = z.object({ email: z.email().max(200) });

export const POST = route(async (req) => {
  await rateLimit(`forgot:${hashIp(await clientIp())}`, 5, 3600);
  const parsed = body.safeParse(await readJson(req, 2000));
  // Always answer the same way so this form can't be used to discover accounts.
  if (!parsed.success) return json({ ok: true });
  const email = parsed.data.email.toLowerCase();

  // Everything that differs between "this address has an account" and "it doesn't" - the lookup, the
  // token, the email - happens after the response is sent. The answer is therefore identical and
  // arrives in the same time, and a mail outage cannot turn it into an error that gives the game away.
  after(async () => {
    try {
      const [user] = await db().select().from(schema.users).where(eq(schema.users.email, email)).limit(1);
      if (!user || user.bannedAt) return;
      const token = await issueEmailToken(user.id, 'reset');
      await sendEmail(email, `Reset your ${site.name} password`, resetEmailText(user.name, `${site.url}/reset-password?token=${token}`));
    } catch (err) {
      console.error('Password reset email could not be prepared', err);
    }
  });
  return json({ ok: true });
});
