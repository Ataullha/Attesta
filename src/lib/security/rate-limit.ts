import 'server-only';
import { sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { HttpError } from './request';

/**
 * Fixed-window rate limiter stored in Postgres, so it works across serverless
 * instances without another service. One atomic upsert per check.
 */
export async function rateLimit(key: string, max: number, windowSeconds: number) {
  const rows = await db().execute<{ count: number }>(sql`
    insert into rate_limits (key, count, reset_at)
    values (${key}, 1, now() + make_interval(secs => ${windowSeconds}))
    on conflict (key) do update set
      count = case when rate_limits.reset_at < now() then 1 else rate_limits.count + 1 end,
      reset_at = case when rate_limits.reset_at < now() then now() + make_interval(secs => ${windowSeconds}) else rate_limits.reset_at end
    returning count
  `);
  const count = Number(rows[0]?.count ?? 0);
  if (count > max) throw new HttpError(429, 'Too many attempts. Wait a little and try again.', 'rate_limited');
}
