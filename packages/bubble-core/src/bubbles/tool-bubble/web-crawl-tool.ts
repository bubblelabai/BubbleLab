import { z } from 'zod';
import { ToolBubble } from '../../types/tool-bubble-class.js';
import type { BubbleContext } from '../../types/bubble.js';
import FirecrawlApp from '@mendable/firecrawl-js';
import { CredentialType, type BubbleName } from '@bubblelab/shared-schemas';
import { AIAgentBubble } from '../service-bubble/ai-agent.js';

// Enhanced parameters schema for web crawling
const WebCrawlToolParamsSchema = z.object({
  url: z
    .string()
    .url('Must be a valid URL')
    .describe('The root URL to crawl and extract content from'),
  format: z
    .enum(['markdown'])
    .default('markdown')
    .describe('Output format for crawled content'),
  onlyMainContent: z
    .boolean()
    .default(true)
    .describe('Extract only main content, filtering out navigation/footers'),

  // Crawl-specific parameters
  maxPages: z
    .number()
    .min(1)
    .max(100)
    .default(10)
    .optional()
    .describe('Maximum number of pages to crawl'),
  crawlDepth: z
    .number()
    .min(1)
    .max(5)
    .default(2)
    .optional()
    .describe('Maximum depth to crawl'),
  includePaths: z
    .array(z.string())
    .optional()
    .describe(
      'URL patterns to include in crawl (regex patterns), Example: ["^/blog/.*$", "^/docs/.*$"]'
    ),
  excludePaths: z
    .array(z.string())
    .optional()
    .describe(
      'URL patterns to exclude from crawl (regex patterns), ["^/admin/.*$", "^/private/.*$"]'
    ),

  // General parameters
  waitFor: z
    .number()
    .min(0)
    .max(30000)
    .default(3000)
    .describe('Time to wait for dynamic content in milliseconds'),
  credentials: z
    .record(z.nativeEnum(CredentialType), z.string())
    .optional()
    .describe('Required credentials including FIRECRAWL_API_KEY'),
});

// Result schema for crawl operations
const WebCrawlToolResultSchema = z.object({
  url: z.string().url().describe('The original URL that was crawled'),
  success: z.boolean().describe('Whether the crawl operation was successful'),
  error: z.string().describe('Error message if crawl failed'),

  // Crawl results
  pages: z
    .array(
      z.object({
        url: z.string().url(),
        title: z.string().optional(),
        content: z.string(),
        depth: z.number().optional(),
      })
    )
    .describe('Array of crawled pages with content'),
  totalPages: z.number().describe('Total number of pages crawled'),

  // Metadata
  metadata: z
    .object({
      loadTime: z.number().optional(),
      crawlDepth: z.number().optional(),
      maxPagesReached: z.boolean().optional(),
    })
    .optional()
    .describe('Additional metadata about the crawl operation'),
});

// Type definitions
type WebCrawlToolParams = z.input<typeof WebCrawlToolParamsSchema>;
type WebCrawlToolResult = z.output<typeof WebCrawlToolResultSchema>;
type WebCrawlToolParamsInput = z.input<typeof WebCrawlToolParamsSchema>;

export class WebCrawlTool extends ToolBubble<
  WebCrawlToolParams,
  WebCrawlToolResult
