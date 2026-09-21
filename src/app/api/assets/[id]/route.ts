import { and, eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { requireUser } from '@/lib/auth/session';
import { HttpError, json, route } from '@/lib/security/request';
import { isUuid } from '@/lib/validate';

type Ctx = { params: Promise<{ id: string }> };

export const GET = route<Ctx>(async (_req, ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  if (!isUuid(id)) throw new HttpError(404, 'Not found.');
  // Signatures are sensitive: only the owner can fetch them, deleted or not.
  const [row] = await db()
    .select({ bytes: schema.assets.bytes, mime: schema.assets.mime })
    .from(schema.assets)
    .where(and(eq(schema.assets.id, id), eq(schema.assets.userId, user.id)))
    .limit(1);
  if (!row) throw new HttpError(404, 'Not found.');
  return new Response(new Uint8Array(row.bytes), {
    headers: {
      'Content-Type': row.mime,
      'Cache-Control': 'private, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
      'Content-Disposition': 'inline',
    },
  });
});

export const DELETE = route<Ctx>(async (_req, ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  if (!isUuid(id)) throw new HttpError(404, 'Not found.');
  await db()
    .update(schema.assets)
    .set({ deletedAt: new Date() })
    .where(and(eq(schema.assets.id, id), eq(schema.assets.userId, user.id)));
  return json({ ok: true });
});
