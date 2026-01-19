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
  'flow-with-spread-and-para': '',
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
  'weather-deep-research': '',
  'google-drive-complex': '',
  yfinance: '',
  'cron-test': '',
  'techweek-scrape': '',
  'batch-process-loop': '',
  'para-with-variable-alias': '',
  'starter-flow': '',
  'research-agent-step': '',
  'emails-complex': '',
  'content-creation': '',
  'linkedin-lead-finder-problematic': '',
  'function-outside-flow': '',
  'param-as-var': '',
  'method-inside-handler': '',
  'flow-with-class-method-and-log': '',
  'steps-workflow': '',
  'multi-agent': '',
  'invalid-step-flow': '',
  'calender-step-flow': '',
  'credential-in-flow': '',
  'reddit-flow-step': '',
  'categorizer-step-flow': '',
  'content-creation-step': '',
  'linkedin-gen-step-flow': '',
  'for-and-promises-flow': '',
  'github-pr-sequential': '',
  'nested-condition-hanlde': '',
  'mapping-function-call': '',
  'multiple-bubble-class-flow': '',
  'bracket-less-control-flow': '',
  'agent-with-custom-tool-flow': '',
  'calendar-booking-flow': '',
  'malicious-process-env': '',
  'malicious-process-env-bracket': '',
  'malicious-process-env-standalone': '',
  'malicious-process-bracket-env': '',
  'legitimate-process-env-string': '',
  'promise-all-patterns': '',
  'string-literal-complex': '',
  'promises-all-map': '',
  'slack-with-custom-input': '',
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
    [CredentialType.FIRECRAWL_API_KEY]: 'test-firecrawl-key',
    [CredentialType.GOOGLE_GEMINI_CRED]: 'test-google-gemini-key',
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
