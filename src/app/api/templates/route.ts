import { z } from 'zod';
import { count, desc, eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { requireUser } from '@/lib/auth/session';
import { HttpError, json, readJson, route } from '@/lib/security/request';
import { assertDesignAssetsOwned, parseDesign } from '@/lib/validate';
import { limits } from '@/lib/site';

export const GET = route(async () => {
  const user = await requireUser();
  const rows = await db()
    .select({ id: schema.templates.id, name: schema.templates.name, updatedAt: schema.templates.updatedAt })
    .from(schema.templates)
    .where(eq(schema.templates.userId, user.id))
    .orderBy(desc(schema.templates.updatedAt));
  return json({ templates: rows });
});

const body = z.object({ name: z.string().trim().min(1).max(120), design: z.unknown() });

export const POST = route(async (req) => {
  const user = await requireUser();
  const parsed = body.safeParse(await readJson(req, 900_000));
  if (!parsed.success) throw new HttpError(400, 'Give the template a name.');
  const design = parseDesign(parsed.data.design);
  await assertDesignAssetsOwned(design, user.id);
  const [{ n }] = await db().select({ n: count() }).from(schema.templates).where(eq(schema.templates.userId, user.id));
  if (Number(n) >= limits.templatesPerUser) throw new HttpError(400, `You can keep up to ${limits.templatesPerUser} templates. Delete one to save another.`);
  const [row] = await db().insert(schema.templates).values({ userId: user.id, name: parsed.data.name, design }).returning({ id: schema.templates.id });
  return json({ id: row.id });
});
