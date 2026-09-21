import 'server-only';
import postgres from 'postgres';
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from './schema';

type DB = PostgresJsDatabase<typeof schema>;

const g = globalThis as unknown as { __attestaDb?: DB };

/**
 * Lazily connects so that `next build` works without a database.
 * `prepare: false` keeps it compatible with transaction-mode poolers
 * (Neon's pooled URL, Supabase's pooler, PgBouncer).
 */
export function db(): DB {
  if (g.__attestaDb) return g.__attestaDb;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set. Copy .env.example to .env.local and fill it in.');
  const client = postgres(url, { prepare: false, max: 5, idle_timeout: 20, connect_timeout: 15 });
  g.__attestaDb = drizzle(client, { schema });
  return g.__attestaDb;
}

export { schema };
