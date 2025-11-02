import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'url';
import { resolve } from 'path';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.{test,spec}.ts', '*.{test,spec}.ts'],
    globals: true,
    testTimeout: 120000, // 2 minutes for template tests that may need to run flows
    hookTimeout: 120000,
    teardownTimeout: 120000,
    pool: 'forks',
  },
  resolve: {
    alias: {
      '^@bubblelab/bubble-core$': resolve(
        __dirname,
        '../bubble-core/src/index.ts'
      ),
      '^@bubblelab/bubble-runtime$': resolve(
        __dirname,
        '../bubble-runtime/src/index.ts'
      ),
      '^@bubblelab/shared-schemas$': resolve(
        __dirname,
        '../bubble-shared-schemas/src/index.ts'
      ),
      '^@bubblelab/ts-scope-manager$': resolve(
        __dirname,
        '../bubble-scope-manager/index.ts'
      ),
    },
  },
});
