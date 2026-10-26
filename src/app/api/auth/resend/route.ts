import { after } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { requireUser } from '@/lib/auth/session';
import { issueEmailToken } from '@/lib/auth/tokens';
import { json, route } from '@/lib/security/request';
import { rateLimit } from '@/lib/security/rate-limit';
import { emailConfigured, sendEmail, verifyEmailText } from '@/lib/email';
import { site } from '@/lib/site';

export const POST = route(async () => {
  const user = await requireUser();
  if (user.emailVerified || !emailConfigured()) return json({ ok: true });
  await rateLimit(`resend:${user.id}`, 3, 3600);
  // Replace the earlier confirmation links only - a password-reset link still in someone's inbox must survive.
  await db().delete(schema.emailTokens).where(and(eq(schema.emailTokens.userId, user.id), eq(schema.emailTokens.purpose, 'verify')));
  const token = await issueEmailToken(user.id, 'verify');
  after(() => sendEmail(user.email, `Confirm your email for ${site.name}`, verifyEmailText(user.name, `${site.url}/verify-email?token=${token}`)));
  return json({ ok: true });
});
