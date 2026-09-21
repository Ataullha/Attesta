import { and, asc, eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { requireUser } from '@/lib/auth/session';
import { HttpError, json, route } from '@/lib/security/request';
import { verifyUrl } from '@/lib/signing';
import { isUuid } from '@/lib/validate';

type Ctx = { params: Promise<{ id: string }> };

export const GET = route<Ctx>(async (_req, ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  if (!isUuid(id)) throw new HttpError(404, 'Batch not found.');
  const [batch] = await db()
    .select()
    .from(schema.batches)
    .where(and(eq(schema.batches.id, id), eq(schema.batches.userId, user.id)))
    .limit(1);
  if (!batch) throw new HttpError(404, 'Batch not found.');
  const certs = await db()
    .select({ serial: schema.certificates.serial, values: schema.certificates.values })
    .from(schema.certificates)
    .where(eq(schema.certificates.batchId, id))
    .orderBy(asc(schema.certificates.issuedAt), asc(schema.certificates.id));
  return json({
    id: batch.id,
    name: batch.name,
    design: batch.design,
    certificates: certs.map((c) => ({ serial: c.serial, verifyUrl: verifyUrl(c.serial), values: c.values })),
  });
});
