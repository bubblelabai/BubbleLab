import { z } from 'zod';
import { ToolBubble } from '../../types/tool-bubble-class.js';
import type { BubbleContext } from '../../types/bubble.js';
import FirecrawlApp from '@mendable/firecrawl-js';
import { CredentialType, type BubbleName } from '@bubblelab/shared-schemas';

// Action type schemas for browser automation
const WaitActionSchema = z.object({
  type: z.literal('wait').describe('Wait for a specified duration'),
  milliseconds: z.number().positive().describe('Time to wait in milliseconds'),
});

const ClickActionSchema = z.object({
  type: z.literal('click').describe('Click on an element'),
  selector: z.string().describe('CSS selector of the element to click'),
});

const WriteActionSchema = z.object({
  type: z.literal('write').describe('Type text into an input field'),
  selector: z.string().describe('CSS selector of the input element'),
  text: z.string().describe('Text to type into the field'),
});

const PressActionSchema = z.object({
  type: z.literal('press').describe('Press a keyboard key'),
  key: z.string().describe('Key to press (e.g., "Enter", "Tab", "Escape")'),
});

const ScrollActionSchema = z.object({
  type: z.literal('scroll').describe('Scroll the page'),
  direction: z
    .enum(['up', 'down'])
    .describe('Direction to scroll (up or down)'),
});

const ScrapeActionSchema = z.object({
  type: z.literal('scrape').describe('Scrape a specific element'),
  selector: z.string().describe('CSS selector of the element to scrape'),
});

const ExecuteJavascriptActionSchema = z.object({
  type: z
    .literal('executeJavascript')
    .describe('Execute custom JavaScript code'),
  script: z.string().describe('JavaScript code to execute'),
});

const ScreenshotActionSchema = z.object({
  type: z.literal('screenshot').describe('Take a screenshot'),
  fullPage: z
    .boolean()
    .optional()
    .default(false)
    .describe('Capture full page or just viewport'),
});

// Union type for all possible actions
const ActionSchema = z.discriminatedUnion('type', [
  WaitActionSchema,
  ClickActionSchema,
  WriteActionSchema,
  PressActionSchema,
  ScrollActionSchema,
  ScrapeActionSchema,
  ExecuteJavascriptActionSchema,
  ScreenshotActionSchema,
]);

// Screenshot format schema
const ScreenshotFormatSchema = z.object({
  type: z.literal('screenshot').describe('Screenshot format'),
  fullPage: z
    .boolean()
    .optional()
    .default(true)
    .describe('Capture full page or just viewport'),
  quality: z
    .number()
    .min(0)
    .max(100)
    .optional()
    .default(80)
    .describe('Screenshot quality (0-100)'),
  viewport: z
    .object({
      width: z.number().optional(),
      height: z.number().optional(),
    })
    .optional()
    .describe('Custom viewport dimensions'),
});

// JSON extraction format schema
const JsonFormatSchema = z.object({
  type: z.literal('json').describe('JSON extraction format'),
  prompt: z.string().describe('Prompt describing what to extract'),
  schema: z.record(z.unknown()).describe('JSON schema for the extracted data'),
});

