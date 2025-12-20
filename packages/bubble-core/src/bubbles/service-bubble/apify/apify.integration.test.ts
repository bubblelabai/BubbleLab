import { describe, test, expect, beforeAll, assert } from 'vitest';
import { ApifyBubble } from './apify.js';
import { APIFY_ACTOR_SCHEMAS } from './apify-scraper.schema.js';
import { CREDENTIAL_ENV_MAP, CredentialType } from '@bubblelab/shared-schemas';
import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';
import {
  compareMultipleWithSchema,
  formatAggregatedDifferences,
} from '../../../utils/schema-comparison.js';

// Load environment variables from the package root
dotenv.config({ path: path.join(process.cwd(), '../../.env.local') });

const APIFY_TOKEN = process.env[CREDENTIAL_ENV_MAP[CredentialType.APIFY_CRED]]!;

/**
 * Validates data against a schema and reports detailed differences.
 * Uses safeParse (lenient) but logs any schema drift for awareness.
 */
function validateAndCompareSchema<T extends z.ZodTypeAny>(
  schema: T,
  items: unknown[],
  actorId: string
): { validated: z.output<T>[]; hasSchemaIssues: boolean } {
  // First, do a comparison to find all differences
  const comparison = compareMultipleWithSchema(schema, items);

  // Randomly sample a few items from random indices and log them
  const sampleSize = Math.min(3, items.length);
  const sampledItems: unknown[] = [];
  const usedIndices = new Set<number>();

  while (sampledItems.length < sampleSize) {
    const randomIndex = Math.floor(Math.random() * items.length);
    if (!usedIndices.has(randomIndex)) {
      usedIndices.add(randomIndex);
      sampledItems.push(items[randomIndex]);
    }
  }

  for (const item of sampledItems) {
    console.log(JSON.stringify(item, null, 2));
  }

  console.log(comparison.summary);

  assert(comparison.status === 'PASS', 'Schema comparison should pass');

  // Log differences if any extra fields found (informational)
  if (comparison.allExtraFields.length > 0) {
    console.log(`\n[${actorId}] Schema comparison report:`);
    console.log(formatAggregatedDifferences(comparison));
  }

  // Check for actual schema issues (missing required or type mismatches)
  const hasSchemaIssues =
    comparison.allMissingRequired.length > 0 ||
    comparison.allTypeMismatches.size > 0;

  if (hasSchemaIssues) {
    console.error(`\n[${actorId}] SCHEMA ISSUES DETECTED:`);
    console.error(formatAggregatedDifferences(comparison));
  }

  // Validate each item with safeParse (lenient - allows extra fields)
  const validated: z.output<T>[] = [];
  for (const item of items) {
    const result = schema.safeParse(item);
    if (!result.success) {
      console.error(`Schema validation failed for ${actorId}:`);
      console.error(
        'Validation errors:',
        JSON.stringify(result.error.issues, null, 2)
      );
      console.error(
        'Data received:',
        JSON.stringify(item, null, 2).slice(0, 1000)
      );
      throw new Error(
        `Schema validation failed for ${actorId}: ${result.error.message}`
      );
    }
    validated.push(result.data);
  }

  return { validated, hasSchemaIssues };
}

