import { z } from 'zod';
import { ServiceBubble } from '../../types/service-bubble-class.js';
import type { BubbleContext } from '../../types/bubble.js';
import { CredentialType, type BubbleName } from '@bubblelab/shared-schemas';

// Olostep API base URL
const OLOSTEP_API_URL = 'https://api.olostep.com/v1';

// Output format options
const FormatSchema = z.enum(['markdown', 'html', 'json', 'text']);

// Define the parameters schema for the Olostep bubble
const OlostepParamsSchema = z.discriminatedUnion('operation', [
  // Scrape operation - extract content from a single URL
  z.object({
    operation: z
      .literal('scrape')
      .describe('Extract content from a single URL'),
    url: z.string().url().describe('The URL to scrape'),
    formats: z
      .array(FormatSchema)
      .optional()
      .default(['markdown'])
      .describe('Output formats: markdown, html, json, text'),
    country: z
      .string()
      .length(2)
      .optional()
      .describe('Two-letter country code for geo-targeting'),
    wait_before_scraping: z
      .number()
      .int()
      .min(0)
      .max(30000)
      .optional()
      .describe('Milliseconds to wait before scraping'),
    parser: z
      .string()
      .optional()
      .describe(
        'Parser ID for structured extraction (e.g., @olostep/product-page)'
      ),
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe('Credentials (injected at runtime)'),
  }),

  // Batch scrape operation - scrape multiple URLs at once
  z.object({
    operation: z
      .literal('batch')
      .describe('Scrape multiple URLs in a single request'),
    urls: z
      .array(z.string().url())
      .min(1)
      .max(1000)
      .describe('Array of URLs to scrape (max 1000)'),
    formats: z
      .array(FormatSchema)
      .optional()
      .default(['markdown'])
      .describe('Output formats'),
    country: z
      .string()
      .length(2)
      .optional()
      .describe('Two-letter country code'),
    wait_before_scraping: z
      .number()
      .int()
      .min(0)
      .max(30000)
      .optional()
      .describe('Milliseconds to wait'),
    parser: z
      .string()
      .optional()
      .describe('Parser ID for structured extraction'),
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe('Credentials (injected at runtime)'),
  }),

  // Crawl operation - crawl a website following links
  z.object({
    operation: z
      .literal('crawl')
      .describe('Crawl a website and extract content from multiple pages'),
    start_url: z.string().url().describe('Starting URL for the crawl'),
    max_pages: z
      .number()
      .int()
      .min(1)
      .max(10000)
      .optional()
      .default(10)
      .describe('Maximum number of pages to crawl'),
    follow_links: z
      .boolean()
      .optional()
      .default(true)
      .describe('Whether to follow links'),
    formats: z
      .array(FormatSchema)
      .optional()
      .default(['markdown'])
      .describe('Output formats'),
    country: z
      .string()
      .length(2)
      .optional()
      .describe('Two-letter country code'),
    parser: z
      .string()
      .optional()
      .describe('Parser ID for structured extraction'),
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe('Credentials (injected at runtime)'),
  }),

  // Map operation - discover URLs on a website
  z.object({
    operation: z.literal('map').describe('Discover all URLs on a website'),
    url: z.string().url().describe('Domain URL to map'),
    search_query: z
      .string()
      .optional()
      .describe('Optional search query to filter URLs'),
    top_n: z
      .number()
      .int()
      .min(1)
      .max(10000)
      .optional()
      .default(100)
      .describe('Maximum number of URLs to return'),
    include_urls: z
      .array(z.string())
      .optional()
      .describe('URL patterns to include'),
    exclude_urls: z
      .array(z.string())
      .optional()
      .describe('URL patterns to exclude'),
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe('Credentials (injected at runtime)'),
  }),

  // Answer operation - AI-powered question answering
  z.object({
    operation: z
      .literal('answer')
      .describe('Get AI-powered answers from web content'),
    task: z.string().min(1).describe('The question or task to answer'),
    context_urls: z
      .array(z.string().url())
      .optional()
      .describe('URLs to use as context for answering'),
    format: z
      .enum(['markdown', 'text', 'json'])
      .optional()
      .default('markdown')
      .describe('Output format'),
    include_citations: z
      .boolean()
      .optional()
      .default(true)
      .describe('Include source citations'),
    top_k_sources: z
      .number()
      .int()
      .min(1)
      .max(20)
      .optional()
      .default(5)
      .describe('Number of sources to consider'),
    json_schema: z
      .record(z.any())
      .optional()
      .describe('JSON schema for structured output'),
    credentials: z
      .record(z.nativeEnum(CredentialType), z.string())
      .optional()
      .describe('Credentials (injected at runtime)'),
  }),
]);

export type OlostepParamsInput = z.input<typeof OlostepParamsSchema>;
type OlostepParams = z.output<typeof OlostepParamsSchema>;

// Result schemas for each operation
const ScrapeResultSchema = z.object({
  operation: z.literal('scrape'),
  markdown_content: z.string().optional(),
  html_content: z.string().optional(),
  text_content: z.string().optional(),
  json_content: z.any().optional(),
  metadata: z
    .object({
      title: z.string().optional(),
      description: z.string().optional(),
      url: z.string().optional(),
    })
    .optional(),
  success: z.boolean(),
  error: z.string(),
});

