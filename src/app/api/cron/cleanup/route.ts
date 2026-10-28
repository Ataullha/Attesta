import { lt, or, isNotNull, sql } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { closeStaleCheckouts } from '@/lib/payments/online';

// Asking SSLCommerz about unfinished checkouts can take a while. Every Vercel plan allows 60 seconds.
export const maxDuration = 60;

/** Daily housekeeping, triggered by Vercel Cron (see vercel.json). */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return new Response('Unauthorized', { status: 401 });
  }
  const now = new Date();
  await db().delete(schema.sessions).where(lt(schema.sessions.expiresAt, now));
  await db().delete(schema.emailTokens).where(or(lt(schema.emailTokens.expiresAt, now), isNotNull(schema.emailTokens.usedAt)));
  await db().delete(schema.rateLimits).where(lt(schema.rateLimits.resetAt, sql`now() - interval '1 day'`));
  await db().delete(schema.guestUsage).where(lt(schema.guestUsage.createdAt, sql`now() - interval '400 days'`));
  const checkouts = await closeStaleCheckouts();
  return Response.json({ ok: true, checkouts });
}
