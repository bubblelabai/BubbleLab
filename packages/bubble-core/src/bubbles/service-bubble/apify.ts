import { z } from 'zod';
import { ServiceBubble } from '../../types/service-bubble-class.js';
import type { BubbleContext } from '../../types/bubble.js';
import { CredentialType } from '@bubblelab/shared-schemas';

// Define supported actor types as an enum
const ApifyActorTypeSchema = z.enum(['apify/instagram-scraper']);

// Instagram scraper result types
const InstagramResultTypeSchema = z.enum(['posts', 'details', 'comments']);

// Instagram search types
const InstagramSearchTypeSchema = z.enum(['hashtag', 'user', 'place']);

// Schema for Instagram scraper input
const InstagramScraperInputSchema = z.object({
  directUrls: z
    .array(z.string().url('Must be a valid Instagram URL'))
    .min(1, 'At least one Instagram URL is required')
    .describe('Array of Instagram URLs to scrape (profiles, posts, etc.)'),
  resultsType: InstagramResultTypeSchema.optional()
    .default('posts')
    .describe(
      'Type of results to fetch: posts, details (profile info), or comments'
    ),
  resultsLimit: z
    .number()
    .min(1)
    .max(1000)
    .optional()
    .default(200)
    .describe('Maximum number of results to fetch (1-1000)'),
  searchType: InstagramSearchTypeSchema.optional()
    .default('hashtag')
    .describe('Type of search: hashtag, user, or place'),
  searchLimit: z
    .number()
    .min(1)
    .max(100)
    .optional()
    .default(1)
    .describe('Maximum number of search results (1-100)'),
});

// Define the parameters schema for Apify operations
const ApifyParamsSchema = z.object({
  actorId: ApifyActorTypeSchema.describe(
    'The Apify actor to run (currently supports: apify/instagram-scraper)'
  ),
  input: InstagramScraperInputSchema.describe(
    'Input parameters for the Instagram scraper'
  ),
  waitForFinish: z
    .boolean()
    .optional()
    .default(true)
    .describe('Whether to wait for the actor run to complete before returning'),
  timeout: z
    .number()
    .min(1000)
    .max(300000)
    .optional()
    .default(120000)
    .describe(
      'Maximum time to wait for actor completion in milliseconds (default: 120000)'
    ),
  credentials: z
    .record(z.nativeEnum(CredentialType), z.string())
    .optional()
    .describe(
      'Object mapping credential types to values (injected at runtime)'
    ),
});

// Instagram post data schema
const InstagramPostSchema = z
  .object({
    id: z.string().optional().nullable().describe('Post ID'),
    type: z
      .string()
      .optional()
      .nullable()
      .describe('Post type (image, video, carousel)'),
    shortCode: z.string().optional().nullable().describe('Instagram shortcode'),
    caption: z.string().optional().nullable().describe('Post caption text'),
    hashtags: z
      .array(z.string())
      .optional()
      .nullable()
      .describe('Hashtags used in post'),
    mentions: z
      .array(z.string())
      .optional()
      .nullable()
      .describe('User mentions in post'),
    url: z.string().optional().nullable().describe('Post URL'),
    commentsCount: z
      .number()
      .optional()
      .nullable()
      .describe('Number of comments'),
    likesCount: z.number().optional().nullable().describe('Number of likes'),
    timestamp: z.string().optional().nullable().describe('Post timestamp'),
    ownerUsername: z
      .string()
      .optional()
      .nullable()
      .describe('Post owner username'),
    ownerId: z.string().optional().nullable().describe('Post owner ID'),
    displayUrl: z.string().optional().nullable().describe('Display image URL'),
    images: z.array(z.string()).optional().nullable().describe('Post images'),
    alt: z.string().optional().nullable().describe('Alt text'),
  })
  .passthrough()
  .describe('Instagram post data');