describe('Apify Integration Tests', () => {
  beforeAll(() => {
    if (!APIFY_TOKEN) {
      console.error(
        `${CREDENTIAL_ENV_MAP[CredentialType.APIFY_CRED]} environment variable is required for integration tests`
      );
      throw new Error(
        'APIFY_TOKEN environment variable is required for integration tests'
      );
    }
  });

  // Test 1: LinkedIn Jobs Scraper
  describe('LinkedIn Jobs Scraper', () => {
    test(
      'should scrape LinkedIn jobs and validate output schema',
      { timeout: 200000 },
      async () => {
        const actorId = 'curious_coder/linkedin-jobs-scraper' as const;
        const schema = APIFY_ACTOR_SCHEMAS[actorId];

        const bubble = new ApifyBubble<typeof actorId>({
          actorId,
          input: {
            urls: [
              'https://www.linkedin.com/jobs/search?keywords=software+engineer&location=United+States&sort_by=date_posted',
            ],
            count: 100,
          },
          credentials: {
            [CredentialType.APIFY_CRED]: APIFY_TOKEN,
          },
          waitForFinish: true,
          timeout: 180000,
        });

        const result = await bubble.action();
        console.log(JSON.stringify(result, null, 2));

        expect(result.success).toBe(true);
        expect(result.data.status).toBe('SUCCEEDED');
        expect(result.data.items).toBeDefined();
        expect(Array.isArray(result.data.items)).toBe(true);
        expect(result.data.items!.length).toBeGreaterThan(0);

        // Validate and compare all items against the schema
        const { validated, hasSchemaIssues } = validateAndCompareSchema(
          schema.output,
          result.data.items!,
          actorId
        );

        expect(validated.length).toBe(result.data.items!.length);
        expect(hasSchemaIssues).toBe(false);

        // Check specific fields exist in validated data
        for (const item of validated) {
          expect(
            typeof item.title === 'string' || item.title === undefined
          ).toBe(true);
        }

        console.log(
          `LinkedIn Jobs: Successfully validated ${validated.length} items`
        );
      }
    );
  });

  // Test 2: YouTube Scraper
  describe('YouTube Scraper', () => {
    test(
      'should scrape YouTube videos and validate output schema',
      { timeout: 200000 },
      async () => {
        const actorId = 'streamers/youtube-scraper' as const;
        const schema = APIFY_ACTOR_SCHEMAS[actorId];

        const bubble = new ApifyBubble<typeof actorId>({
          actorId,
          input: {
            searchQueries: ['TypeScript tutorial'],
            maxResults: 3,
          },
          credentials: {
            [CredentialType.APIFY_CRED]: APIFY_TOKEN,
          },
          waitForFinish: true,
          timeout: 180000,
        });

        const result = await bubble.action();

        expect(result.success).toBe(true);
        expect(result.data.status).toBe('SUCCEEDED');
        expect(result.data.items).toBeDefined();
        expect(Array.isArray(result.data.items)).toBe(true);
        expect(result.data.items!.length).toBeGreaterThan(0);

        // Validate and compare all items against the schema
        const { validated, hasSchemaIssues } = validateAndCompareSchema(
          schema.output,
          result.data.items!,
          actorId
        );

        expect(validated.length).toBe(result.data.items!.length);
        expect(hasSchemaIssues).toBe(false);

        // Check specific fields exist in validated data
        for (const item of validated) {
          expect(
            typeof item.title === 'string' || item.title === undefined
          ).toBe(true);
          expect(typeof item.url === 'string' || item.url === undefined).toBe(
            true
          );
        }

        console.log(
          `YouTube Scraper: Successfully validated ${validated.length} items`
        );
      }
    );
  });

  // Test 3: YouTube Transcript Scraper
  describe('YouTube Transcript Scraper', () => {
    test(
      'should scrape YouTube transcript and validate output schema',
      { timeout: 150000 },
      async () => {
        const actorId = 'pintostudio/youtube-transcript-scraper' as const;
        const schema = APIFY_ACTOR_SCHEMAS[actorId];

        const bubble = new ApifyBubble<typeof actorId>({
          actorId,
          input: {
            videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
          },
          credentials: {
            [CredentialType.APIFY_CRED]: APIFY_TOKEN,
          },
          waitForFinish: true,
          timeout: 120000,
        });

        const result = await bubble.action();

        expect(result.success).toBe(true);
        expect(result.data.status).toBe('SUCCEEDED');
        expect(result.data.items).toBeDefined();
        expect(Array.isArray(result.data.items)).toBe(true);
        expect(result.data.items!.length).toBeGreaterThan(0);

        // Validate and compare all items against the schema
        const { validated, hasSchemaIssues } = validateAndCompareSchema(
          schema.output,
          result.data.items!,
          actorId
        );

        expect(validated.length).toBe(result.data.items!.length);
        expect(hasSchemaIssues).toBe(false);

        // Check that data array exists in validated data
        for (const item of validated) {
          expect(item.data === undefined || Array.isArray(item.data)).toBe(
            true
          );
        }

        console.log(
          `YouTube Transcript: Successfully validated ${validated.length} items`
        );
      }
    );
  });

  // Test 4: LinkedIn Posts Search
  describe('LinkedIn Posts Search Scraper', () => {
    test(
      'should search LinkedIn posts and validate output schema',
      { timeout: 200000 },
      async () => {
        const actorId =
          'apimaestro/linkedin-posts-search-scraper-no-cookies' as const;
        const schema = APIFY_ACTOR_SCHEMAS[actorId];

        const bubble = new ApifyBubble<typeof actorId>({
          actorId,
          input: {
            keyword: 'artificial intelligence',
            limit: 5,
            sort_type: 'date_posted',
          },
          credentials: {
            [CredentialType.APIFY_CRED]: APIFY_TOKEN,
          },
          waitForFinish: true,
          timeout: 180000,
        });

        const result = await bubble.action();

        expect(result.success).toBe(true);
        expect(result.data.status).toBe('SUCCEEDED');
        expect(result.data.items).toBeDefined();
        expect(Array.isArray(result.data.items)).toBe(true);
        expect(result.data.items!.length).toBeGreaterThan(0);

        // Validate and compare all items against the schema
        const { validated, hasSchemaIssues } = validateAndCompareSchema(
          schema.output,
          result.data.items!,
          actorId
        );

        expect(validated.length).toBe(result.data.items!.length);
        expect(hasSchemaIssues).toBe(false);

        // Check specific fields in validated data
        for (const item of validated) {
          expect(typeof item.text === 'string' || item.text === undefined).toBe(
            true
          );
        }

        console.log(
          `LinkedIn Posts Search: Successfully validated ${validated.length} items`
        );
      }
    );
  });

  // Test 5: TikTok Scraper
  describe('TikTok Scraper', () => {
    test(
      'should scrape TikTok videos and validate output schema',
      { timeout: 200000 },
      async () => {
        const actorId = 'clockworks/tiktok-scraper' as const;
        const schema = APIFY_ACTOR_SCHEMAS[actorId];

        const bubble = new ApifyBubble<typeof actorId>({
          actorId,
          input: {
            hashtags: ['ai'],
            resultsPerPage: 3,
          },
          credentials: {
            [CredentialType.APIFY_CRED]: APIFY_TOKEN,
          },
          waitForFinish: true,
          timeout: 180000,
        });

        const result = await bubble.action();

        expect(result.success).toBe(true);
        expect(result.data.status).toBe('SUCCEEDED');
        expect(result.data.items).toBeDefined();
        expect(Array.isArray(result.data.items)).toBe(true);
        expect(result.data.items!.length).toBeGreaterThan(0);

        // Validate and compare all items against the schema
        const { validated, hasSchemaIssues } = validateAndCompareSchema(
          schema.output,
          result.data.items!,
          actorId
        );

        expect(validated.length).toBe(result.data.items!.length);
        expect(hasSchemaIssues).toBe(false);

        // Check specific fields in validated data
        for (const item of validated) {
          expect(typeof item.id === 'string' || item.id === undefined).toBe(
            true
          );
        }

        console.log(
          `TikTok Scraper: Successfully validated ${validated.length} items`
        );
      }
    );
  });

  // Test 6: Twitter User Scraper
  describe('Twitter User Scraper', () => {
    test(
      'should scrape Twitter tweets and validate output schema',
      { timeout: 200000 },
      async () => {
        const actorId = 'apidojo/tweet-scraper' as const;
        const schema = APIFY_ACTOR_SCHEMAS[actorId];

        const bubble = new ApifyBubble<typeof actorId>({
          actorId,
          input: {
            twitterHandles: ['Selinaliyy'],
            maxItems: 3,
          },
          credentials: {
            [CredentialType.APIFY_CRED]: APIFY_TOKEN,
          },
          waitForFinish: true,
          timeout: 180000,
        });

        const result = await bubble.action();
        if (!result.success) {
          console.error(JSON.stringify(result, null, 2));
        }

        expect(result.success).toBe(true);
        expect(result.data.status).toBe('SUCCEEDED');
        expect(result.data.items).toBeDefined();
        expect(Array.isArray(result.data.items)).toBe(true);
        expect(result.data.items!.length).toBeGreaterThan(0);

        // Validate and compare all items against the schema
        const { validated, hasSchemaIssues } = validateAndCompareSchema(
          schema.output,
          result.data.items!,
          actorId
        );

        expect(validated.length).toBe(result.data.items!.length);
        expect(hasSchemaIssues).toBe(false);

        // Check specific fields in validated data
        for (const item of validated) {
          expect(typeof item.text === 'string' || item.text === undefined).toBe(
            true
          );
        }

        console.log(
          `Twitter User Scraper: Successfully validated ${validated.length} items`
        );
      }
    );
  });

  // Test 7: Google Maps Scraper
  describe('Google Maps Scraper', () => {
    test(
      'should scrape Google Maps places and validate output schema',
      { timeout: 200000 },
      async () => {
        const actorId = 'compass/crawler-google-places' as const;
        const schema = APIFY_ACTOR_SCHEMAS[actorId];

        const bubble = new ApifyBubble<typeof actorId>({
          actorId,
          input: {
            searchStringsArray: ['coffee shops in San Francisco'],
            maxCrawledPlaces: 3,
            language: 'en',
          },
          limit: 10,
          credentials: {
            [CredentialType.APIFY_CRED]: APIFY_TOKEN,
          },
          waitForFinish: true,
          timeout: 180000,
        });

        const result = await bubble.action();
        if (!result.success) {
          console.error(JSON.stringify(result, null, 2));
        }
        expect(result.success).toBe(true);
        expect(result.data.status).toBe('SUCCEEDED');
        expect(result.data.items).toBeDefined();
        expect(Array.isArray(result.data.items)).toBe(true);
        expect(result.data.items!.length).toBeGreaterThan(0);

        // Validate and compare all items against the schema
        const { validated, hasSchemaIssues } = validateAndCompareSchema(
          schema.output,
          result.data.items!,
          actorId
        );

        expect(validated.length).toBe(result.data.items!.length);
        expect(hasSchemaIssues).toBe(false);

        // Check specific fields in validated data
        for (const item of validated) {
          expect(
            typeof item.title === 'string' || item.title === undefined
          ).toBe(true);
        }

        console.log(
          `Google Maps Scraper: Successfully validated ${validated.length} items`
        );
      }
    );
  });

  // Test 8: Instagram Profile Scraper
  describe('Instagram Profile Scraper', () => {
    test(
      'should scrape Instagram profile and validate output schema',
      { timeout: 200000 },
      async () => {
        const actorId = 'apify/instagram-scraper' as const;
        const schema = APIFY_ACTOR_SCHEMAS[actorId];

        const bubble = new ApifyBubble<typeof actorId>({
          actorId,
          input: {
            directUrls: ['https://www.instagram.com/natgeo/'],
            resultsType: 'posts',
            resultsLimit: 3,
          },
          credentials: {
            [CredentialType.APIFY_CRED]: APIFY_TOKEN,
          },
          waitForFinish: true,
          timeout: 180000,
        });

        const result = await bubble.action();

        expect(result.success).toBe(true);
        expect(result.data.status).toBe('SUCCEEDED');
        expect(result.data.items).toBeDefined();
        expect(Array.isArray(result.data.items)).toBe(true);
        expect(result.data.items!.length).toBeGreaterThan(0);

        // Validate and compare all items against the schema
        const { validated, hasSchemaIssues } = validateAndCompareSchema(
          schema.output,
          result.data.items!,
          actorId
        );

        expect(validated.length).toBe(result.data.items!.length);
        expect(hasSchemaIssues).toBe(false);

        // Check specific fields in validated data
        for (const item of validated) {
          expect(
            typeof item.username === 'string' || item.username === undefined
          ).toBe(true);
        }

        console.log(
          `Instagram Profile Scraper: Successfully validated ${validated.length} items`
        );
      }
    );
  });

  // Test 9: Instagram Hashtag Scraper
  describe('Instagram Hashtag Scraper', () => {
    test(
      'should scrape Instagram hashtag posts and validate output schema',
      { timeout: 200000 },
      async () => {
        const actorId = 'apify/instagram-hashtag-scraper' as const;
        const schema = APIFY_ACTOR_SCHEMAS[actorId];

        const bubble = new ApifyBubble<typeof actorId>({
          actorId,
          input: {
            hashtags: ['nature'],
            resultsLimit: 3,
          },
          credentials: {
            [CredentialType.APIFY_CRED]: APIFY_TOKEN,
          },
          waitForFinish: true,
          timeout: 180000,
        });

        const result = await bubble.action();

        expect(result.success).toBe(true);
        expect(result.data.status).toBe('SUCCEEDED');
        expect(result.data.items).toBeDefined();
        expect(Array.isArray(result.data.items)).toBe(true);
        expect(result.data.items!.length).toBeGreaterThan(0);

        // Validate and compare all items against the schema
        const { validated, hasSchemaIssues } = validateAndCompareSchema(
          schema.output,
          result.data.items!,
          actorId
        );

        expect(validated.length).toBe(result.data.items!.length);
        expect(hasSchemaIssues).toBe(false);

        // Check specific fields in validated data - hashtag posts should have url or shortCode
        for (const item of validated) {
          expect(
            typeof item.url === 'string' ||
              typeof item.shortCode === 'string' ||
              item.url === undefined
          ).toBe(true);
        }

        console.log(
          `Instagram Hashtag Scraper: Successfully validated ${validated.length} items`
        );
      }
    );
  });

  // Test 10: LinkedIn Profile Posts
  describe('LinkedIn Profile Posts Scraper', () => {
    test(
      'should scrape LinkedIn profile posts and validate output schema',
      { timeout: 200000 },
      async () => {
        const actorId = 'apimaestro/linkedin-profile-posts' as const;
        const schema = APIFY_ACTOR_SCHEMAS[actorId];

        const bubble = new ApifyBubble<typeof actorId>({
          actorId,
          input: {
            username: 'satyanadella', // LinkedIn username
            limit: 3,
          },
          credentials: {
            [CredentialType.APIFY_CRED]: APIFY_TOKEN,
          },
          waitForFinish: true,
          timeout: 180000,
        });

        const result = await bubble.action();

        expect(result.success).toBe(true);
        expect(result.data.status).toBe('SUCCEEDED');
        expect(result.data.items).toBeDefined();
        expect(Array.isArray(result.data.items)).toBe(true);
        expect(result.data.items!.length).toBeGreaterThan(0);

        // Validate and compare all items against the schema
        const { validated, hasSchemaIssues } = validateAndCompareSchema(
          schema.output,
          result.data.items!,
          actorId
        );

        expect(validated.length).toBe(result.data.items!.length);
        expect(hasSchemaIssues).toBe(false);

        // Check specific fields in validated data
        for (const item of validated) {
          expect(typeof item.text === 'string' || item.text === undefined).toBe(
            true
          );
        }

        console.log(
          `LinkedIn Profile Posts: Successfully validated ${validated.length} items`
        );
      }
    );
  });

  // Test credential validation
  describe('Apify Credential Validation', () => {
    test('should validate valid Apify credentials', async () => {
      const bubble = new ApifyBubble({
        actorId: 'apify/instagram-scraper',
        input: {
          directUrls: ['https://www.instagram.com/natgeo/'],
        },
        credentials: {
          [CredentialType.APIFY_CRED]: APIFY_TOKEN,
        },
      });

      const result = await bubble.testCredential();
      expect(result).toBe(true);
    });

    test('should invalidate invalid Apify credentials', async () => {
      const bubble = new ApifyBubble({
        actorId: 'apify/instagram-scraper',
        input: {
          directUrls: ['https://www.instagram.com/natgeo/'],
        },
        credentials: {
          [CredentialType.APIFY_CRED]: 'invalid-token-12345',
        },
      });

      const result = await bubble.testCredential();
      expect(result).toBe(false);
    });
  });
});
