import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { requireAdmin } from '@/lib/auth/session';
import { HttpError, json, readJson, route } from '@/lib/security/request';
import { isUuid } from '@/lib/validate';
import { audit } from '@/lib/audit';

type Ctx = { params: Promise<{ id: string }> };
const body = z.object({ action: z.enum(['resolve', 'deindex']) });

export const POST = route<Ctx>(async (req, ctx) => {
  const admin = await requireAdmin();
  const { id } = await ctx.params;
  if (!isUuid(id)) throw new HttpError(404, 'Report not found.');
  const parsed = body.safeParse(await readJson(req, 1000));
  if (!parsed.success) throw new HttpError(400, 'Unknown action.');
  const [r] = await db().select().from(schema.reports).where(eq(schema.reports.id, id)).limit(1);
  if (!r) throw new HttpError(404, 'Report not found.');
  if (parsed.data.action === 'deindex' && r.certificateId) {
    await db().update(schema.certificates).set({ deindexed: true }).where(eq(schema.certificates.id, r.certificateId));
  }
  await db().update(schema.reports).set({ status: 'resolved' }).where(eq(schema.reports.id, id));
  await audit(admin.id, `admin.report.${parsed.data.action}`, r.serial);
  return json({ ok: true });
});
