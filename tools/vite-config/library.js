import { defineConfig, mergeConfig } from 'vite'
import { resolve } from 'path'
import dts from 'vite-plugin-dts'
import baseConfig from './base.js'

export default mergeConfig(
  baseConfig,
  defineConfig({
    plugins: [
      dts({
        insertTypesEntry: true,
      }),
    ],
    build: {
      lib: {
        entry: resolve(__dirname, 'src/index.ts'),
        name: 'NodeXLibrary',
        formats: ['es', 'cjs'],
        fileName: (format) => `index.${format}.js`,
      },
      rollupOptions: {
        external: ['react', 'react-dom'],
        output: {
          globals: {
            react: 'React',
            'react-dom': 'ReactDOM',
          },
        },
      },
    },
  })
);