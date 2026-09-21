// Applies SQL migrations from ./drizzle. Runs automatically on Vercel via `vercel-build`.
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';

const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is not set — skipping migrations.');
  process.exit(process.env.VERCEL ? 1 : 0);
}
const client = postgres(url, { max: 1, prepare: false });
try {
  await migrate(drizzle(client), { migrationsFolder: './drizzle' });
  console.log('Migrations applied.');
} catch (err) {
  console.error('Migration failed:', err);
  process.exitCode = 1;
} finally {
  await client.end();
}