const BatchResultSchema = z.object({
  operation: z.literal('batch'),
  batch_id: z.string().optional(),
  status: z.string().optional(),
  items: z.array(z.any()).optional(),
  success: z.boolean(),
  error: z.string(),
});

const CrawlResultSchema = z.object({
  operation: z.literal('crawl'),
  crawl_id: z.string().optional(),
  status: z.string().optional(),
  pages_crawled: z.number().optional(),
  pages: z.array(z.any()).optional(),
  success: z.boolean(),
  error: z.string(),
});

const MapResultSchema = z.object({
  operation: z.literal('map'),
  urls: z.array(z.string()).optional(),
  total_urls: z.number().optional(),
  success: z.boolean(),
  error: z.string(),
});

const AnswerResultSchema = z.object({
  operation: z.literal('answer'),
  answer: z.string().optional(),
  citations: z
    .array(
      z.object({
        url: z.string(),
        title: z.string().optional(),
        snippet: z.string().optional(),
      })
    )
    .optional(),
  sources_used: z.number().optional(),
  success: z.boolean(),
  error: z.string(),
});

const OlostepResultSchema = z.discriminatedUnion('operation', [
  ScrapeResultSchema,
  BatchResultSchema,
  CrawlResultSchema,
  MapResultSchema,
  AnswerResultSchema,
]);

type OlostepResult = z.output<typeof OlostepResultSchema>;

export class OlostepBubble extends ServiceBubble<OlostepParams, OlostepResult> {
  static readonly service = 'olostep';
  static readonly authType = 'apikey' as const;
  static readonly bubbleName: BubbleName = 'olostep' as BubbleName;
  static readonly type = 'service' as const;
  static readonly schema = OlostepParamsSchema;
  static readonly resultSchema = OlostepResultSchema;
  static readonly credentialOptions = [CredentialType.OLOSTEP_API_KEY];
  static readonly shortDescription =
    'Web scraping and AI-powered content extraction';
  static readonly longDescription = `
    Olostep is a powerful web scraping and AI-powered content extraction API.
    
    Features:
    - **Scrape**: Extract content from any URL in markdown, HTML, JSON, or text format
    - **Batch**: Scrape up to 1000 URLs in a single request
    - **Crawl**: Crawl websites and extract content from multiple pages
    - **Map**: Discover all URLs on a website for sitemap generation
    - **Answer**: AI-powered question answering with web content as context
    
    Use cases:
    - Content extraction and data collection
    - Website monitoring and change detection
    - Research and competitive analysis
    - Lead generation and data enrichment
    - Building AI agents with web access
    - Automated content summarization
    
    Supported parsers for structured extraction:
    - Twitter/X profiles and posts
    - GitHub repositories and profiles
    - Product pages, job listings, and more
  `;
  static readonly alias = 'web-scraper';

  constructor(
    params: OlostepParamsInput = {
      operation: 'scrape',
      url: 'https://example.com',
      formats: ['markdown'],
    },
    context?: BubbleContext
  ) {
    super(params, context);
  }

  protected chooseCredential(): string | undefined {
    return this.params.credentials?.[CredentialType.OLOSTEP_API_KEY];
  }

