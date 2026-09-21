import { z } from 'zod';
import { eq, sql } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { requireAdmin } from '@/lib/auth/session';
import { HttpError, json, readJson, route } from '@/lib/security/request';
import { isUuid } from '@/lib/validate';
import { audit } from '@/lib/audit';

type Ctx = { params: Promise<{ id: string }> };
const body = z.discriminatedUnion('action', [
  z.object({ action: z.literal('credits'), amount: z.number().int().min(-1_000_000).max(1_000_000) }),
  z.object({ action: z.literal('ban') }),
  z.object({ action: z.literal('unban') }),
  z.object({ action: z.literal('verify-email') }),
]);

export const POST = route<Ctx>(async (req, ctx) => {
  const admin = await requireAdmin();
  const { id } = await ctx.params;
  if (!isUuid(id)) throw new HttpError(404, 'User not found.');
  const parsed = body.safeParse(await readJson(req, 2000));
  if (!parsed.success) throw new HttpError(400, 'Unknown action.');
  const a = parsed.data;
  if (id === admin.id && a.action === 'ban') throw new HttpError(400, 'You cannot suspend your own account.');
  const u = db().update(schema.users);
  if (a.action === 'credits') await u.set({ credits: sql`greatest(0, ${schema.users.credits} + ${a.amount})` }).where(eq(schema.users.id, id));
  if (a.action === 'ban') {
    await u.set({ bannedAt: new Date() }).where(eq(schema.users.id, id));
    await db().delete(schema.sessions).where(eq(schema.sessions.userId, id));
  }
  if (a.action === 'unban') await u.set({ bannedAt: null }).where(eq(schema.users.id, id));
  if (a.action === 'verify-email') await u.set({ emailVerifiedAt: new Date() }).where(eq(schema.users.id, id));
  await audit(admin.id, `admin.user.${a.action}`, id, a.action === 'credits' ? { amount: a.amount } : undefined);
  return json({ ok: true });
});
