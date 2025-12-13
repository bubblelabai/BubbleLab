import { z } from 'zod';
import { ToolBubble } from '../../types/tool-bubble-class.js';
import type { BubbleContext } from '../../types/bubble.js';
import { FirecrawlBubble } from '../service-bubble/firecrawl.js';
import { CredentialType, type BubbleName } from '@bubblelab/shared-schemas';
import { AIAgentBubble } from '../service-bubble/ai-agent.js';

// Action types for browser automation (Gemini-compatible: avoid const/anyOf)
// const ActionSchema = z.object({
//   type: z
//     .enum(['wait', 'click', 'write', 'press', 'scroll', 'executeJavascript'])
//     .describe('Action type to perform'),
//   milliseconds: z
//     .number()
//     .optional()
//     .describe('Time to wait in milliseconds (for wait)'),
//   selector: z
//     .string()
//     .optional()
//     .describe('CSS selector to interact with (wait/click/write/scroll)'),
//   text: z.string().optional().describe('Text to write (for write)'),
//   key: z
//     .string()
//     .optional()
//     .describe('Key to press (e.g., "Enter") (for press)'),
//   direction: z
//     .enum(['up', 'down'])
//     .optional()
//     .describe('Scroll direction (for scroll)'),
//   script: z
//     .string()
//     .optional()
//     .describe('JavaScript code (for executeJavascript)'),
// });

// Simple, focused parameters with optional advanced features
const WebScrapeToolParamsSchema = z.object({
  url: z
    .string()
    .url('Must be a valid URL')
    .describe('The URL to scrape content from'),
  format: z
    .enum(['markdown'])
    .default('markdown')
    .describe('Content format to extract (default: markdown)'),
  onlyMainContent: z
    .boolean()
    .default(true)
    .describe('Extract only main content, filtering out navigation/footers'),
  credentials: z
    .record(z.nativeEnum(CredentialType), z.string())
    .optional()
    .describe('Required credentials including FIRECRAWL_API_KEY'),
});

// Result schema
const WebScrapeToolResultSchema = z.object({
  content: z.string().describe('Scraped content in requested format'),
  title: z.string().describe('Page title if available'),
  url: z.string().url().describe('The original URL that was scraped'),
  format: z.string().describe('Format of the returned content'),
  success: z.boolean().describe('Whether the scraping was successful'),
  error: z.string().describe('Error message if scraping failed'),
  creditsUsed: z.number().describe('Number of credits used'),
  metadata: z
    .object({
      statusCode: z.number().optional(),
      loadTime: z.number().optional(),
    })
    .optional()
    .describe('Additional metadata about the scrape'),
});

// Type definitions
type WebScrapeToolParams = z.output<typeof WebScrapeToolParamsSchema>;
type WebScrapeToolResult = z.output<typeof WebScrapeToolResultSchema>;
type WebScrapeToolParamsInput = z.input<typeof WebScrapeToolParamsSchema>;

export class WebScrapeTool extends ToolBubble<
  WebScrapeToolParams,
  WebScrapeToolResult
> {
  // Required static metadata
  static readonly bubbleName: BubbleName = 'web-scrape-tool';
  static readonly schema = WebScrapeToolParamsSchema;
  static readonly resultSchema = WebScrapeToolResultSchema;
  static readonly shortDescription =
    'Scrapes content from a single web page using Firecrawl, good to use after web-search-tool to get the full content of a page';
  static readonly longDescription = `
    A simple and powerful web scraping tool that extracts content from any web page.
    
    Features:
    - Clean content extraction with main content focus
    - Multiple format support (markdown, html, rawHtml)
    - Fast and reliable using Firecrawl
    - Handles JavaScript-rendered pages
    - Optional browser automation for authentication flows
    - Custom headers support for session-based scraping
    - Requires FIRECRAWL_API_KEY credential
    
    Basic use cases:
    - Extract article content for analysis
    - Scrape product information from e-commerce sites
    - Get clean text from documentation pages
    - Extract data from any public web page
    
    Advanced use cases (with actions):
    - Login and scrape protected content
    - Navigate multi-step authentication flows
    - Interact with dynamic content requiring clicks/scrolls
    - Execute custom JavaScript for complex scenarios
  `;
  static readonly alias = 'scrape';
  static readonly type = 'tool';

  constructor(
    params: WebScrapeToolParamsInput = { url: '' },
    context?: BubbleContext
  ) {
    super(params, context);
  }

  async performAction(): Promise<WebScrapeToolResult> {
    const { url, format, credentials } = this.params;
    const startTime = Date.now();

    try {
      console.log('[WebScrapeTool] Scraping URL:', url, 'with format:', format);

      // Initialize Firecrawl bubble
      const firecrawlParams = {
        operation: 'scrape' as const,
        credentials,
        url,
        formats: [format],
        // Sensible defaults for most use cases
        maxAge: 172800000,
        parsers: ['pdf'],
      };
      const firecrawl = new FirecrawlBubble<typeof firecrawlParams>(
        firecrawlParams,
        this.context,
        'web_scrape_tool_firecrawl'
      );

      // Execute scrape
      const response = await firecrawl.action();

      // Extract content based on format
      let content: string;
      let title = '';

      if (format === 'markdown' && response.data.markdown) {
        content = response.data.markdown;
      } else {
        throw new Error(`No content available in ${format} format`);
      }

      // Summarize the scraped content for better consumption
      if (content && content.length > 5000000) {
        try {
          const summarizeAgent = new AIAgentBubble(
            {
              message: `Summarize the scraped content to condense all information and remove any non-essential information, include all links, contact information, companies, don't omit any information. Content: ${content}`,
              model: {
                model: 'google/gemini-2.5-flash-lite',
              },
              name: 'Scrape Content Summarizer Agent',
              credentials: this.params.credentials,
            },
            this.context
          );

          const result = await summarizeAgent.action();
          if (result.data?.response) {
            console.log(
              '[WebScrapeTool] Summarized scraped content for:',
              url,
              result.data.response
            );
            content = result.data.response;
          }
        } catch (error) {
          console.error(
            '[WebScrapeTool] Error summarizing content:',
            url,
            error
          );
          // Keep original content if summarization fails
        }
      }

      // Extract title from metadata
      if (response.data.metadata?.title) {
        title = response.data.metadata.title;
      }

      const loadTime = Date.now() - startTime;

      // Log service usage for Firecrawl web scrape
      if (this.context?.logger) {
        this.context.logger.logTokenUsage(
          {
            usage: 1,
            service: CredentialType.FIRECRAWL_API_KEY,
            unit: 'per_result',
            subService: 'web-scrape',
          },
          `Firecrawl web scrape: 1 credit used for ${url}`,
          {
            bubbleName: 'web-scrape-tool',
            variableId: this.context?.variableId,
            operationType: 'bubble_execution',
          }
        );
      }

      return {
        content: content.trim(),
        title,
        url,
        // Per page 1 credit
        creditsUsed: 1,
        format,
        success: true,
        error: '',
        metadata: {
          statusCode: response.data.metadata?.statusCode,
          loadTime,
        },
      };
    } catch (error) {
      console.error('[WebScrapeTool] Scrape error:', error);

      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      return {
        content: '',
        title: '',
        url,
        format,
        success: false,
        error: errorMessage,
        creditsUsed: 0,
        metadata: {
          loadTime: Date.now() - startTime,
        },
      };
    }
  }
}
