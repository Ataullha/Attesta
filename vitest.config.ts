import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const here = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  resolve: {
    alias: [
      { find: /^@\//, replacement: here('./src') + '/' },
      // `server-only` throws outside React's server bundle; tests run in plain Node.
      { find: /^server-only$/, replacement: here('./tests/stubs/server-only.ts') },
    ],
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // Migrates TEST_DATABASE_URL (when set) once; env.ts points the app at it for every test file.
    globalSetup: ['tests/setup/global.ts'],
    setupFiles: ['tests/setup/env.ts'],
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
