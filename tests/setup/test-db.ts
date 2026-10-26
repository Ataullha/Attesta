/**
 * Integration tests insert and delete rows, so they refuse to run against anything that does not
 * look like a throwaway database. A database whose name contains "test" is the only thing accepted.
 */
export function assertTestDatabase(url: string) {
  const name = decodeURIComponent(new URL(url).pathname.replace(/^\//, ''));
  if (!/test/i.test(name)) {
    throw setupError(`Refusing to run integration tests against database "${name}": TEST_DATABASE_URL must point at a database whose name contains "test".`);
  }
}

/**
 * An error for a global setup to throw. Vitest 5 runs global setups through Vite's module runner, which
 * crashes while source-mapping the stack of an error thrown there ("code.charCodeAt is not a function"),
 * and the message never reaches the terminal. With no stack frames there is nothing to map, so the
 * message is printed as written.
 */
export function setupError(message: string) {
  const err = new Error(message);
  err.stack = `Error: ${message}`;
  return err;
}
