import { z } from 'zod';
import { ToolBubble } from '../../types/tool-bubble-class.js';
import type { BubbleContext } from '../../types/bubble.js';
import { FirecrawlBubble } from '../service-bubble/firecrawl.js';
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
  creditsUsed: z.number().describe('Number of credits used'),

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
      console.log(`[WebCrawlTool] Starting crawl for URL:`, url);

      const crawlResult = await this.executeCrawl(startTime);
      if (!crawlResult.success) {
        return crawlResult;
      }

      // Process pages for summarization in batches if content is large (>5MB like web-scrape-tool)
      const pagesToSummarize = crawlResult.pages.filter(
        (page) => page.content && page.content.length > 50000
      );

      if (pagesToSummarize.length > 0) {
        console.log(
          `[WebCrawlTool] Summarizing ${pagesToSummarize.length} large pages in batch`
        );

        try {
          // Create batch content for summarization
          const batchContent = pagesToSummarize
            .map(
              (page, index) =>
                `PAGE ${index + 1} (${page.url}):\n${page.content}\n\n---\n\n`
            )
            .join('');

          const summarizeAgent = new AIAgentBubble(
            {
              message: `Clean up the crawled pages and condense the content to remove any non-essential information, include all links, contact information, companies, don't omit any information. Ex: if working on documentation, remove the navigation, footer, and any other non-essential information but preserve all examples and code blocks and api usage. 

Please process each page separately and return the results in the same order, clearly marking each page with "PAGE X:" where X is the page number.

Content: ${batchContent}`,
              model: {
                model: 'google/gemini-2.5-flash-lite',
              },
              name: 'Crawl Pages Batch Summarizer Agent',
              credentials: this.params.credentials,
            },
            this.context
          );

          const result = await summarizeAgent.action();
          if (result.data?.response) {
            console.log('[WebCrawlTool] Batch summarization completed');

            // Parse the batch response and update pages
            const batchResponse = result.data.response;
            const pageResponses = batchResponse.split(/PAGE \d+:/);

            // Skip the first empty element and process the rest
            for (
              let i = 1;
              i < pageResponses.length && i <= pagesToSummarize.length;
              i++
            ) {
              const summarizedContent = pageResponses[i].trim();
              if (summarizedContent) {
                const originalPageIndex = crawlResult.pages.findIndex(
                  (page) => page.url === pagesToSummarize[i - 1].url
                );
                if (originalPageIndex !== -1) {
                  crawlResult.pages[originalPageIndex].content =
                    summarizedContent;
                  console.log(
                    `[WebCrawlTool] Updated summarized content for: ${pagesToSummarize[i - 1].url}`
                  );
                }
              }
            }
          }
        } catch (error) {
          console.error('[WebCrawlTool] Error in batch summarization:', error);
          // Continue with original content if summarization fails
        }
      }

      return crawlResult;
    } catch (error) {
      console.error(`[WebCrawlTool] Crawl error:`, error);

      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      return {
        url,
        success: false,
        creditsUsed: 0,
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
  private async executeCrawl(startTime: number): Promise<WebCrawlToolResult> {
    const {
      url,
      format,
      onlyMainContent,
      maxPages,
      crawlDepth,
      includePaths,
      excludePaths,
      credentials,
    } = this.params;

    // Configure crawling options
    const crawlOptions: {
      limit: number;
      maxDiscoveryDepth: number;
      includePaths?: string[];
      excludePaths?: string[];
    } = {
      limit: maxPages || 10,
      maxDiscoveryDepth: crawlDepth || 2,
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
    const firecrawlParams = {
      operation: 'crawl' as const,
      credentials,
      ...crawlOptions,
      url,
      scrapeOptions: {
        formats: format ? [format] : undefined,
        onlyMainContent,
        removeBase64Images: true,
      },
    };
    const firecrawl = new FirecrawlBubble<typeof firecrawlParams>(
      firecrawlParams,
      this.context,
      'web_crawl_tool_firecrawl'
    );
    const response = await firecrawl.action();
    if (!response.success) {
      return {
        url,
        success: false,
        creditsUsed: 0,
        error: response.error || 'Crawl failed',
        pages: [],
        totalPages: 0,
        metadata: {
          loadTime: Date.now() - startTime,
        },
      };
    }

    // Process crawled pages
    const pages: Array<{
      url: string;
      title?: string;
      content: string;
      depth?: number;
    }> = [];

    // Handle different response structures
    const crawlData = response.data.completed ? response.data.data : [];

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

    const creditsUsed = pages.length;

    // Log service usage for Firecrawl web crawl
    if (creditsUsed > 0 && this.context?.logger) {
      this.context.logger.logTokenUsage(
        {
          usage: creditsUsed,
          service: CredentialType.FIRECRAWL_API_KEY,
          unit: 'per_result',
          subService: 'web-crawl',
        },
        `Firecrawl web crawl: ${creditsUsed} credits used for ${url}`,
        {
          bubbleName: 'web-crawl-tool',
          variableId: this.context?.variableId,
          operationType: 'bubble_execution',
        }
      );
    }

    return {
      url,
      pages,
      creditsUsed,
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
