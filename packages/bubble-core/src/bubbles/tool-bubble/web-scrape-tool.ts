import { z } from 'zod';
import { ToolBubble } from '../../types/tool-bubble-class.js';
import type { BubbleContext } from '../../types/bubble.js';
import FirecrawlApp from '@mendable/firecrawl-js';
import { CredentialType, type BubbleName } from '@bubblelab/shared-schemas';
import { AIAgentBubble } from '../service-bubble/ai-agent.js';

// Action types for browser automation (Gemini-compatible: avoid const/anyOf)
const ActionSchema = z.object({
  type: z
    .enum(['wait', 'click', 'write', 'press', 'scroll', 'executeJavascript'])
    .describe('Action type to perform'),
  milliseconds: z
    .number()
    .optional()
    .describe('Time to wait in milliseconds (for wait)'),
  selector: z
    .string()
    .optional()
    .describe('CSS selector to interact with (wait/click/write/scroll)'),
  text: z.string().optional().describe('Text to write (for write)'),
  key: z
    .string()
    .optional()
    .describe('Key to press (e.g., "Enter") (for press)'),
  direction: z
    .enum(['up', 'down'])
    .optional()
    .describe('Scroll direction (for scroll)'),
  script: z
    .string()
    .optional()
    .describe('JavaScript code (for executeJavascript)'),
});

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
  actions: z
    .array(ActionSchema)
    .optional()
    .describe(
      'Optional browser actions for authentication/navigation (e.g., login flows)'
    ),
  headers: z
    .record(z.string())
    .optional()
    .describe('Optional HTTP headers (e.g., for session cookies)'),
  waitFor: z
    .number()
    .min(0)
    .max(30000)
    .default(3000)
    .describe(
      'Time to wait for dynamic content in milliseconds (default: 3000)'
    ),
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
    const { url, format, onlyMainContent, actions, headers, waitFor } =
      this.params;
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

      console.log('[WebScrapeTool] Scraping URL:', url, 'with format:', format);

      // Configure scraping options
      const scrapeOptions: any = {
        formats: [format],
        onlyMainContent,
        // Sensible defaults for most use cases
        removeBase64Images: true,
        waitFor,
      };

      // Add optional parameters if provided
      if (actions && actions.length > 0) {
        console.log(
          '[WebScrapeTool] Using browser actions:',
          actions.length,
          'steps'
        );
        scrapeOptions.actions = actions;
      }

      if (headers) {
        console.log('[WebScrapeTool] Using custom headers');
        scrapeOptions.headers = headers;
      }

      // Execute scrape
      const response = await firecrawl.scrape(url, scrapeOptions);

      // Extract content based on format
      let content: string;
      let title = '';

      if (format === 'markdown' && response.markdown) {
        content = response.markdown;
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
      if (response.metadata?.title) {
        title = response.metadata.title;
      }

      const loadTime = Date.now() - startTime;

      return {
        content: content.trim(),
        title,
        url,
        format,
        success: true,
        error: '',
        metadata: {
          statusCode: response.metadata?.statusCode,
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
        metadata: {
          loadTime: Date.now() - startTime,
        },
      };
    }
  }
}
