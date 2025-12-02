import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { TanStackRouterVite } from '@tanstack/router-vite-plugin';
import path from 'path';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), TanStackRouterVite()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // Polyfill Node.js 'crypto' module with browser-compatible Web Crypto API
      crypto: path.resolve(__dirname, './src/utils/crypto-polyfill.ts'),
      // Polyfill Node.js 'node:async_hooks' module for browser compatibility
      'node:async_hooks': path.resolve(
        __dirname,
        './src/utils/async-hooks-polyfill.ts'
      ),
      // Polyfill Node.js 'os' module for browser compatibility
      os: path.resolve(__dirname, './src/utils/os-polyfill.ts'),
      // Polyfill Node.js 'path' module for browser compatibility
      path: path.resolve(__dirname, './src/utils/path-polyfill.ts'),
      // Also handle 'node:path' imports
      'node:path': path.resolve(__dirname, './src/utils/path-polyfill.ts'),
      // Polyfill Node.js 'stream' module for browser compatibility
      stream: path.resolve(__dirname, './src/utils/stream-polyfill.ts'),
      'node:stream': path.resolve(__dirname, './src/utils/stream-polyfill.ts'),
      // Polyfill Node.js 'fs' module for browser compatibility (stubs - won't actually work)
      fs: path.resolve(__dirname, './src/utils/fs-polyfill.ts'),
      'node:fs': path.resolve(__dirname, './src/utils/fs-polyfill.ts'),
    },
  },
  optimizeDeps: {
    include: ['monaco-editor'],
    exclude: ['@bubblelab/bubble-core'],
    esbuildOptions: {
      target: 'esnext',
    },
  },
  ssr: {
    noExternal: [],
  },
  server: {
    host: '0.0.0.0',
    allowedHosts: true,
    proxy: {
      '/api': {
        target:
          process.env.VITE_API_URL ||
          process.env.VITE_API_ENDPOINT ||
          'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  preview: {
    host: '0.0.0.0',
    allowedHosts: true,
    proxy: {
      '/api': {
        target:
          process.env.VITE_API_URL ||
          process.env.VITE_API_ENDPOINT ||
          'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  define: {
    global: 'globalThis',
  },
  // Ensure environment variables are loaded properly
  envPrefix: 'VITE_',
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          monaco: ['monaco-editor'],
        },
      },
      external: (id) => {
        // Externalize Node.js built-ins and problematic modules
        if (id === 'module' || id.startsWith('node:')) {
          return true;
        }
        return false;
      },
    },
    commonjsOptions: {
      transformMixedEsModules: true,
    },
  },
});
