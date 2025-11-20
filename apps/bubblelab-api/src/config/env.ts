import { config } from 'dotenv';
import { join } from 'path';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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

// Calculate project root relative to this file
const projectRoot = join(__dirname, '..', '..');

// Determine database URL based on BUBBLE_ENV
function getDatabaseUrl(): string {
  const bubbleEnv = (process.env.BUBBLE_ENV || 'dev').toLowerCase();

  switch (bubbleEnv) {
    case 'test':
      return `file:${join(projectRoot, 'test.db')}`;
    case 'dev':
      return `file:${join(projectRoot, 'dev.db')}`;
    case 'stage':
    case 'prod': {
      const prodUrl = process.env.DATABASE_URL;
      if (!prodUrl) {
        throw new Error(
          'DATABASE_URL environment variable is required for production/staging'
        );
      }
      return prodUrl;
    }
    default:
      return `file:${join(projectRoot, 'dev.db')}`;
  }
}

// Set the DATABASE_URL based on BUBBLE_ENV only if not already set
const determinedDatabaseUrl = process.env.DATABASE_URL || getDatabaseUrl();
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = determinedDatabaseUrl;
}

// Export environment variables with validation
export const env = {
  PORT: process.env.PORT || '3001',
  NODEX_API_URL: process.env.NODEX_API_URL,
  GOOGLE_API_KEY: process.env.GOOGLE_API_KEY,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
  DATABASE_URL: process.env.DATABASE_URL!,
  PYTHON_PATH: process.env.PYTHON_PATH,
  BUBBLE_ENV: process.env.BUBBLE_ENV || 'dev',
  FIRE_CRAWL_API_KEY: process.env.FIRE_CRAWL_API_KEY,
  SLACK_REMINDER_CHANNEL: process.env.SLACK_REMINDER_CHANNEL,
  SLACK_BOT_TOKEN: process.env.SLACK_BOT_TOKEN,
  GOOGLE_OAUTH_CLIENT_ID: process.env.GOOGLE_OAUTH_CLIENT_ID,
  GOOGLE_OAUTH_CLIENT_SECRET: process.env.GOOGLE_OAUTH_CLIENT_SECRET,
  FUB_OAUTH_CLIENT_ID: process.env.FUB_OAUTH_CLIENT_ID,
  FUB_OAUTH_CLIENT_SECRET: process.env.FUB_OAUTH_CLIENT_SECRET,
  FUB_SYSTEM_NAME: process.env.FUB_SYSTEM_NAME,
  FUB_SYSTEM_KEY: process.env.FUB_SYSTEM_KEY,
  POSTHOG_API_KEY: process.env.POSTHOG_API_KEY,
  POSTHOG_HOST: process.env.POSTHOG_HOST || 'https://us.i.posthog.com',
  POSTHOG_ENABLED: process.env.POSTHOG_ENABLED === 'true',
  isDev:
    process.env.BUBBLE_ENV?.toLowerCase() === 'dev' ||
    process.env.BUBBLE_ENV?.toLowerCase() === 'test',
} as const;

// Log database configuration
const envType = process.env.DATABASE_URL?.includes('test.db')
  ? 'TEST'
  : env.BUBBLE_ENV.toUpperCase();
console.log(`📦 Using ${envType} database:`, env.DATABASE_URL);

// Log which env vars are loaded (without showing values for security)
console.log('🔧 Environment variables loaded:', {
  GOOGLE_API_KEY: env.GOOGLE_API_KEY ? '✅ Set' : '❌ Missing',
  OPENAI_API_KEY: env.OPENAI_API_KEY ? '✅ Set' : '❌ Missing',
  OPENROUTER_API_KEY: env.OPENROUTER_API_KEY ? '✅ Set' : '❌ Missing',
  DATABASE_URL: env.DATABASE_URL ? '✅ Set' : '❌ Missing',
  NODEX_API_URL: env.NODEX_API_URL,
  PYTHON_PATH: env.PYTHON_PATH,
  FIRE_CRAWL_API_KEY: env.FIRE_CRAWL_API_KEY ? '✅ Set' : '❌ Missing',
  SLACK_REMINDER_CHANNEL: env.SLACK_REMINDER_CHANNEL ? '✅ Set' : '❌ Missing',
  SLACK_BOT_TOKEN: env.SLACK_BOT_TOKEN ? '✅ Set' : '❌ Missing',
  PORT: env.PORT,
  isDev: env.isDev,
  GOOGLE_OAUTH_CLIENT_ID: env.GOOGLE_OAUTH_CLIENT_ID ? '✅ Set' : '❌ Missing',
  GOOGLE_OAUTH_CLIENT_SECRET: env.GOOGLE_OAUTH_CLIENT_SECRET
    ? '✅ Set'
    : '❌ Missing',
  FUB_OAUTH_CLIENT_ID: env.FUB_OAUTH_CLIENT_ID ? '✅ Set' : '❌ Missing',
  FUB_OAUTH_CLIENT_SECRET: env.FUB_OAUTH_CLIENT_SECRET
    ? '✅ Set'
    : '❌ Missing',
  FUB_SYSTEM_NAME: env.FUB_SYSTEM_NAME ? '✅ Set' : '❌ Missing',
  FUB_SYSTEM_KEY: env.FUB_SYSTEM_KEY ? '✅ Set' : '❌ Missing',
  POSTHOG_API_KEY: env.POSTHOG_API_KEY ? '✅ Set' : '❌ Missing',
  POSTHOG_HOST: env.POSTHOG_HOST,
  POSTHOG_ENABLED: env.POSTHOG_ENABLED ? '✅ Enabled' : '❌ Disabled',
});
