import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    // e2e tests talk to a real database (the dev one over Tailscale): allow for latency.
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
