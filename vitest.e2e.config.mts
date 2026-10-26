import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const here = (p: string) => fileURLToPath(new URL(p, import.meta.url));

// End-to-end tests drive a running copy of the built app over HTTP. See tests/e2e/setup.ts.
export default defineConfig({
  resolve: {
    alias: [
      { find: /^@\//, replacement: here('./src') + '/' },
      { find: /^server-only$/, replacement: here('./tests/stubs/server-only.ts') },
    ],
  },
  test: {
    environment: 'node',
    include: ['tests/e2e/**/*.test.ts'],
    globalSetup: ['tests/e2e/setup.ts'],
    // One app server and one database serve every file, so the files take turns.
    fileParallelism: false,
    testTimeout: 60_000,
    hookTimeout: 180_000,
  },
});
