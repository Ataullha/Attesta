import { execFileSync } from 'node:child_process';
import { assertTestDatabase, setupError } from './test-db';

/** Applies the project's migrations to the test database once, before any test file runs. */
export default function setup() {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) return;
  assertTestDatabase(url);
  try {
    execFileSync(process.execPath, ['scripts/migrate.mjs'], { env: { ...process.env, DATABASE_URL: url, DATABASE_URL_UNPOOLED: '' }, stdio: 'inherit' });
  } catch {
    throw setupError('Could not migrate the test database (the reason is printed above). Is TEST_DATABASE_URL right, and is Postgres running?');
  }
}
