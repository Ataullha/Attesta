import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { audit } from '@/lib/audit';
import { currentSessionId, endOtherSessions, requireUser } from '@/lib/auth/session';
import { hashPassword, verifyPassword } from '@/lib/security/crypto';
import { HttpError, json, readJson, route } from '@/lib/security/request';
import { rateLimit } from '@/lib/security/rate-limit';

const body = z.object({
  currentPassword: z.string().min(1, 'Enter your current password').max(200),
  newPassword: z.string().min(10, 'Use at least 10 characters').max(200),
});

/** Change the password of the signed-in account. Other devices are signed out; this one stays signed in. */
export const POST = route(async (req) => {
  const user = await requireUser();
  // Someone holding a stolen session must not be able to guess the current password at leisure.
  await rateLimit(`password:${user.id}`, 5, 900);
  const parsed = body.safeParse(await readJson(req, 2000));
  if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message ?? 'Check the form.');
  const { currentPassword, newPassword } = parsed.data;
  if (currentPassword === newPassword) throw new HttpError(400, 'Choose a new password that is different from the current one.');

  const [row] = await db().select({ hash: schema.users.passwordHash }).from(schema.users).where(eq(schema.users.id, user.id)).limit(1);
  if (row && !row.hash) {
    throw new HttpError(400, 'This account signs in with Google and has no password yet. To add one, use “Forgot your password?” on the sign-in page.', 'no_password');
  }
  if (!row?.hash || !(await verifyPassword(currentPassword, row.hash))) throw new HttpError(403, 'Your current password is not right.', 'wrong_password');

  await db()
    .update(schema.users)
    .set({ passwordHash: await hashPassword(newPassword) })
    .where(eq(schema.users.id, user.id));
  const signedOutElsewhere = await endOtherSessions(user.id, await currentSessionId());
  await audit(user.id, 'auth.password_change', user.id, { sessionsEnded: signedOutElsewhere });
  return json({ ok: true, signedOutElsewhere });
});
