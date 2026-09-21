import { z } from 'zod';
import { and, eq, isNull } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { requireUser } from '@/lib/auth/session';
import { HttpError, json, readJson, route } from '@/lib/security/request';
import { normalizeSerial } from '@/lib/signing';
import { audit } from '@/lib/audit';

type Ctx = { params: Promise<{ serial: string }> };
const body = z.object({ reason: z.string().trim().min(3, 'Say why — it is shown on the verification page.').max(300) });

export const POST = route<Ctx>(async (req, ctx) => {
  const user = await requireUser();
  const serial = normalizeSerial((await ctx.params).serial);
  const parsed = body.safeParse(await readJson(req, 4000));
  if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message ?? 'Give a reason.');
  const rows = await db()
    .update(schema.certificates)
    .set({ revokedAt: new Date(), revokeReason: parsed.data.reason })
    .where(and(eq(schema.certificates.serial, serial), eq(schema.certificates.userId, user.id), isNull(schema.certificates.revokedAt)))
    .returning({ id: schema.certificates.id });
  if (!rows.length) throw new HttpError(404, 'No active certificate with that serial in your account.');
  await audit(user.id, 'certificate.revoke', serial, { reason: parsed.data.reason });
  return json({ ok: true });
});