> {
  // Required static metadata
  static readonly bubbleName: BubbleName = 'web-crawl-tool';
  static readonly schema = WebCrawlToolParamsSchema;
  static readonly resultSchema = WebCrawlToolResultSchema;
  static readonly shortDescription =
    'Multi-page web crawling tool for exploring entire websites and subdomains.';
  static readonly longDescription = `
    A powerful web crawling tool that can systematically explore websites and extract content from multiple pages.
    
    🕷️ CRAWL Features:
    - Recursively crawl websites and subdomains
    - Configurable crawl depth and page limits (up to 100 pages)
    - URL pattern filtering (include/exclude paths)
    - Multiple format support (markdown, html, links, rawHtml)
    - Main content focus filtering
    - Discover and extract content from entire sites
    
    Technical Features:
    - Handles JavaScript-rendered pages and dynamic content
    - Robust error handling and retry mechanisms
    - Configurable wait times for dynamic content
    - Requires FIRECRAWL_API_KEY credential
    
    Use Cases:
    - Site mapping and competitive analysis
    - Documentation aggregation across multiple pages  
    - Content analysis and research across domains
    - SEO analysis and site structure discovery
    - Building comprehensive datasets from websites
  `;
  static readonly alias = 'crawl';
  static readonly type = 'tool';

  constructor(
    params: WebCrawlToolParamsInput = { url: '' },
    context?: BubbleContext
  ) {
    super(params, context);
  }

  async performAction(context?: BubbleContext): Promise<WebCrawlToolResult> {
    void context; // Context available but not currently used

    const { url } = this.params;
    const startTime = Date.now();

    try {
      // Get Firecrawl API key from credentials
      const apiKey = this.params.credentials?.FIRECRAWL_API_KEY;
      if (!apiKey) {
        throw new Error(
          'FIRECRAWL_API_KEY is required but not provided in credentials'
        );
      }

      // Initialize Firecrawl client
      const firecrawl = new FirecrawlApp({ apiKey });

      console.log(`[WebCrawlTool] Starting crawl for URL:`, url);

      const crawlResult = await this.executeCrawl(firecrawl, startTime);

      // Process pages in batches of 5 for parallel summarization
      const batchSize = 5;
      const pageCount = crawlResult.pages.length;

      for (
        let batchStart = 0;
        batchStart < pageCount;
        batchStart += batchSize
      ) {
        const batchEnd = Math.min(batchStart + batchSize, pageCount);
        const batch = crawlResult.pages.slice(batchStart, batchEnd);

        // Create promises for parallel processing
        const summarizePromises = batch.map(async (page, batchIndex) => {
          const summarizeAgent = new AIAgentBubble(
            {
              message: `Summarize the crawled page to condense all information and remove any non-essential information, include all links, contact information, companies, don't omit any information. Content: ${page.content}`,
              model: {
                model: 'google/gemini-2.5-flash-lite',
              },
              name: 'Crawl Page Summarizer Agent',
              credentials: this.params.credentials,
            },
            this.context
          );

          try {
            const result = await summarizeAgent.action();
            console.log(
              '[WebCrawlTool] Summarized page content for:',
              page.url,
              result.data?.response
            );

            return {
              index: batchStart + batchIndex,
              url: page.url,
              title: page.title,
              content: result.data?.response,
              depth: page.depth,
            };
          } catch (error) {
            console.error(
              '[WebCrawlTool] Error summarizing page:',
              page.url,
              error
            );
            return {
              index: batchStart + batchIndex,
              url: page.url,
              title: page.title,
              content: page.content, // Keep original content if summarization fails
              depth: page.depth,
            };
          }
        });

        // Wait for all promises in this batch to complete
        const batchResults = await Promise.all(summarizePromises);

        // Update the original pages array with summarized content
        batchResults.forEach((result) => {
          crawlResult.pages[result.index] = {
            url: result.url,
            title: result.title,
            content: result.content,
            depth: result.depth,
          };
        });

        console.log(
          `[WebCrawlTool] Completed batch ${Math.floor(batchStart / batchSize) + 1} of ${Math.ceil(pageCount / batchSize)}`
        );
      }

      return crawlResult;
    } catch (error) {
      console.error(`[WebCrawlTool] Crawl error:`, error);

      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      return {
        url,
        success: false,
        error: errorMessage,
        pages: [],
        totalPages: 0,
        metadata: {
          loadTime: Date.now() - startTime,
        },
      };
    }
  }

  /**
   * Execute crawl operation - multi-page site exploration
   */
  private async executeCrawl(
    firecrawl: FirecrawlApp,
    startTime: number
  ): Promise<WebCrawlToolResult> {
    const {
      url,
      format,
      onlyMainContent,
      maxPages,
      crawlDepth,
      includePaths,
      excludePaths,
    } = this.params;

    // Configure crawling options
    const crawlOptions: any = {
      limit: maxPages || 10,
      maxDepth: crawlDepth || 2,
    };

    // Add URL filtering if specified
    if (includePaths && includePaths.length > 0) {
      crawlOptions.includePaths = includePaths;
    }
    if (excludePaths && excludePaths.length > 0) {
      crawlOptions.excludePaths = excludePaths;
    }

    console.log('[WebCrawlTool] Crawling with options:', crawlOptions);

    // Execute crawl
    const response = await firecrawl.crawl(url, {
      ...crawlOptions,
      scrapeOptions: {
        formats: [format],
        onlyMainContent,
        removeBase64Images: true,
      },
    });

    // Process crawled pages
    const pages: Array<{
      url: string;
      title?: string;
      content: string;
      depth?: number;
    }> = [];

    // Handle different response structures
    const crawlData = response.completed ? response.data : [];

    for (const page of crawlData) {
      let content = '';

      // Extract content based on format
      if (format === 'markdown' && page.markdown) {
        content = page.markdown;
      }

      pages.push({
        url: page.metadata?.sourceURL || '',
        title: page.metadata?.title || '',
        content: content.trim(),
        depth: page.metadata?.depth as number | undefined,
      });
    }

    return {
      url,
      pages,
      totalPages: pages.length,
      success: true,
      error: '',
      metadata: {
        loadTime: Date.now() - startTime,
        crawlDepth: crawlDepth || 2,
        maxPagesReached: pages.length >= (maxPages || 10),
      },
    };
  }
}
