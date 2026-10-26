import { and, eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { requireUser } from '@/lib/auth/session';
import { certificatesCsv } from '@/lib/export';
import { HttpError, route } from '@/lib/security/request';
import { rateLimit } from '@/lib/security/rate-limit';
import { isUuid } from '@/lib/validate';

export const runtime = 'nodejs';

/**
 * The signed-in user's certificates as a CSV download. `?q=` applies the dashboard's search, and
 * `?batch=<id>` limits it to one batch and adds that batch's own fields as columns.
 */
export const GET = route(async (req) => {
  const user = await requireUser();
  await rateLimit(`export:${user.id}`, 20, 3600);
  const params = new URL(req.url).searchParams;
  const q = (params.get('q') ?? '').slice(0, 80);
  const batchId = params.get('batch') || undefined;
  if (batchId) {
    if (!isUuid(batchId)) throw new HttpError(404, 'Batch not found.');
    const [owned] = await db()
      .select({ id: schema.batches.id })
      .from(schema.batches)
      .where(and(eq(schema.batches.id, batchId), eq(schema.batches.userId, user.id)))
      .limit(1);
    if (!owned) throw new HttpError(404, 'Batch not found.');
  }

  const rows = certificatesCsv(user.id, { q, batchId });
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const next = await rows.next();
        if (next.done) controller.close();
        else controller.enqueue(encoder.encode(next.value));
      } catch (err) {
        console.error('certificate export failed', err);
        controller.error(err);
      }
    },
    async cancel() {
      await rows.return(undefined);
    },
  });

  const day = new Date().toISOString().slice(0, 10);
  return new Response(body, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="certificates-${batchId ? batchId.slice(0, 8) : day}.csv"`,
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
});
