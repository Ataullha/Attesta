import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { requireVerifiedUser } from '@/lib/auth/session';
import { HttpError, json, readJson, route } from '@/lib/security/request';
import { rateLimit } from '@/lib/security/rate-limit';
import { packages } from '@/lib/site';
import { GatewayError, newTranId, sslcommerzConfigured, startSession } from '@/lib/payments/sslcommerz';
import { ONLINE, unpaidCheckout } from '@/lib/payments/online';

const body = z.object({
  packageId: z.string(),
  // SSLCommerz asks for a phone number with every payment.
  phone: z
    .string()
    .transform((s) => s.replace(/[\s()-]/g, ''))
    .pipe(z.string().regex(/^\+?\d{6,15}$/, 'Enter your mobile number, for example 01712345678.')),
});

/** Opens an SSLCommerz checkout for a package and answers with the payment page to send the customer to. */
export const POST = route(async (req) => {
  if (!sslcommerzConfigured()) throw new HttpError(404, 'Online payment isn’t available. Send the money yourself instead.');
  const user = await requireVerifiedUser();
  await rateLimit(`checkout:${user.id}`, 10, 3600);
  const parsed = body.safeParse(await readJson(req, 2000));
  if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message ?? 'Check the form.');
  const pkg = packages.find((p) => p.id === parsed.data.packageId);
  if (!pkg) throw new HttpError(400, 'Choose a package.');

  const p = schema.payments;
  // One open checkout at a time, so the history doesn't fill with abandoned ones. If an earlier one
  // is paid after all, SSLCommerz's confirmation still settles it.
  await db().update(p).set({ status: 'cancelled' }).where(and(eq(p.userId, user.id), eq(p.status, 'pending'), unpaidCheckout));
  const tranId = newTranId();
  const [row] = await db()
    .insert(p)
    .values({ userId: user.id, packageId: pkg.id, credits: pkg.credits, amount: pkg.price, currency: pkg.currency, method: ONLINE, trxId: tranId, sender: parsed.data.phone, gateway: {} })
    .returning({ id: p.id });
  try {
    const { gatewayUrl, sessionkey } = await startSession(tranId, pkg, { name: user.name.slice(0, 50) || user.email, email: user.email, phone: parsed.data.phone });
    await db().update(p).set({ gateway: { sessionkey } }).where(eq(p.id, row.id));
    return json({ url: gatewayUrl });
  } catch (err) {
    // The customer never reached the payment page, so there is nothing to keep.
    await db().delete(p).where(eq(p.id, row.id));
    if (!(err instanceof GatewayError)) throw err;
    console.error(err.message);
    throw new HttpError(502, 'The payment page couldn’t be opened. Try again in a few minutes, or send the money yourself instead.');
  }
});
