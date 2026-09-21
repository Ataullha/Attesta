import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { requireUser } from '@/lib/auth/session';
import { HttpError, json, readJson, route } from '@/lib/security/request';
import { assertDesignAssetsOwned, isUuid, parseDesign } from '@/lib/validate';

type Ctx = { params: Promise<{ id: string }> };

async function own(userId: string, id: string) {
  if (!isUuid(id)) throw new HttpError(404, 'Template not found.');
  const [row] = await db()
    .select()
    .from(schema.templates)
    .where(and(eq(schema.templates.id, id), eq(schema.templates.userId, userId)))
    .limit(1);
  if (!row) throw new HttpError(404, 'Template not found.');
  return row;
}

export const GET = route<Ctx>(async (_req, ctx) => {
  const user = await requireUser();
  const row = await own(user.id, (await ctx.params).id);
  return json({ id: row.id, name: row.name, design: row.design });
});

const body = z.object({ name: z.string().trim().min(1).max(120), design: z.unknown() });

export const PUT = route<Ctx>(async (req, ctx) => {
  const user = await requireUser();
  const row = await own(user.id, (await ctx.params).id);
  const parsed = body.safeParse(await readJson(req, 900_000));
  if (!parsed.success) throw new HttpError(400, 'Give the template a name.');
  const design = parseDesign(parsed.data.design);
  await assertDesignAssetsOwned(design, user.id);
  await db().update(schema.templates).set({ name: parsed.data.name, design, updatedAt: new Date() }).where(eq(schema.templates.id, row.id));
  return json({ ok: true });
});

export const DELETE = route<Ctx>(async (_req, ctx) => {
  const user = await requireUser();
  const row = await own(user.id, (await ctx.params).id);
  await db().delete(schema.templates).where(eq(schema.templates.id, row.id));
  return json({ ok: true });
});
