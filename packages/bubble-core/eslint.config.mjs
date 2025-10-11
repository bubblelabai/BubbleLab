import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import path from 'path';
import { fileURLToPath } from 'url';

// Import our custom rule
import noNullContextRule from './eslint-rules/no-null-context.js';

export default [
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': 'warn',
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
  {
    files: ['src/**/*.ts'],
    plugins: {
      'bubble-core': {
        rules: {
          'no-null-context': noNullContextRule,
        },
      },
    },
    rules: {
      'bubble-core/no-null-context': 'error',
    },
  },
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      '.next/**',
      'out/**',
      'external/**',
      '*.config.*',
      '**/test-*.ts',
      '**/test-*.js',
      '**/manual-tests/**',
      '**/*.test.ts',
      '**/*.test.js',
      '**/*.spec.ts',
      '**/*.spec.js',
    ],
  },
];
