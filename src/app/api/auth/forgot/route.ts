import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { hashIp, randomToken, sha256Hex } from '@/lib/security/crypto';
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
  const [user] = await db().select().from(schema.users).where(eq(schema.users.email, email)).limit(1);
  if (user && !user.bannedAt) {
    const token = randomToken(32);
    await db().insert(schema.emailTokens).values({ id: sha256Hex(token), userId: user.id, purpose: 'reset', expiresAt: new Date(Date.now() + 3600_000) });
    await sendEmail(email, `Reset your ${site.name} password`, resetEmailText(user.name, `${site.url}/reset-password?token=${token}`));
  }
  return json({ ok: true });
});
