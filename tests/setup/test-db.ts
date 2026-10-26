/**
 * Integration tests insert and delete rows, so they refuse to run against anything that does not
 * look like a throwaway database. A database whose name contains "test" is the only thing accepted.
 */
export function assertTestDatabase(url: string) {
  const name = decodeURIComponent(new URL(url).pathname.replace(/^\//, ''));
  if (!/test/i.test(name)) {
    throw new Error(`Refusing to run integration tests against database "${name}": TEST_DATABASE_URL must point at a database whose name contains "test".`);
  }
}