// Result schema for Apify operations
const ApifyResultSchema = z.object({
  runId: z.string().describe('Apify actor run ID'),
  status: z
    .string()
    .describe('Actor run status (READY, RUNNING, SUCCEEDED, FAILED, etc.)'),
  datasetId: z
    .string()
    .optional()
    .describe('Dataset ID where results are stored'),
  items: z
    .array(InstagramPostSchema)
    .optional()
    .describe('Array of scraped items (if waitForFinish is true)'),
  itemsCount: z.number().optional().describe('Total number of items scraped'),
  consoleUrl: z.string().describe('URL to view the actor run in Apify console'),
  success: z.boolean().describe('Whether the operation was successful'),
  error: z.string().describe('Error message if operation failed'),
});

// Export types
export type ApifyParamsInput = z.input<typeof ApifyParamsSchema>;
export type InstagramScraperInput = z.input<typeof InstagramScraperInputSchema>;
export type InstagramPost = z.output<typeof InstagramPostSchema>;

type ApifyParams = z.output<typeof ApifyParamsSchema>;
type ApifyResult = z.output<typeof ApifyResultSchema>;

// Apify API types
interface ApifyRunResponse {
  data: {
    id: string;
    status: string;
    defaultDatasetId?: string;
  };
}

export class ApifyBubble extends ServiceBubble<ApifyParams, ApifyResult> {
  static readonly service = 'apify';
  static readonly authType = 'apikey' as const;
  static readonly bubbleName = 'apify';
  static readonly type = 'service' as const;
  static readonly schema = ApifyParamsSchema;
  static readonly resultSchema = ApifyResultSchema;
  static readonly shortDescription =
    'Run Apify actors for web scraping (Instagram scraper)';
  static readonly longDescription = `
    Integration with Apify platform for running web scraping actors.
    
    Currently supports:
    - Instagram scraper (apify/instagram-scraper) - Scrape Instagram posts, profiles, hashtags, and comments
    
    Features:
    - Asynchronous actor execution with optional wait for completion
    - Automatic result fetching from datasets
    - Support for Instagram profiles, hashtags, and posts
    - Configurable limits and timeouts
    - Direct access to Apify console for monitoring
    
    Use cases:
    - Social media monitoring and analytics
    - Content aggregation from Instagram
    - Influencer analysis
    - Hashtag trend tracking
    - Competitor research
    
    Security:
    - API key authentication
    - Secure credential injection at runtime
  `;
  static readonly alias = 'scrape';

  constructor(
    params: ApifyParamsInput = {
      actorId: 'apify/instagram-scraper',
      input: {
        directUrls: ['https://www.instagram.com/explore/'],
        resultsType: 'posts',
        resultsLimit: 200,
      },
    },
    context?: BubbleContext
  ) {
    super(params, context);
  }

  protected chooseCredential(): string | undefined {
    const credentials = this.params.credentials;
    if (!credentials || typeof credentials !== 'object') {
      return undefined;
    }
    return credentials[CredentialType.APIFY_CRED];
  }

  public async testCredential(): Promise<boolean> {
    const apiToken = this.chooseCredential();
    if (!apiToken) {
      return false;
    }

    try {
      // Test the credential by making a simple API call to get user info
      const response = await fetch('https://api.apify.com/v2/users/me', {
        headers: {
          Authorization: `Bearer ${apiToken}`,
        },
      });

      return response.ok;
    } catch {
      return false;
    }
  }

