import { eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { requireUser } from '@/lib/auth/session';
import { randomToken, sha256Hex } from '@/lib/security/crypto';
import { json, route } from '@/lib/security/request';
import { rateLimit } from '@/lib/security/rate-limit';
import { emailConfigured, sendEmail, verifyEmailText } from '@/lib/email';
import { site } from '@/lib/site';

export const POST = route(async () => {
  const user = await requireUser();
  if (user.emailVerified || !emailConfigured()) return json({ ok: true });
  await rateLimit(`resend:${user.id}`, 3, 3600);
  await db().delete(schema.emailTokens).where(eq(schema.emailTokens.userId, user.id));
  const token = randomToken(32);
  await db().insert(schema.emailTokens).values({ id: sha256Hex(token), userId: user.id, purpose: 'verify', expiresAt: new Date(Date.now() + 86400_000) });
  await sendEmail(user.email, `Confirm your email for ${site.name}`, verifyEmailText(user.name, `${site.url}/verify-email?token=${token}`));
  return json({ ok: true });
});
