import { z } from 'zod';
import { and, count, eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { requireVerifiedUser } from '@/lib/auth/session';
import { isUniqueViolation } from '@/lib/security/db-errors';
import { HttpError, json, readJson, route } from '@/lib/security/request';
import { rateLimit } from '@/lib/security/rate-limit';
import { packages, paymentMethods } from '@/lib/site';
import { awaitingReview } from '@/lib/payments/online';

const body = z.object({
  packageId: z.string(),
  method: z.enum(paymentMethods.map((m) => m.id) as [string, ...string[]]),
  trxId: z.string().trim().min(4, 'Enter the transaction ID from your payment receipt').max(60).regex(/^[A-Za-z0-9-]+$/, 'Transaction IDs use letters and numbers only'),
  sender: z.string().trim().min(4, 'Enter the number or account you paid from').max(60),
});

export const POST = route(async (req) => {
  const user = await requireVerifiedUser();
  await rateLimit(`billing:${user.id}`, 10, 3600);
  const parsed = body.safeParse(await readJson(req, 4000));
  if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message ?? 'Check the form.');
  const pkg = packages.find((p) => p.id === parsed.data.packageId);
  if (!pkg) throw new HttpError(400, 'Choose a package.');
  const [{ n }] = await db()
    .select({ n: count() })
    .from(schema.payments)
    .where(and(eq(schema.payments.userId, user.id), awaitingReview));
  if (Number(n) >= 3) throw new HttpError(400, 'You already have three payments waiting for review. We’ll process those first.');
  try {
    await db().insert(schema.payments).values({
      userId: user.id,
      packageId: pkg.id,
      credits: pkg.credits,
      amount: pkg.price,
      currency: pkg.currency,
      method: parsed.data.method,
      trxId: parsed.data.trxId.toUpperCase(),
      sender: parsed.data.sender,
    });
  } catch (err) {
    if (isUniqueViolation(err)) throw new HttpError(409, 'That transaction ID has already been submitted.');
    throw err;
  }
  return json({ ok: true });
});
