import { assertTestDatabase } from './test-db';

// The app reads DATABASE_URL; tests read TEST_DATABASE_URL, so a developer's real database
// can never be reached just because it is configured for `npm run dev`.
const url = process.env.TEST_DATABASE_URL;
if (url) {
  assertTestDatabase(url);
  process.env.DATABASE_URL = url;
}
// Deterministic secrets for anything that signs or hashes during a test.
process.env.SECRET_SALT ??= 'test-salt';
