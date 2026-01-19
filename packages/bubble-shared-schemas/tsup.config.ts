import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: false, // Use tsc for declarations to preserve declarationMap for IDE navigation
  clean: true,
  sourcemap: true,
});