  protected async performAction(context?: BubbleContext): Promise<ApifyResult> {
    void context;

    const apiToken = this.chooseCredential();
    if (!apiToken) {
      return {
        runId: '',
        status: 'FAILED',
        consoleUrl: '',
        success: false,
        error: 'Apify API token is required but was not provided',
      };
    }

    try {
      const { actorId, input, waitForFinish, timeout } = this.params;

      // Start the actor run
      const runResponse = await this.startActorRun(apiToken, actorId, input);

      if (!runResponse.data?.id) {
        return {
          runId: '',
          status: 'FAILED',
          consoleUrl: '',
          success: false,
          error: 'Failed to start actor run - no run ID returned',
        };
      }

      const runId = runResponse.data.id;
      const consoleUrl = `https://console.apify.com/actors/runs/${runId}`;

      // If not waiting for finish, return immediately
      if (!waitForFinish) {
        return {
          runId,
          status: runResponse.data.status,
          datasetId: runResponse.data.defaultDatasetId,
          consoleUrl,
          success: true,
          error: '',
        };
      }

      // Wait for actor to finish
      const finalStatus = await this.waitForActorCompletion(
        apiToken,
        runId,
        timeout || 120000
      );

      if (finalStatus.status !== 'SUCCEEDED') {
        return {
          runId,
          status: finalStatus.status,
          datasetId: finalStatus.defaultDatasetId,
          consoleUrl,
          success: false,
          error: `Actor run ${finalStatus.status.toLowerCase()}: ${finalStatus.status}`,
        };
      }

      // Fetch results from dataset
      const items: InstagramPost[] = [];
      let itemsCount = 0;

      if (finalStatus.defaultDatasetId) {
        const datasetItems = await this.fetchDatasetItems(
          apiToken,
          finalStatus.defaultDatasetId
        );
        items.push(...(datasetItems as InstagramPost[]));
        itemsCount = items.length;
      }

      return {
        runId,
        status: finalStatus.status,
        datasetId: finalStatus.defaultDatasetId,
        items,
        itemsCount,
        consoleUrl,
        success: true,
        error: '',
      };
    } catch (error) {
      return {
        runId: '',
        status: 'FAILED',
        consoleUrl: '',
        success: false,
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  private async startActorRun(
    apiToken: string,
    actorId: string,
    input: z.infer<typeof InstagramScraperInputSchema>
  ): Promise<ApifyRunResponse> {
    // Replace '/' with '~' in actor ID for API endpoint
    const apiActorId = actorId.replace('/', '~');
    const url = `https://api.apify.com/v2/acts/${apiActorId}/runs`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiToken}`,
      },
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Failed to start Apify actor: ${response.status} - ${errorText}`
      );
    }

    return response.json() as Promise<ApifyRunResponse>;
  }

  private async waitForActorCompletion(
    apiToken: string,
    runId: string,
    timeout: number
  ): Promise<{ status: string; defaultDatasetId?: string }> {
    const startTime = Date.now();
    const pollInterval = 2000; // Poll every 2 seconds

    while (Date.now() - startTime < timeout) {
      const status = await this.getRunStatus(apiToken, runId);

      if (
        status.status === 'SUCCEEDED' ||
        status.status === 'FAILED' ||
        status.status === 'ABORTED' ||
        status.status === 'TIMED-OUT'
      ) {
        return status;
      }

      // Wait before polling again
      await new Promise((resolve) => setTimeout(resolve, pollInterval));
    }

    throw new Error(`Actor run timed out after ${timeout}ms`);
  }

  private async getRunStatus(
    apiToken: string,
    runId: string
  ): Promise<{ status: string; defaultDatasetId?: string }> {
    const url = `https://api.apify.com/v2/actor-runs/${runId}`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${apiToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to get run status: ${response.status}`);
    }

    const data = (await response.json()) as ApifyRunResponse;
    return {
      status: data.data.status,
      defaultDatasetId: data.data.defaultDatasetId,
    };
  }

  private async fetchDatasetItems(
    apiToken: string,
    datasetId: string
  ): Promise<unknown[]> {
    const url = `https://api.apify.com/v2/datasets/${datasetId}/items`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${apiToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch dataset items: ${response.status}`);
    }

    // Apify returns items directly as an array, not wrapped in a data object
    const items = (await response.json()) as unknown[];
    return items;
  }
}
