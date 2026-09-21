import { z } from 'zod';
import { and, eq, isNull } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { requireAdmin } from '@/lib/auth/session';
import { HttpError, json, readJson, route } from '@/lib/security/request';
import { normalizeSerial } from '@/lib/signing';
import { audit } from '@/lib/audit';

type Ctx = { params: Promise<{ serial: string }> };
const body = z.object({ action: z.literal('revoke'), reason: z.string().trim().min(3).max(300) });

export const POST = route<Ctx>(async (req, ctx) => {
  const admin = await requireAdmin();
  const serial = normalizeSerial((await ctx.params).serial);
  const parsed = body.safeParse(await readJson(req, 2000));
  if (!parsed.success) throw new HttpError(400, 'Give a reason.');
  const rows = await db()
    .update(schema.certificates)
    .set({ revokedAt: new Date(), revokeReason: `${parsed.data.reason} (revoked by ${'the platform'})` })
    .where(and(eq(schema.certificates.serial, serial), isNull(schema.certificates.revokedAt)))
    .returning({ id: schema.certificates.id });
  if (!rows.length) throw new HttpError(404, 'No active certificate with that serial.');
  await audit(admin.id, 'admin.certificate.revoke', serial, { reason: parsed.data.reason });
  return json({ ok: true });
});
