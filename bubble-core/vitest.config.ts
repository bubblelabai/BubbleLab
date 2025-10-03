import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.{test,spec}.ts'],
    exclude: ['src/bubbles/tool-bubble/debug-boilerplate.test.ts'],
    globals: true,
    testTimeout: 60000,
    hookTimeout: 120000,
    teardownTimeout: 120000,
    pool: 'forks',
  },
  resolve: {
    alias: {
      '^@bubblelab/shared-schemas$': new URL(
        '../shared-schemas/src/index.ts',
        import.meta.url
      ).pathname,
    },
  },
});
