import { z } from 'zod';
import { and, eq, sql } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { requireAdmin } from '@/lib/auth/session';
import { HttpError, json, readJson, route } from '@/lib/security/request';
import { isUuid } from '@/lib/validate';
import { audit } from '@/lib/audit';

type Ctx = { params: Promise<{ id: string }> };
const body = z.object({ action: z.enum(['approve', 'reject']), note: z.string().max(500).optional() });

export const POST = route<Ctx>(async (req, ctx) => {
  const admin = await requireAdmin();
  const { id } = await ctx.params;
  if (!isUuid(id)) throw new HttpError(404, 'Payment not found.');
  const parsed = body.safeParse(await readJson(req, 2000));
  if (!parsed.success) throw new HttpError(400, 'Unknown action.');
  const { action, note } = parsed.data;
  await db().transaction(async (tx) => {
    // Only a pending payment can change state, so double-clicks can't add credits twice.
    const [p] = await tx
      .update(schema.payments)
      .set({ status: action === 'approve' ? 'approved' : 'rejected', note: note ?? null, reviewedAt: new Date(), reviewedBy: admin.id })
      .where(and(eq(schema.payments.id, id), eq(schema.payments.status, 'pending')))
      .returning();
    if (!p) throw new HttpError(409, 'This payment was already reviewed.');
    if (action === 'approve') {
      await tx.update(schema.users).set({ credits: sql`${schema.users.credits} + ${p.credits}` }).where(eq(schema.users.id, p.userId));
    }
  });
  await audit(admin.id, `admin.payment.${action}`, id, { note });
  return json({ ok: true });
});
