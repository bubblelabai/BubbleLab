/**
 * Global setup file for vitest tests
 * Automatically loads environment variables from .env file
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Get the directory of this file (bubble-core root)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env file from bubble-core package root
const envPath = resolve(__dirname, '.env');

// Load environment variables
// dotenv will not override existing environment variables
config({ path: envPath });

// Log environment setup status (helpful for debugging)
console.log('🔧 Vitest environment setup:');
console.log(
  '  - GOOGLE_API_KEY:',
  process.env.GOOGLE_API_KEY ? '✓ loaded' : '✗ not found'
);
console.log(
  '  - SLACK_TOKEN:',
  process.env.SLACK_TOKEN ? '✓ loaded' : '✗ not found'
);
console.log(
  '  - BUBBLE_CONNECTING_STRING_URL:',
  process.env.BUBBLE_CONNECTING_STRING_URL ? '✓ loaded' : '✗ not found'
);
console.log(
  '  - OPENAI_API_KEY:',
  process.env.OPENAI_API_KEY ? '✓ loaded' : '✗ not found'
);
console.log(
  '  - ANTHROPIC_API_KEY:',
  process.env.ANTHROPIC_API_KEY ? '✓ loaded' : '✗ not found'
);
console.log(
  '  - OPENROUTER_API_KEY:',
  process.env.OPENROUTER_API_KEY ? '✓ loaded' : '✗ not found'
);
console.log('');

// Type definitions for environment variables (optional but recommended)
declare global {
  namespace NodeJS {
    interface ProcessEnv {
      GOOGLE_API_KEY?: string;
      SLACK_TOKEN?: string;
      BUBBLE_CONNECTING_STRING_URL?: string;
      OPENAI_API_KEY?: string;
      ANTHROPIC_API_KEY?: string;
      OPENROUTER_API_KEY?: string;
      FIRECRAWL_API_KEY?: string;
      RESEND_API_KEY?: string;
    }
  }
}

export {};
