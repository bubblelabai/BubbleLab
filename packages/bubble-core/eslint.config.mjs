import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import path from 'path';
import { fileURLToPath } from 'url';

// Import our custom rules
import noNullContextRule from './eslint-rules/no-null-context.js';
import requireCronScheduleRule from './eslint-rules/require-cron-schedule.js';
import requireInstanceIdRule from './eslint-rules/require-instance-id.js';

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
          'require-cron-schedule': requireCronScheduleRule,
          'require-instance-id': requireInstanceIdRule,
        },
      },
    },
    rules: {
      'bubble-core/no-null-context': 'error',
      'bubble-core/require-cron-schedule': 'error',
      'bubble-core/require-instance-id': 'error',
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