  public async testCredential(): Promise<boolean> {
    const apiKey = this.chooseCredential();
    if (!apiKey) return false;

    try {
      // Simple health check with minimal scrape
      const response = await fetch(`${OLOSTEP_API_URL}/scrapes`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url_to_scrape: 'https://example.com',
          formats: ['text'],
        }),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  protected async performAction(
    context?: BubbleContext
  ): Promise<OlostepResult> {
    const apiKey = this.chooseCredential();
    if (!apiKey) {
      return this.createErrorResult('OLOSTEP_API_KEY credential is required');
    }

    const { operation } = this.params;
    context?.logger?.info?.(`olostep.${operation}`);

    try {
      switch (operation) {
        case 'scrape':
          return await this.performScrape(apiKey);
        case 'batch':
          return await this.performBatch(apiKey);
        case 'crawl':
          return await this.performCrawl(apiKey);
        case 'map':
          return await this.performMap(apiKey);
        case 'answer':
          return await this.performAnswer(apiKey);
        default:
          return this.createErrorResult(`Unknown operation: ${operation}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return this.createErrorResult(message);
    }
  }

  private async performScrape(apiKey: string): Promise<OlostepResult> {
    if (this.params.operation !== 'scrape') {
      return this.createErrorResult('Invalid operation');
    }

    const { url, formats, country, wait_before_scraping, parser } = this.params;

    const payload: Record<string, unknown> = {
      url_to_scrape: url,
      formats: formats || ['markdown'],
    };
    if (country) payload.country = country;
    if (wait_before_scraping)
      payload.wait_before_scraping = wait_before_scraping;
    if (parser) payload.parser = { id: parser };

    const response = await this.makeRequest('/scrapes', payload, apiKey);

    return {
      operation: 'scrape',
      markdown_content: response.markdown_content,
      html_content: response.html_content,
      text_content: response.text_content,
      json_content: response.json_content,
      metadata: response.metadata,
      success: true,
      error: '',
    };
  }

  private async performBatch(apiKey: string): Promise<OlostepResult> {
    if (this.params.operation !== 'batch') {
      return this.createErrorResult('Invalid operation');
    }

    const { urls, formats, country, wait_before_scraping, parser } =
      this.params;

    const items = urls.map((url, i) => ({ url, custom_id: `item_${i}` }));

    const payload: Record<string, unknown> = {
      items,
      formats: formats || ['markdown'],
    };
    if (country) payload.country = country;
    if (wait_before_scraping)
      payload.wait_before_scraping = wait_before_scraping;
    if (parser) payload.parser = { id: parser };

    const response = await this.makeRequest('/batches', payload, apiKey);

    return {
      operation: 'batch',
      batch_id: response.batch_id || response.id,
      status: response.status,
      items: response.items,
      success: true,
      error: '',
    };
  }

  private async performCrawl(apiKey: string): Promise<OlostepResult> {
    if (this.params.operation !== 'crawl') {
      return this.createErrorResult('Invalid operation');
    }

    const { start_url, max_pages, follow_links, formats, country, parser } =
      this.params;

    const payload: Record<string, unknown> = {
      start_url,
      max_pages: max_pages || 10,
      follow_links: follow_links ?? true,
      formats: formats || ['markdown'],
    };
    if (country) payload.country = country;
    if (parser) payload.parser = { id: parser };

    const response = await this.makeRequest('/crawls', payload, apiKey);

    return {
      operation: 'crawl',
      crawl_id: response.crawl_id || response.id,
      status: response.status,
      pages_crawled: response.pages_crawled,
      pages: response.pages,
      success: true,
      error: '',
    };
  }

  private async performMap(apiKey: string): Promise<OlostepResult> {
    if (this.params.operation !== 'map') {
      return this.createErrorResult('Invalid operation');
    }

    const { url, search_query, top_n, include_urls, exclude_urls } =
      this.params;

    const payload: Record<string, unknown> = {
      url,
      top_n: top_n || 100,
    };
    if (search_query) payload.search_query = search_query;
    if (include_urls) payload.include_urls = include_urls;
    if (exclude_urls) payload.exclude_urls = exclude_urls;

    const response = await this.makeRequest('/maps', payload, apiKey);

    return {
      operation: 'map',
      urls: response.urls || response.links,
      total_urls: response.total_urls || response.urls?.length,
      success: true,
      error: '',
    };
  }

  private async performAnswer(apiKey: string): Promise<OlostepResult> {
    if (this.params.operation !== 'answer') {
      return this.createErrorResult('Invalid operation');
    }

    const {
      task,
      context_urls,
      format,
      include_citations,
      top_k_sources,
      json_schema,
    } = this.params;

    const payload: Record<string, unknown> = {
      task,
      format: format || 'markdown',
      include_citations: include_citations ?? true,
      top_k_sources: top_k_sources || 5,
    };
    if (context_urls) payload.context_urls = context_urls;
    if (json_schema) payload.json_schema = json_schema;

    const response = await this.makeRequest('/answers', payload, apiKey);

    return {
      operation: 'answer',
      answer: response.answer || response.result,
      citations: response.citations,
      sources_used: response.sources_used,
      success: true,
      error: '',
    };
  }

  private async makeRequest(
    endpoint: string,
    payload: Record<string, unknown>,
    apiKey: string
  ): Promise<any> {
    const response = await fetch(`${OLOSTEP_API_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const text = await response.text();
    let json: any;
    try {
      json = text ? JSON.parse(text) : {};
    } catch {
      json = { raw: text };
    }

    if (!response.ok) {
      throw new Error(
        json?.error?.message || json?.message || `HTTP ${response.status}`
      );
    }

    return json;
  }

  private createErrorResult(error: string): OlostepResult {
    const operation = this.params.operation;
    const base = { success: false, error };

    switch (operation) {
      case 'scrape':
        return { operation: 'scrape', ...base };
      case 'batch':
        return { operation: 'batch', ...base };
      case 'crawl':
        return { operation: 'crawl', ...base };
      case 'map':
        return { operation: 'map', ...base };
      case 'answer':
        return { operation: 'answer', ...base };
      default: {
        // Exhaustive check: TypeScript will error if a case is missing
        const _exhaustiveCheck: never = operation;
        return { operation: 'scrape', ...base };
      }
    }
  }
}

// Export types for external usage
export type OlostepScrapeParams = Extract<
  OlostepParams,
  { operation: 'scrape' }
>;
export type OlostepBatchParams = Extract<OlostepParams, { operation: 'batch' }>;
export type OlostepCrawlParams = Extract<OlostepParams, { operation: 'crawl' }>;
export type OlostepMapParams = Extract<OlostepParams, { operation: 'map' }>;
export type OlostepAnswerParams = Extract<
  OlostepParams,
  { operation: 'answer' }
>;
