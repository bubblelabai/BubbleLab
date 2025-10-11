import { config } from 'dotenv';
import { join } from 'path';
import { existsSync } from 'fs';

// Try multiple common locations for .env file
const envPaths = [
  join(process.cwd(), '.env'), // Current dir
  join(process.cwd(), '../.env'), // One up (apps level)
  join(process.cwd(), '../../.env'), // Two up (monorepo root)
];

let loaded = false;
for (const path of envPaths) {
  if (existsSync(path)) {
    config({ path });
    console.log(`✅ Loaded .env from: ${path}`);
    loaded = true;
    break;
  }
}

if (!loaded) {
  console.log('⚠️  No .env file found, using system environment variables');
  // Still call config() to load from system env or process.env
  config();
}

// Export environment variables with validation
export const env = {
  PORT: process.env.PORT || '3001',
  NODEX_API_URL: process.env.NODEX_API_URL,
  FIRECRAWL_API_KEY: process.env.FIRE_CRAWL_API_KEY,
  GOOGLE_API_KEY: process.env.GOOGLE_API_KEY,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  PYTHON_PATH: process.env.PYTHON_PATH,
  BUBBLE_ENV: process.env.BUBBLE_ENV || 'dev',
  SLACK_REMINDER_CHANNEL: process.env.SLACK_REMINDER_CHANNEL,
  SLACK_BOT_TOKEN: process.env.SLACK_BOT_TOKEN,
  GOOGLE_OAUTH_CLIENT_ID: process.env.GOOGLE_OAUTH_CLIENT_ID,
  GOOGLE_OAUTH_CLIENT_SECRET: process.env.GOOGLE_OAUTH_CLIENT_SECRET,
  GOOGLE_SHEETS_CRED: process.env.GOOGLE_SHEETS_CRED,
  isDev:
    process.env.BUBBLE_ENV?.toLowerCase() === 'dev' ||
    process.env.BUBBLE_ENV?.toLowerCase() === 'test',
} as const;

// Log database configuration
const envType = process.env.DATABASE_URL?.includes('test.db')
  ? 'TEST'
  : env.BUBBLE_ENV.toUpperCase();

// Log which env vars are loaded (without showing values for security)
console.log('🔧 Environment variables loaded:', {
  GOOGLE_API_KEY: env.GOOGLE_API_KEY ? '✅ Set' : '❌ Missing',
  OPENAI_API_KEY: env.OPENAI_API_KEY ? '✅ Set' : '❌ Missing',
  PYTHON_PATH: env.PYTHON_PATH,
  SLACK_REMINDER_CHANNEL: env.SLACK_REMINDER_CHANNEL ? '✅ Set' : '❌ Missing',
  SLACK_BOT_TOKEN: env.SLACK_BOT_TOKEN ? '✅ Set' : '❌ Missing',
  PORT: env.PORT,
  isDev: env.isDev,
  FIRECRAWL_API_KEY: env.FIRECRAWL_API_KEY ? '✅ Set' : '❌ Missing',
  GOOGLE_OAUTH_CLIENT_ID: env.GOOGLE_OAUTH_CLIENT_ID ? '✅ Set' : '❌ Missing',
  GOOGLE_OAUTH_CLIENT_SECRET: env.GOOGLE_OAUTH_CLIENT_SECRET
    ? '✅ Set'
    : '❌ Missing',
  GOOGLE_SHEETS_CRED: env.GOOGLE_SHEETS_CRED ? '✅ Set' : '❌ Missing',
});
