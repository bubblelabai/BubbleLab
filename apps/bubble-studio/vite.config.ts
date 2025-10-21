import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  optimizeDeps: {
    include: ['monaco-editor'],
  },
  server: {
    fs: {
      allow: ['../..'],
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
