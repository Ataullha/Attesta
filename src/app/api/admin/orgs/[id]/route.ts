import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { requireAdmin } from '@/lib/auth/session';
import { HttpError, json, readJson, route } from '@/lib/security/request';
import { isUuid } from '@/lib/validate';
import { audit } from '@/lib/audit';

type Ctx = { params: Promise<{ id: string }> };
const body = z.object({ action: z.enum(['approve', 'reject', 'unverify']), note: z.string().max(500).optional() });

export const POST = route<Ctx>(async (req, ctx) => {
  const admin = await requireAdmin();
  const { id } = await ctx.params;
  if (!isUuid(id)) throw new HttpError(404, 'Organisation not found.');
  const parsed = body.safeParse(await readJson(req, 2000));
  if (!parsed.success) throw new HttpError(400, 'Unknown action.');
  const [org] = await db().select().from(schema.organizations).where(eq(schema.organizations.id, id)).limit(1);
  if (!org) throw new HttpError(404, 'Organisation not found.');
  const { action, note } = parsed.data;
  if (action === 'approve' && org.status !== 'pending') throw new HttpError(400, 'Only organisations with a confirmed DNS record can be approved.');
  await db()
    .update(schema.organizations)
    .set(
      action === 'approve'
        ? { status: 'verified', verifiedAt: new Date(), reviewNote: note ?? null }
        : { status: action === 'reject' ? 'rejected' : 'unverified', verifiedAt: null, reviewNote: note ?? null },
    )
    .where(eq(schema.organizations.id, id));
  await audit(admin.id, `admin.org.${action}`, org.name, { domain: org.domain, note });
  return json({ ok: true });
});