// Main parameters schema
const WebTestToolParamsSchema = z.object({
  url: z
    .string()
    .url('Must be a valid URL')
    .describe('The URL to test and interact with'),
  actions: z
    .array(ActionSchema)
    .default([])
    .describe(
      'Sequence of actions to perform before scraping (click, type, wait, etc.)'
    ),
  formats: z
    .array(
      z.union([
        z.enum(['markdown', 'links', 'html', 'rawHtml']),
        ScreenshotFormatSchema,
        JsonFormatSchema,
      ])
    )
    .default(['markdown'])
    .describe(
      'Output formats to return (markdown, html, screenshot, json extraction)'
    ),
  includeTags: z
    .array(z.string())
    .optional()
    .describe(
      'HTML tags, classes, or IDs to include (e.g., ["h1", ".content"])'
    ),
  excludeTags: z
    .array(z.string())
    .optional()
    .describe(
      'HTML tags, classes, or IDs to exclude (e.g., ["#ad", ".footer"])'
    ),
  onlyMainContent: z
    .boolean()
    .default(true)
    .describe('Extract only main content, filtering out navigation/footers'),
  waitFor: z
    .number()
    .min(0)
    .max(30000)
    .default(0)
    .describe('Milliseconds to wait before scraping (use sparingly)'),
  timeout: z
    .number()
    .min(1000)
    .max(60000)
    .default(30000)
    .describe('Maximum duration in milliseconds before aborting'),
  maxAge: z
    .number()
    .optional()
    .default(172800000)
    .describe(
      'Cache max age in milliseconds (default: 2 days, 0 for fresh scrape)'
    ),
  parsers: z
    .array(z.enum(['pdf']))
    .optional()
    .default([])
    .describe('Enable specific parsers (e.g., ["pdf"])'),
  credentials: z
    .record(z.nativeEnum(CredentialType), z.string())
    .optional()
    .describe('Required credentials including FIRECRAWL_API_KEY'),
});

// Result schema
const WebTestToolResultSchema = z.object({
  url: z.string().url().describe('The original URL that was tested'),
  success: z.boolean().describe('Whether the test completed successfully'),
  error: z.string().describe('Error message if test failed'),
  markdown: z.string().optional().describe('Page content in markdown format'),
  html: z.string().optional().describe('Page content in HTML format'),
  rawHtml: z.string().optional().describe('Raw HTML of the page'),
  links: z.array(z.string()).optional().describe('All links found on the page'),
  screenshot: z
    .object({
      base64: z.string().describe('Base64-encoded screenshot image'),
      format: z.string().describe('Image format (e.g., png)'),
      fullPage: z.boolean().describe('Whether it is a full page screenshot'),
    })
    .optional()
    .describe('Screenshot data if requested'),
  extractedJson: z
    .record(z.unknown())
    .optional()
    .describe('Extracted JSON data'),
  metadata: z
    .object({
      title: z.string().optional(),
      description: z.string().optional(),
      statusCode: z.number().optional(),
      executionTime: z.number().optional(),
      actionsPerformed: z.number().optional(),
    })
    .optional()
    .describe('Additional metadata about the test'),
  creditsUsed: z.number().describe('Number of Firecrawl credits used'),
});

// Type definitions
type WebTestToolParams = z.output<typeof WebTestToolParamsSchema>;
type WebTestToolResult = z.output<typeof WebTestToolResultSchema>;
type WebTestToolParamsInput = z.input<typeof WebTestToolParamsSchema>;
type ActionType = z.output<typeof ActionSchema>;

export class WebTestTool extends ToolBubble<
  WebTestToolParams,
  WebTestToolResult
