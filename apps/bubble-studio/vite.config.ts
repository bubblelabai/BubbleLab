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
    },
  },
  optimizeDeps: {
    include: ['monaco-editor'],
    esbuildOptions: {
      target: 'esnext',
    },
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
    },
  },
});
