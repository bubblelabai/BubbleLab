import { z } from 'zod';
import { ServiceBubble } from '../../../types/service-bubble-class.js';
import type { BubbleContext } from '../../../types/bubble.js';
import { CredentialType } from '@bubblelab/shared-schemas';
import type { ActorId, ActorOutput, ActorInput } from './types.js';

/**
 * Generic Apify Bubble - Works with ANY Apify Actor
 *
 * This is a universal service bubble that can run any Apify actor.
 * Actor-specific logic and data transformation should be handled by Tool Bubbles.
 *
 * Examples:
 * - InstagramTool uses this to run 'apify/instagram-scraper'
 * - RedditTool could use this to run 'apify/reddit-scraper'
 * - LinkedInTool could use this to run 'apify/linkedin-scraper'
 */

// Define the parameters schema for Apify operations
const ApifyParamsSchema = z.object({
  actorId: z
    .string()
    .describe(
      'The Apify actor to run. Examples: "apify/instagram-scraper", "apify/reddit-scraper", etc.'
    ),
  input: z
    .record(z.unknown())
    .describe(
      'Input parameters for the actor. Structure depends on the specific actor being used.'
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

// Result schema for Apify operations (generic for any actor)
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
    .array(z.unknown())
    .optional()
    .describe(
      'Array of scraped items (if waitForFinish is true). Structure depends on the actor.'
    ),
  itemsCount: z.number().optional().describe('Total number of items scraped'),
  consoleUrl: z.string().describe('URL to view the actor run in Apify console'),
  success: z.boolean().describe('Whether the operation was successful'),
  error: z.string().describe('Error message if operation failed'),
});

// Export types
export type ApifyParamsInput = z.input<typeof ApifyParamsSchema>;
export type ApifyActorInput = Record<string, unknown>;

type ApifyParams = z.output<typeof ApifyParamsSchema>;
type ApifyResult = z.output<typeof ApifyResultSchema>;

// Conditional input type based on whether actor ID is in the registry
type TypedApifyInput<T extends string> = T extends ActorId
  ? ActorInput<T>
  : Record<string, unknown>;

// Conditional result type based on whether actor ID is in the registry
type TypedApifyResult<T extends string> = T extends ActorId
  ? Omit<ApifyResult, 'items'> & { items?: ActorOutput<T>[] }
  : ApifyResult;

// Conditional params type that types the input field
type TypedApifyParams<T extends string> = Omit<ApifyParams, 'input'> & {
  input: TypedApifyInput<T>;
};

// Conditional params input type for constructor
export type TypedApifyParamsInput<T extends string> = Omit<
  ApifyParamsInput,
  'input'
> & {
  input: TypedApifyInput<T>;
};

// Apify API types
interface ApifyRunResponse {
  data: {
    id: string;
    status: string;
    defaultDatasetId?: string;
  };
}

export class ApifyBubble<T extends string = string> extends ServiceBubble<
  TypedApifyParams<T>,
  TypedApifyResult<T>
> {
  static readonly service = 'apify';
  static readonly authType = 'apikey' as const;
  static readonly bubbleName = 'apify';
  static readonly type = 'service' as const;
  static readonly schema = ApifyParamsSchema;
  static readonly resultSchema = ApifyResultSchema;
  static readonly shortDescription =
    'Run any Apify actor for web scraping and automation';
  static readonly longDescription = `
    Universal integration with Apify platform for running any Apify actor.

    This is a generic service bubble that can execute any Apify actor with any input.
    Actor-specific logic and data transformation should be handled by Tool Bubbles.

    Supported Actors (examples):
    - apify/instagram-scraper - Instagram posts, profiles, hashtags
    - apify/reddit-scraper - Reddit posts, comments, subreddits
    - apify/linkedin-scraper - LinkedIn profiles, companies, jobs
    - apify/web-scraper - Generic web scraping
    - apify/google-search-scraper - Google search results
    - And any other Apify actor available in the marketplace

    Features:
    - Asynchronous actor execution with optional wait for completion
    - Automatic result fetching from datasets
    - Generic result handling (works with any actor output)
    - Configurable limits and timeouts
    - Direct access to Apify console for monitoring

    Use cases:
    - Social media scraping (Instagram, Reddit, LinkedIn, etc.)
    - Web scraping and data extraction
    - Search engine result scraping
    - E-commerce data collection
    - Market research and competitor analysis

    Architecture:
    - Service Bubble (this): Generic Apify API integration
    - Tool Bubbles (e.g. InstagramTool): Domain-specific data transformation

    Security:
    - API key authentication (APIFY_CRED)
    - Secure credential injection at runtime
  `;
  static readonly alias = 'scrape';

  constructor(params: TypedApifyParamsInput<T>, context?: BubbleContext) {
    super(params as TypedApifyParams<T>, context);
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

  protected async performAction(
    context?: BubbleContext
  ): Promise<TypedApifyResult<T>> {
    void context;

    const apiToken = this.chooseCredential();
    if (!apiToken) {
      return {
        runId: '',
        status: 'FAILED',
        consoleUrl: '',
        success: false,
        error: 'Apify API token is required but was not provided',
      } as TypedApifyResult<T>;
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
        } as TypedApifyResult<T>;
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
        } as TypedApifyResult<T>;
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
        } as TypedApifyResult<T>;
      }

      // Fetch results from dataset
      const items: unknown[] = [];
      let itemsCount = 0;

      if (finalStatus.defaultDatasetId) {
        const datasetItems = await this.fetchDatasetItems(
          apiToken,
          finalStatus.defaultDatasetId
        );
        items.push(...datasetItems);
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
      } as TypedApifyResult<T>;
    } catch (error) {
      return {
        runId: '',
        status: 'FAILED',
        consoleUrl: '',
        success: false,
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
      } as TypedApifyResult<T>;
    }
  }

  private async startActorRun(
    apiToken: string,
    actorId: string,
    input: Record<string, unknown>
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
