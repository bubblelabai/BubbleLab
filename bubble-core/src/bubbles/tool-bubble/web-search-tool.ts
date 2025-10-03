import { z } from 'zod';
import { ToolBubble } from '../../types/tool-bubble-class.js';
import type { BubbleContext } from '../../types/bubble.js';
import FirecrawlApp, { type SearchRequest } from '@mendable/firecrawl-js';
import { CredentialType, type BubbleName } from '@bubblelab/shared-schemas';

// Type definitions for Firecrawl search response
interface FirecrawlSearchResult {
  title?: string;
  name?: string;
  url?: string;
  link?: string;
  content?: string;
  description?: string;
  text?: string;
  markdown?: string;
}

interface FirecrawlSearchResponse {
  data?: FirecrawlSearchResult[];
  web?: FirecrawlSearchResult[];
}

// Define the parameters schema - simplified like the MCP server
const WebSearchToolParamsSchema = z.object({
  query: z
    .string()
    .min(1, 'Search query is required')
    .describe('The search query to execute'),
  limit: z
    .number()
    .min(1, 'Minimum number of search results to return is 1')
    .max(4, 'Maximum number of search results to return is 4')
    .default(3)
    .describe('Maximum number of search results to return'),
  location: z
    .string()
    .optional()
    .describe('Location parameter for search results (e.g., "us", "uk")'),
  credentials: z
    .record(z.nativeEnum(CredentialType), z.string())
    .optional()
    .describe('Required credentials including FIRECRAWL_API_KEY'),
});

// Result schema for validation
const WebSearchToolResultSchema = z.object({
  results: z
    .array(
      z.object({
        title: z.string().describe('Title of the search result'),
        url: z.string().url().describe('URL of the search result'),
        content: z.string().describe('Content snippet from the search result'),
      })
    )
    .describe('Array of search results with title, URL, and content'),
  query: z.string().describe('The original search query'),
  totalResults: z.number().describe('Number of results returned'),
  searchEngine: z.string().describe('Search engine used (Firecrawl)'),
  success: z.boolean().describe('Whether the search was successful'),
  error: z.string().describe('Error message if search failed'),
});

// Type definitions
type WebSearchToolParams = z.output<typeof WebSearchToolParamsSchema>;
type WebSearchToolResult = z.output<typeof WebSearchToolResultSchema>;
type WebSearchToolParamsInput = z.input<typeof WebSearchToolParamsSchema>;

export class WebSearchTool extends ToolBubble<
  WebSearchToolParams,
  WebSearchToolResult
> {
  // Required static metadata
  static readonly bubbleName: BubbleName = 'web-search-tool';
  static readonly schema = WebSearchToolParamsSchema;
  static readonly resultSchema = WebSearchToolResultSchema;
  static readonly shortDescription =
    'Performs web searches using Firecrawl to find current information from the web';
  static readonly longDescription = `
    A comprehensive web search tool that uses Firecrawl to find current information from the web.
    
    Features:
    - High-quality web search results with content extraction
    - Configurable result limits (1-20 results)
    - Location-based search for regional results
    - Clean, structured content extraction from search results
    - Requires FIRECRAWL_API_KEY credential
    
    Use cases:
    - Finding current events and news
    - Researching topics with web content
    - Getting up-to-date information for decision making
    - Answering questions that require web knowledge
    - Market research and competitive analysis
    - Real-time data gathering from the web
  `;
  static readonly alias = 'websearch';
  static readonly type = 'tool';

  constructor(
    params: WebSearchToolParamsInput = { query: '' },
    context?: BubbleContext
  ) {
    super(params, context);
  }

  async performAction(context?: BubbleContext): Promise<WebSearchToolResult> {
    void context; // Context available but not currently used

    const { query, limit, location } = this.params;

    try {
      // Validate limit range
      const limitedResults = Math.min(Math.max(limit, 1), 20);

      // Get Firecrawl API key from credentials
      const apiKey = this.params.credentials?.FIRECRAWL_API_KEY;
      if (!apiKey) {
        throw new Error(
          'FIRECRAWL_API_KEY is required but not provided in credentials'
        );
      }

      // Initialize Firecrawl client
      const firecrawl = new FirecrawlApp({ apiKey });

      // Build search parameters according to Firecrawl API with defaults
      const searchOptions: Omit<SearchRequest, 'query'> = {
        limit: limitedResults,
        // Default sources to web search
        sources: ['web'],
        // Default scrape options for better content extraction
        scrapeOptions: {
          formats: ['markdown'],
          onlyMainContent: true,
        },
      };

      // Add optional parameters if provided
      if (location) {
        searchOptions.location = location;
      }

      console.log('[WebSearchTool] Searching with params:', {
        query,
        ...searchOptions,
      });

      // Execute search using Firecrawl
      const searchResult = await firecrawl.search(query, searchOptions);

      // Handle the response based on Firecrawl's actual API structure
      // The search API might return different structures, so handle both cases
      let resultsArray: FirecrawlSearchResult[] = [];

      if (Array.isArray(searchResult)) {
        resultsArray = searchResult as FirecrawlSearchResult[];
      } else {
        const response = searchResult as FirecrawlSearchResponse;
        if (response?.data && Array.isArray(response.data)) {
          resultsArray = response.data;
        } else if (response?.web && Array.isArray(response.web)) {
          resultsArray = response.web;
        } else {
          throw new Error(
            'No search results returned or unexpected response format'
          );
        }
      }

      // Transform Firecrawl results to our format
      const results = resultsArray.map((item: FirecrawlSearchResult) => ({
        title: item.title || item.name || 'No title',
        url: item.url || item.link || '',
        content:
          item.content ||
          item.description ||
          item.text ||
          item.markdown ||
          'No content available',
      }));

      return {
        results,
        query,
        totalResults: results.length,
        searchEngine: 'Firecrawl',
        success: true,
        error: '',
      };
    } catch (error) {
      console.error('[WebSearchTool] Search error:', error);

      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      return {
        results: [],
        query,
        totalResults: 0,
        searchEngine: 'Firecrawl',
        success: false,
        error: errorMessage,
      };
    }
  }
}
