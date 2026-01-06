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
    .optional()
    .describe(
      'The Apify actor to run. Examples: "apify/instagram-scraper", "apify/reddit-scraper", etc. Required when running an actor, not needed for discovery mode.'
    ),
  search: z
    .string()
    .optional()
    .describe(
      'Search query to discover available Apify actors. When provided, this triggers discovery mode to search for actors matching the query and return their schemas and information.'
    ),
  limit: z
    .number()
    .min(1)
    .max(100)
    .optional()
    .default(20)
    .describe(
      'Maximum number of actors to return in discovery mode (default: 20, max: 100)'
    ),
  input: z
    .record(z.unknown())
    .describe(
      'Input parameters for the actor. Structure depends on the specific actor being used. Not used in discovery mode.'
    ),
  waitForFinish: z
    .boolean()
    .optional()
    .default(true)
    .describe('Whether to wait for the actor run to complete before returning'),
  timeout: z
    .number()
    .min(1000)
    .max(500000)
    .optional()
    .default(300000)
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
      'Array of scraped items (if waitForFinish is true). Structure depends on the actor. For discovery mode, contains actor information with schemas.'
    ),
  itemsCount: z.number().optional().describe('Total number of items scraped'),
  consoleUrl: z.string().describe('URL to view the actor run in Apify console'),
  success: z.boolean().describe('Whether the operation was successful'),
  error: z.string().describe('Error message if operation failed'),
  // Discovery-specific fields
  discoveredActors: z
    .array(
      z.object({
        id: z.string().describe('Actor ID (e.g., "apify/instagram-scraper")'),
        name: z
          .string()
          .describe('Full actor path (e.g., "beauty/linkedin-jobs-scraper")'),
        description: z
          .string()
          .nullable()
          .optional()
          .describe('Actor description'),
        inputSchemaUrl: z
          .string()
          .describe(
            'URL to the actor input schema page. Use the web scrape tool to scrape from this URL (e.g., https://apify.com/apify/google-search-scraper/input-schema) to get the input/output schema details.'
          ),
        stars: z
          .number()
          .nullable()
          .optional()
          .describe('Actor rating (if available)'),
        usage: z
          .object({
            totalRuns: z.number().optional(),
            usersCount: z.number().optional(),
          })
          .nullable()
          .optional()
          .describe('Basic usage stats'),
        requiresRental: z
          .boolean()
          .optional()
          .describe(
            'Whether this actor requires rental/private access (filtered out when true)'
          ),
      })
    )
    .optional()
    .describe(
      'Discovered actors with description and input schema URL (only present in discovery mode)'
    ),
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
    'Discover and run specialized Apify actors for complex web scraping tasks not covered by standard tools';
  static readonly longDescription = `
    Universal integration with Apify platform for running any Apify actor.

    This is a generic service bubble that can execute any Apify actor with any input.
    Actor-specific logic and data transformation should be handled by Tool Bubbles.

    Integrated Actors, use them through instagram-tool, reddit-tool, linkedin-tool, youtube-tool, tiktok-tool, twitter-tool, google-maps-tool, etc, not directly:
    - apify/instagram-scraper - Instagram posts, profiles, hashtags
    - apify/instagram-hashtag-scraper - Instagram hashtag posts
    - apimaestro/linkedin-profile-posts - LinkedIn profile posts and activity
    - apimaestro/linkedin-posts-search-scraper-no-cookies - Search LinkedIn posts by keyword
    - curious_coder/linkedin-jobs-scraper - LinkedIn job postings
    - streamers/youtube-scraper - YouTube videos and channels
    - pintostudio/youtube-transcript-scraper - YouTube video transcripts
    - clockworks/tiktok-scraper - TikTok profiles, videos, hashtags
    - apidojo/tweet-scraper - Twitter/X profiles, tweets, search results
    - compass/crawler-google-places - Google Maps business listings and reviews
    - IMPORTANT: For other actors, use discovery mode to find the actor and its page, then use the web scrape tool to scrape the input schema page to get the input/output schema details.

    Discovery Mode:
    - Provide a "search" parameter to discover available actors
    - Optionally set "limit" to control the number of results (default: 20, max: 100)
    - Returns actor information including input schemas, descriptions, and metadata
    - This mode is specifically designed for discovering available actors and their capabilities
    - Example: { search: "google flights prices", limit: 10 } to find Google flights related actors

    Use cases:
    - Discovering available actors and their schemas then
    - IMPORTANT: Specific scraping tasks that are not covered by the supported actors and seems hard to do through normal scraping by going to actor https://apify.com/$owner/$actorid/input-schema page and scrape the input schema details.

    DO NOT Use:
    - Media generation tasks (e.g., image generation, video generation, audio generation, etc.)

  `;
  static readonly alias = 'scrape';

  constructor(
    params: TypedApifyParamsInput<T>,
    context?: BubbleContext,
    instanceId?: string
  ) {
    super(params as TypedApifyParams<T>, context, instanceId);
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
      const { actorId, search, limit, input, waitForFinish, timeout } =
        this.params;

      // Discovery mode: search for actors when search parameter is provided
      if (search) {
        return (await this.discoverActors(
          apiToken,
          search,
          limit || 20
        )) as TypedApifyResult<T>;
      }

      // Normal mode: require actorId
      if (!actorId) {
        return {
          runId: '',
          status: 'FAILED',
          consoleUrl: '',
          success: false,
          error: 'Either actorId or search parameter is required',
        } as TypedApifyResult<T>;
      }

      // Start the actor run
      const runResponse = await this.startActorRun(
        apiToken,
        actorId,
        input,
        limit,
        waitForFinish,
        timeout
      );

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

      // Log service usage for Apify actor execution
      if (itemsCount > 0 && this.context?.logger) {
        this.context.logger.logTokenUsage(
          {
            usage: itemsCount,
            service: CredentialType.APIFY_CRED,
            unit: 'per_result',
            subService: actorId,
          },
          `Apify actor ${actorId}: ${itemsCount} results`,
          {
            bubbleName: 'apify',
            variableId: this.context?.variableId,
            operationType: 'bubble_execution',
          }
        );
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
    input: Record<string, unknown>,
    limit?: number,
    waitForFinish?: boolean,
    timeout?: number
  ): Promise<ApifyRunResponse> {
    // Replace '/' with '~' in actor ID for API endpoint
    const apiActorId = actorId.replace('/', '~');
    const url = new URL(`https://api.apify.com/v2/acts/${apiActorId}/runs`);

    // Add query parameters for cost control
    url.searchParams.set('maxItems', String(limit));

    // Always set max charge to $5
    url.searchParams.set('maxTotalChargeUsd', '5');

    // Add waitForFinish query parameter (in seconds)
    if (waitForFinish && timeout !== undefined) {
      // Convert timeout from milliseconds to seconds
      const waitSeconds = Math.floor(timeout / 1000);
      url.searchParams.set('waitForFinish', String(waitSeconds));
    }

    const bodyJson = JSON.stringify(input);
    const requestUrl = url.toString();

    const response = await fetch(requestUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiToken}`,
      },
      body: bodyJson,
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

  /**
   * Discovery mode: Search for available Apify actors and return their information
   * This is a special mode activated when the "search" parameter is provided
   */
  private async discoverActors(
    apiToken: string,
    query: string,
    limit: number
  ): Promise<ApifyResult> {
    try {
      // Search for actors in the Apify store
      const searchUrl = new URL('https://api.apify.com/v2/store');
      if (query) {
        searchUrl.searchParams.set('search', query);
      }
      searchUrl.searchParams.set('limit', limit.toString()); // Cap at 100

      const searchResponse = await fetch(searchUrl.toString(), {
        headers: {
          Authorization: `Bearer ${apiToken}`,
        },
      });

      if (!searchResponse.ok) {
        throw new Error(
          `Failed to search actors: ${searchResponse.status} - ${await searchResponse.text()}`
        );
      }

      const searchData = (await searchResponse.json()) as {
        data: {
          items: Array<{
            id: string;
            username: string;
            name: string;
            description?: string;
            stats?: {
              totalRuns?: number;
              usersCount?: number;
            };
            defaultRunOptions?: Record<string, unknown>;
            readme?: string;
            storeUrl?: string;
          }>;
        };
      };

      const actors = searchData.data?.items || [];

      // Build actor information with input schema URL, skipping rental/private actors
      const discoveredActors = (
        await Promise.all(
          actors.map(async (actor) => {
            try {
              // Prefer the actor id (username~actor-slug); build a display path with '/'
              // If the id is not in that format, fall back to username/name
              const displayPath = actor.id.includes('~')
                ? actor.id.replace('~', '/')
                : actor.username && actor.name
                  ? `${actor.username}/${actor.name}`
                  : actor.id;

              // Build the input schema URL using the display path
              const inputSchemaUrl = `https://apify.com/${displayPath}/input-schema`;

              // Fetch actor detail to determine if it is public or requires rental
              let requiresRental = false;
              try {
                const actorUrl = `https://api.apify.com/v2/acts/${actor.id}`;
                const detailResp = await fetch(actorUrl, {
                  headers: { Authorization: `Bearer ${apiToken}` },
                });
                if (detailResp.ok) {
                  const detailData = (await detailResp.json()) as {
                    data?: {
                      isPublic?: boolean;
                      pricingInfos?: Array<{ pricingModel?: string }>;
                    };
                  };
                  if (detailData.data?.isPublic === false) {
                    requiresRental = true;
                  }
                  if (
                    detailData.data?.pricingInfos?.some(
                      (p) => p.pricingModel === 'FLAT_PRICE_PER_MONTH'
                    )
                  ) {
                    requiresRental = true;
                  }
                }
              } catch {
                // ignore detail fetch errors; default to not filtering out
              }

              // Skip rental/private actors
              if (requiresRental) {
                return null;
              }

              return {
                id: actor.id, // raw actor id
                name: displayPath, // Full path (e.g., "beauty/linkedin-jobs-scraper")
                description: actor.description || null,
                inputSchemaUrl,
                stars: null,
                usage: actor.stats
                  ? {
                      totalRuns: actor.stats.totalRuns,
                      usersCount: actor.stats.usersCount,
                    }
                  : null,
                requiresRental,
              };
            } catch {
              return null;
            }
          })
        )
      ).filter((a): a is NonNullable<typeof a> => Boolean(a));

      return {
        runId: '',
        status: 'SUCCEEDED',
        consoleUrl: 'https://apify.com/store',
        success: true,
        error: '',
        items: discoveredActors,
        itemsCount: discoveredActors.length,
        discoveredActors,
      };
    } catch (error) {
      return {
        runId: '',
        status: 'FAILED',
        consoleUrl: '',
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Unknown error during actor discovery',
        discoveredActors: [],
      };
    }
  }
}
