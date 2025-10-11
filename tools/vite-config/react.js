import { defineConfig, mergeConfig } from 'vite'
import react from '@vitejs/plugin-react'
import baseConfig from './base.js'

export default mergeConfig(
  baseConfig,
  defineConfig({
    plugins: [react()],
    define: {
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
    },
  })
);