import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  // Resolves the path aliases declared in tsconfig.json.
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    root: './',
    include: ['**/*.spec.ts'],
    // The auth settings src/auth/auth.ts reads on import. Unit tests never reach uniAuth.
    env: {
      BETTER_AUTH_URL: 'http://127.0.0.1:3013',
      BETTER_AUTH_SECRET: 'unit-test-secret-at-least-thirty-two-characters',
      UNIAUTH_ISSUER: 'http://127.0.0.1:1/api/auth',
      UNIAUTH_CLIENT_ID: 'uniloom-test',
      UNIAUTH_CLIENT_SECRET: 'uniloom-test-secret',
    },
  },
});
