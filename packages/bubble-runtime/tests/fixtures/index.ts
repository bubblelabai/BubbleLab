import { readFileSync } from 'fs';
import { join } from 'path';
import { CredentialType } from '@bubblelab/shared-schemas';
import { env } from './env';
// Available fixture files (without .ts extension)
export const fixtures = {
  'hello-world': '',
  'hello-world-wrong-para': '',
  'hello-world-wrong-type': '',
  'anonymous-bubble': '',
  'complex-workflow': '',
  'invalid-examples': '',
  'invalid-flow': '',
  'unregistered-bubble-flow': '',
  'missing-handle-flow': '',
  'reddit-lead-finder': '',
  'image-generation-flow': '',
  'hello-world-multiple': '',
  'mulitple-action-calls': '',
  'reddit-scraper': '',
  'test-script': '',
  'parameter-with-string': '',
  'bubble-inside-promise': '',
  'data-assistant': '',
  'research-agent': '',
  'research-weather': '',
  'simple-http': '',
  'test-webhook': '',
  'hello-world-no-payload': '',
  'hello-world-multi-line-para': '',
  'para-with-comment': '',
  'google-drive-complex': '',
  yfinance: '',
  'cron-test': '',
  'techweek-scrape': '',
  'starter-flow': '',
  'emails-complex': '',
  'content-creation': '',
  'linkedin-lead-finder-problematic': '',
  'param-as-var': '',
  'method-inside-handler': '',
} as const;

export type FixtureName = keyof typeof fixtures;

// Load all fixtures as strings immediately
const fixtureDir = __dirname;

// Preload all fixtures synchronously
Object.keys(fixtures).forEach((name) => {
  const filePath = join(fixtureDir, `${name}.ts`);
  (fixtures as any)[name] = readFileSync(filePath, 'utf-8');
});

/**
 * Get fixture content by name
 * @param name - The fixture name
 * @returns The TypeScript code as string
 */
export function getFixture(name: FixtureName): string {
  return fixtures[name];
}

export function getUserCredential(): Partial<Record<CredentialType, string>> {
  return {
    [CredentialType.FIRECRAWL_API_KEY]: env.FIRECRAWL_API_KEY,
    [CredentialType.GOOGLE_GEMINI_CRED]: env.GOOGLE_API_KEY,
    [CredentialType.OPENAI_CRED]: 'test-openai-key',
    [CredentialType.ANTHROPIC_CRED]: 'test-anthropic-key',
    [CredentialType.DATABASE_CRED]: 'test-database-key',
    [CredentialType.SLACK_CRED]: 'test-slack-key',
    [CredentialType.RESEND_CRED]: 'test-resend-key',
    [CredentialType.GOOGLE_SHEETS_CRED]: 'test-google-sheets-key',
    [CredentialType.GOOGLE_DRIVE_CRED]: 'test-google-drive-key',
  };
}

/**
 * Get all fixture names
 */
export function getFixtureNames(): FixtureName[] {
  return Object.keys(fixtures) as FixtureName[];
}