> {
  // Required static metadata
  static readonly bubbleName: BubbleName = 'web-test-tool';
  static readonly schema = WebTestToolParamsSchema;
  static readonly resultSchema = WebTestToolResultSchema;
  static readonly shortDescription =
    'Advanced web testing tool with browser automation, actions, and screenshots using Firecrawl';
  static readonly longDescription = `
    A comprehensive web testing and automation tool that combines Firecrawl's advanced scraping
    capabilities with browser automation, screenshot capture, and structured data extraction.

    🎯 KEY FEATURES:

    **Browser Automation & Actions:**
    - Click elements, fill forms, press keys
    - Navigate multi-step flows and authentication
    - Execute custom JavaScript for complex scenarios
    - Scroll and interact with dynamic content
    - Wait for elements or timeouts

    **Screenshot Capabilities:**
    - Full page or viewport screenshots
    - Configurable quality and dimensions
    - Base64-encoded for easy storage/transmission
    - Perfect for visual testing and documentation

    **Content Extraction:**
    - Multiple format support (markdown, HTML, raw HTML, links)
    - AI-powered JSON extraction with custom schemas
    - Fine-grained control with include/exclude tags
    - Main content extraction to filter noise

    **Advanced Options:**
    - PDF parsing support
    - Customizable timeouts and wait conditions
    - Caching control for fresh or cached data
    - Comprehensive metadata and error handling

    📋 USE CASES:

    1. **E2E Testing:**
       - Test login flows and multi-step processes
       - Verify form submissions and validations
       - Capture screenshots for test reports

    2. **Web Automation:**
       - Automate repetitive browser tasks
       - Extract data from authentication-protected pages
       - Navigate complex JavaScript-heavy applications

    3. **Visual Documentation:**
       - Generate screenshots for documentation
       - Capture different states of web applications
       - Create visual regression test baselines

    4. **Data Extraction:**
       - Scrape content after user interactions
       - Extract structured data from dynamic pages
       - Parse PDFs and complex documents

    5. **Quality Assurance:**
       - Verify page rendering across different scenarios
       - Test responsive designs with viewport controls
       - Validate content and layout changes

    💡 EXAMPLE WORKFLOWS:

    **Login and Screenshot:**
    \`\`\`
    actions: [
      { type: 'click', selector: '#login-btn' },
      { type: 'write', selector: '#username', text: 'user@example.com' },
      { type: 'write', selector: '#password', text: 'password' },
      { type: 'press', key: 'Enter' },
      { type: 'wait', milliseconds: 2000 },
      { type: 'screenshot', fullPage: true }
    ]
    \`\`\`

    **Extract Product Data:**
    \`\`\`
    actions: [
      { type: 'click', selector: '.show-details' },
      { type: 'wait', milliseconds: 1000 }
    ],
    formats: [{
      type: 'json',
      prompt: 'Extract product name, price, and images',
      schema: { name: 'string', price: 'number', images: ['string'] }
    }]
    \`\`\`

    **Acceptance Testing:**
    \`\`\`
    actions: [
      { type: 'click', selector: '#cookie-accept' },
      { type: 'scroll', direction: 'down' },
      { type: 'wait', milliseconds: 500 },
      { type: 'screenshot', fullPage: true }
    ],
    formats: ['markdown', { type: 'screenshot', fullPage: true }]
    \`\`\`

    ⚙️ REQUIREMENTS:
    - Requires FIRECRAWL_API_KEY credential
    - Supports all modern web technologies
    - Handles JavaScript-rendered content
    - Works with SPAs and dynamic applications
  `;
  static readonly alias = 'webtest';
  static readonly type = 'tool';

  constructor(
    params: WebTestToolParamsInput = { url: '' },
    context?: BubbleContext
  ) {
    super(params, context);
  }

  async performAction(): Promise<WebTestToolResult> {
    const {
      url,
      actions,
      formats,
      includeTags,
      excludeTags,
      onlyMainContent,
      waitFor,
      timeout,
      maxAge,
      parsers,
    } = this.params;

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

      console.log('[WebTestTool] Starting test for URL:', url);
      console.log('[WebTestTool] Actions to perform:', actions.length);
      console.log('[WebTestTool] Formats requested:', formats);

      // Convert actions to Firecrawl format
      const firecrawlActions = this.convertActionsToFirecrawl(actions);

      // Convert formats to Firecrawl format
      const firecrawlFormats = this.convertFormatsToFirecrawl(formats);

      // Build scrape options
      const scrapeOptions: Record<string, unknown> = {
        formats: firecrawlFormats,
        onlyMainContent,
        timeout,
        maxAge,
      };

      // Add actions if present
      if (firecrawlActions.length > 0) {
        scrapeOptions.actions = firecrawlActions;
      }

      // Add optional parameters
      if (includeTags && includeTags.length > 0) {
        scrapeOptions.includeTags = includeTags;
      }
      if (excludeTags && excludeTags.length > 0) {
        scrapeOptions.excludeTags = excludeTags;
      }
      if (waitFor > 0) {
        scrapeOptions.waitFor = waitFor;
      }
      if (parsers && parsers.length > 0) {
        scrapeOptions.parsers = parsers;
      }

      console.log('[WebTestTool] Scrape options:', scrapeOptions);

      // Execute scrape with actions
      const response = await firecrawl.scrape(url, scrapeOptions);

      console.log('[WebTestTool] Scrape completed successfully');

      // Build result object
      const result: WebTestToolResult = {
        url,
        success: true,
        error: '',
        creditsUsed: 1, // Base credit for scrape
        metadata: {
          executionTime: Date.now() - startTime,
          actionsPerformed: actions.length,
        },
      };

      // Extract content based on formats
      if (formats.includes('markdown') && response.markdown) {
        result.markdown = response.markdown;
      }
      if (formats.includes('html') && response.html) {
        result.html = response.html;
      }
      if (formats.includes('rawHtml') && response.rawHtml) {
        result.rawHtml = response.rawHtml;
      }
      if (formats.includes('links') && response.links) {
        result.links = Array.isArray(response.links)
          ? response.links
          : [response.links];
      }

      // Handle screenshot format
      const screenshotFormat = formats.find(
        (f): f is z.output<typeof ScreenshotFormatSchema> =>
          typeof f === 'object' && 'type' in f && f.type === 'screenshot'
      );
      if (screenshotFormat && response.screenshot) {
        result.screenshot = {
          base64: response.screenshot,
          format: 'png',
          fullPage: screenshotFormat.fullPage ?? true,
        };
        console.log(
          '[WebTestTool] Screenshot captured',
          screenshotFormat.fullPage ? '(full page)' : '(viewport)'
        );
      }

      // Handle JSON extraction format
      const jsonFormat = formats.find(
        (f): f is z.output<typeof JsonFormatSchema> =>
          typeof f === 'object' && 'type' in f && f.type === 'json'
      );
      if (jsonFormat && response.json) {
        result.extractedJson = response.json as Record<string, unknown>;
        console.log('[WebTestTool] JSON data extracted');
      }

      // Extract metadata
      if (response.metadata) {
        result.metadata = {
          ...result.metadata,
          title: response.metadata.title,
          description: response.metadata.description,
          statusCode: response.metadata.statusCode,
        };
      }

      return result;
    } catch (error) {
      console.error('[WebTestTool] Test error:', error);

      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      return {
        url,
        success: false,
        error: errorMessage,
        creditsUsed: 0,
        metadata: {
          executionTime: Date.now() - startTime,
          actionsPerformed: 0,
        },
      };
    }
  }

  /**
   * Convert our action schema to Firecrawl format
   */
  private convertActionsToFirecrawl(
    actions: ActionType[]
  ): Record<string, unknown>[] {
    return actions.map((action) => {
      // Firecrawl expects actions in a specific format
      const firecrawlAction: Record<string, unknown> = {
        type: action.type,
      };

      switch (action.type) {
        case 'wait':
          firecrawlAction.milliseconds = action.milliseconds;
          break;
        case 'click':
          firecrawlAction.selector = action.selector;
          break;
        case 'write':
          firecrawlAction.selector = action.selector;
          firecrawlAction.text = action.text;
          break;
        case 'press':
          firecrawlAction.key = action.key;
          break;
        case 'scroll':
          firecrawlAction.direction = action.direction;
          break;
        case 'scrape':
          firecrawlAction.selector = action.selector;
          break;
        case 'executeJavascript':
          firecrawlAction.script = action.script;
          break;
        case 'screenshot':
          firecrawlAction.fullPage = action.fullPage ?? false;
          break;
      }

      return firecrawlAction;
    });
  }

  /**
   * Convert our format schema to Firecrawl format
   */
  private convertFormatsToFirecrawl(
    formats: WebTestToolParams['formats']
  ): (string | Record<string, unknown>)[] {
    return formats.map((format) => {
      if (typeof format === 'string') {
        return format;
      }

      if (format.type === 'screenshot') {
        return {
          type: 'screenshot',
          fullPage: format.fullPage ?? true,
          quality: format.quality ?? 80,
          ...(format.viewport && { viewport: format.viewport }),
        };
      }

      if (format.type === 'json') {
        return {
          type: 'json',
          prompt: format.prompt,
          schema: format.schema,
        };
      }

      return format;
    });
  }
}
