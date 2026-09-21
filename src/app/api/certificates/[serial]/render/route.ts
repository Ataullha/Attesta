import { and, eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { requireUser } from '@/lib/auth/session';
import { HttpError, json, route } from '@/lib/security/request';
import { normalizeSerial, verifyUrl } from '@/lib/signing';

type Ctx = { params: Promise<{ serial: string }> };

/** Everything the browser needs to re-draw a certificate the user issued. Owner only. */
export const GET = route<Ctx>(async (_req, ctx) => {
  const user = await requireUser();
  const serial = normalizeSerial((await ctx.params).serial);
  const [row] = await db()
    .select({ values: schema.certificates.values, design: schema.batches.design, revokedAt: schema.certificates.revokedAt })
    .from(schema.certificates)
    .innerJoin(schema.batches, eq(schema.batches.id, schema.certificates.batchId))
    .where(and(eq(schema.certificates.serial, serial), eq(schema.certificates.userId, user.id)))
    .limit(1);
  if (!row) throw new HttpError(404, 'Certificate not found.');
  return json({ serial, verifyUrl: verifyUrl(serial), design: row.design, values: row.values, revoked: !!row.revokedAt });
});
