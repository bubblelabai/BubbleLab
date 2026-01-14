import { z } from 'zod';
import { ServiceBubble } from '../../types/service-bubble-class.js';
import type { BubbleContext } from '../../types/bubble.js';
import { CredentialType } from '@bubblelab/shared-schemas';
import { Firecrawl } from '@mendable/firecrawl-js';

// Define the schema for Firecrawl document metadata
const FirecrawlDocumentMetadataSchema = z
  .object({
    title: z.string().optional().describe('Title of the document'),
    description: z.string().optional().describe('Description of the document'),
    url: z.string().url().optional().describe('URL of the document'),
    language: z
      .union([z.string(), z.array(z.string())])
      .optional()
      .describe('Language of the document'),
    keywords: z
      .union([z.string(), z.array(z.string())])
      .optional()
      .describe('Keywords associated with the document'),
    robots: z
      .union([z.string(), z.array(z.string())])
      .optional()
      .describe('Robots meta tag content'),
    ogTitle: z.string().optional().describe('Open Graph title'),
    ogDescription: z.string().optional().describe('Open Graph description'),
    ogUrl: z.string().optional().describe('Open Graph URL'),
    ogImage: z.string().optional().describe('Open Graph image URL'),
    ogAudio: z.string().optional().describe('Open Graph audio URL'),
    ogDeterminer: z.string().optional().describe('Open Graph determiner'),
    ogLocale: z.string().optional().describe('Open Graph locale'),
    ogLocaleAlternate: z
      .array(z.string())
      .optional()
      .describe('Alternate Open Graph locales'),
    ogSiteName: z.string().optional().describe('Open Graph site name'),
    ogVideo: z.string().optional().describe('Open Graph video URL'),
    favicon: z.string().optional().describe('Favicon URL'),
    dcTermsCreated: z.string().optional().describe('Dublin Core terms created'),
    dcDateCreated: z.string().optional().describe('Dublin Core date created'),
    dcDate: z.string().optional().describe('Dublin Core date'),
    dcTermsType: z.string().optional().describe('Dublin Core terms type'),
    dcType: z.string().optional().describe('Dublin Core type'),
    dcTermsAudience: z
      .string()
      .optional()
      .describe('Dublin Core terms audience'),
    dcTermsSubject: z.string().optional().describe('Dublin Core terms subject'),
    dcSubject: z.string().optional().describe('Dublin Core subject'),
    dcDescription: z.string().optional().describe('Dublin Core description'),
    dcTermsKeywords: z
      .string()
      .optional()
      .describe('Dublin Core terms keywords'),
    modifiedTime: z.string().optional().describe('Last modified time'),
    publishedTime: z.string().optional().describe('Published time'),
    articleTag: z.string().optional().describe('Article tag'),
    articleSection: z.string().optional().describe('Article section'),
    sourceURL: z.string().url().optional().describe('Source URL'),
    statusCode: z.number().optional().describe('HTTP status code'),
    scrapeId: z.string().optional().describe('Scrape identifier'),
    numPages: z.number().optional().describe('Number of pages scraped'),
    contentType: z.string().optional().describe('Content type of the document'),
    proxyUsed: z
      .enum(['basic', 'stealth'])
      .optional()
      .describe('Type of proxy used'),
    cacheState: z.enum(['hit', 'miss']).optional().describe('Cache state'),
    cachedAt: z.string().optional().describe('Cache timestamp'),
    creditsUsed: z.number().optional().describe('Number of credits used'),
    error: z.string().optional().describe('Error message if any'),
  })
  .catchall(z.unknown());

// Define the schema for Firecrawl branding profile
const FirecrawlBrandingProfileSchema = z
  .object({
    colorScheme: z
      .enum(['light', 'dark'])
      .optional()
      .describe('The detected color scheme ("light" or "dark")'),
    logo: z
      .string()
      .url()
      .nullable()
      .optional()
      .describe('URL of the primary logo'),
    fonts: z
      .array(
        z
          .object({
            family: z.string().describe('Font family name'),
          })
          .catchall(z.unknown())
      )
      .optional()
      .describe('Array of font families used on the page'),
    colors: z
      .object({
        primary: z.string().optional().describe('Primary brand color'),
        secondary: z.string().optional().describe('Secondary brand color'),
        accent: z.string().optional().describe('Accent brand color'),
        background: z.string().optional().describe('UI Background color'),
        textPrimary: z.string().optional().describe('UI Primary text color'),
        textSecondary: z
          .string()
          .optional()
          .describe('UI Secondary text color'),
        link: z.string().optional().describe('Semantic Link color'),
        success: z.string().optional().describe('Semantic Success color'),
        warning: z.string().optional().describe('Semantic Warning color'),
        error: z.string().optional().describe('Semantic Error color'),
      })
      .catchall(z.union([z.string(), z.undefined()]))
      .optional()
      .describe('Object containing brand colors'),
    typography: z
      .object({
        fontFamilies: z
          .object({
            primary: z.string().optional().describe('Primary font family'),
            heading: z.string().optional().describe('Heading font family'),
            code: z.string().optional().describe('Code font family'),
          })
          .catchall(z.union([z.string(), z.undefined()]))
          .optional()
          .describe('Primary, heading, and code font families'),
        fontStacks: z
          .object({
            primary: z
              .array(z.string())
              .optional()
              .describe('Primary font stack array'),
            heading: z
              .array(z.string())
              .optional()
              .describe('Heading font stack array'),
            body: z
              .array(z.string())
              .optional()
              .describe('Body font stack array'),
            paragraph: z
              .array(z.string())
              .optional()
              .describe('Paragraph font stack array'),
          })
          .catchall(z.union([z.array(z.string()), z.undefined()]))
          .optional()
          .describe(
            'Font stack arrays for primary, heading, body, and paragraph'
          ),
        fontSizes: z
          .object({
            h1: z.string().optional().describe('H1 font size'),
            h2: z.string().optional().describe('H2 font size'),
            h3: z.string().optional().describe('H3 font size'),
            body: z.string().optional().describe('Body font size'),
            small: z.string().optional().describe('Small text font size'),
          })
          .catchall(z.union([z.string(), z.undefined()]))
          .optional()
          .describe('Size definitions for headings and body text'),
        lineHeights: z
          .object({
            heading: z.number().optional().describe('Heading line height'),
            body: z.number().optional().describe('Body text line height'),
          })
          .catchall(z.union([z.number(), z.undefined()]))
          .optional()
          .describe('Line height values for different text types'),
        fontWeights: z
          .object({
            light: z.number().optional().describe('Light font weight'),
            regular: z.number().optional().describe('Regular font weight'),
            medium: z.number().optional().describe('Medium font weight'),
            bold: z.number().optional().describe('Bold font weight'),
          })
          .catchall(z.union([z.number(), z.undefined()]))
          .optional()
          .describe('Weight definitions (light, regular, medium, bold)'),
      })
      .optional()
      .describe('Detailed typography information'),
    spacing: z
      .object({
        baseUnit: z.number().optional().describe('Base spacing unit in pixels'),
        padding: z
          .record(z.number())
          .optional()
          .describe('Padding spacing values'),
        margins: z
          .record(z.number())
          .optional()
          .describe('Margin spacing values'),
        gridGutter: z
          .number()
          .optional()
          .describe('Grid gutter size in pixels'),
        borderRadius: z.string().optional().describe('Default border radius'),
      })
      .catchall(
        z.union([
          z.number(),
          z.string(),
          z.record(z.union([z.number(), z.string()])),
          z.undefined(),
        ])
      )
      .optional()
      .describe('Spacing and layout information'),
    components: z
      .object({
        buttonPrimary: z
          .object({
            background: z
              .string()
              .optional()
              .describe('Button background color'),
            textColor: z.string().optional().describe('Button text color'),
            borderColor: z.string().optional().describe('Button border color'),
            borderRadius: z
              .string()
              .optional()
              .describe('Button border radius'),
          })
          .catchall(z.union([z.string(), z.undefined()]))
          .optional()
          .describe('Primary button styles'),
        buttonSecondary: z
          .object({
            background: z
              .string()
              .optional()
              .describe('Button background color'),
            textColor: z.string().optional().describe('Button text color'),
            borderColor: z.string().optional().describe('Button border color'),
            borderRadius: z
              .string()
              .optional()
              .describe('Button border radius'),
          })
          .catchall(z.union([z.string(), z.undefined()]))
          .optional()
          .describe('Secondary button styles'),
        input: z
          .object({
            borderColor: z.string().optional().describe('Input border color'),
            focusBorderColor: z
              .string()
              .optional()
              .describe('Input focus border color'),
            borderRadius: z.string().optional().describe('Input border radius'),
          })
          .catchall(z.union([z.string(), z.undefined()]))
          .optional()
          .describe('Input field styles'),
      })
      .catchall(z.unknown())
      .optional()
      .describe('UI component styles'),
    icons: z
      .object({
        style: z.string().optional().describe('Icon style'),
        primaryColor: z.string().optional().describe('Primary icon color'),
      })
      .catchall(z.union([z.string(), z.undefined()]))
      .optional()
      .describe('Icon style information'),
    images: z
      .object({
        logo: z.string().url().nullable().optional().describe('Logo image URL'),
        favicon: z
          .string()
          .url()
          .nullable()
          .optional()
          .describe('Favicon image URL'),
        ogImage: z
          .string()
          .url()
          .nullable()
          .optional()
          .describe('Open Graph image URL'),
      })
      .catchall(z.union([z.string(), z.null(), z.undefined()]))
      .optional()
      .describe('Brand images (logo, favicon, og:image)'),
    animations: z
      .object({
        transitionDuration: z
          .string()
          .optional()
          .describe('Transition duration for animations'),
        easing: z
          .string()
          .optional()
          .describe('Easing function for animations'),
      })
      .catchall(z.unknown())
      .optional()
      .describe('Animation and transition settings'),
    layout: z
      .object({
        grid: z
          .object({
            columns: z.number().optional().describe('Number of grid columns'),
            maxWidth: z.string().optional().describe('Maximum grid width'),
          })
          .catchall(z.union([z.number(), z.string(), z.undefined()]))
          .optional()
          .describe('Grid layout configuration'),
        headerHeight: z.string().optional().describe('Header height'),
        footerHeight: z.string().optional().describe('Footer height'),
      })
      .catchall(
        z.union([
          z.number(),
          z.string(),
          z.record(z.union([z.number(), z.string(), z.undefined()])),
          z.undefined(),
        ])
      )
      .optional()
      .describe('Layout configuration (grid, header/footer heights)'),
    tone: z
      .object({
        voice: z.string().optional().describe('Brand voice tone'),
        emojiUsage: z.string().optional().describe('Emoji usage style'),
      })
      .catchall(z.union([z.string(), z.undefined()]))
      .optional()
      .describe('Tone and voice characteristics'),
    personality: z
      .object({
        tone: z
          .enum([
            'professional',
            'playful',
            'modern',
            'traditional',
            'minimalist',
            'bold',
          ])
          .describe('Brand tone'),
        energy: z
          .enum(['low', 'medium', 'high'])
          .describe('Brand energy level'),
        targetAudience: z
          .string()
          .describe('Description of the target audience'),
      })
      .optional()
      .describe('Brand personality traits (tone, energy, target audience)'),
  })
  .catchall(z.unknown());

// Define the schema for Firecrawl documents
const FirecrawlDocumentSchema = z.object({
  markdown: z
    .string()
    .describe('Document content in markdown format')
    .optional(),
  html: z.string().describe('Document content in HTML format').optional(),
  rawHtml: z
    .string()
    .describe('Document content in raw HTML format')
    .optional(),
  json: z
    .unknown()
    .describe('Document content in structured JSON format')
    .optional(),
  summary: z.string().describe('Summary of the document content').optional(),
  metadata: FirecrawlDocumentMetadataSchema.describe(
    'Metadata associated with the document'
  ).optional(),
  links: z
    .array(z.string().url())
    .describe('Array of links found in the document')
    .optional(),
  images: z
    .array(z.string().url())
    .describe('Array of image URLs found in the document')
    .optional(),
  screenshot: z
    .string()
    .describe('Base64-encoded screenshot of the document')
    .optional(),
  attributes: z
    .array(
      z.object({
        selector: z.string().describe('CSS selector for the element'),
        attribute: z.string().describe('Attribute name to extract'),
        values: z.array(z.string()).describe('Extracted attribute values'),
      })
    )
    .describe('Array of extracted attributes from the document')
    .optional(),
  actions: z
    .record(z.unknown())
    .describe('Record of actions performed on the document')
    .optional(),
  warning: z.string().describe('Warning message if any').optional(),
  changeTracking: z
    .record(z.unknown())
    .describe('Change tracking information for the document')
    .optional(),
  branding: FirecrawlBrandingProfileSchema.describe(
    'Branding profile associated with the document'
  ).optional(),
});

// Define the schema for Firecrawl scrape option FormatString
const FirecrawlScrapeOptionsFormatStringSchema = z.enum([
  'markdown',
  'html',
  'rawHtml',
  'links',
  'images',
  'screenshot',
  'summary',
  'changeTracking',
  'json',
  'attributes',
  'branding',
]);

// Define the schema for Firecrawl scrape options
const FirecrawlScrapeOptionsSchema = z.object({
  formats: z
    .array(
      z.union([
        FirecrawlScrapeOptionsFormatStringSchema.describe('Scrape format'),
        z.object({
          type: FirecrawlScrapeOptionsFormatStringSchema.describe(
            'Scrape format'
          ),
        }),
        z.object({
          type: z.literal('json'),
          prompt: z
            .string()
            .optional()
            .describe('Optional prompt for JSON extraction'),
          schema: z
            .union([z.record(z.unknown()), z.any()])
            .optional()
            .describe('Optional JSON schema for structured data extraction'),
        }),
        z.object({
          type: z.literal('changeTracking'),
          modes: z
            .array(z.enum(['git-diff', 'json']))
            .describe('Modes for change tracking'),
          schema: z
            .record(z.unknown())
            .optional()
            .describe('Optional schema for change tracking'),
          prompt: z
            .string()
            .optional()
            .describe('Optional prompt for change tracking'),
          tag: z
            .string()
            .optional()
            .describe('Optional tag for change tracking'),
        }),
        z.object({
          type: z.literal('screenshot'),
          fullPage: z
            .boolean()
            .optional()
            .describe('Whether to capture full page screenshot'),
          quality: z
            .number()
            .optional()
            .describe('Quality of the screenshot (1-100)'),
          viewport: z
            .object({
              width: z.number().describe('Viewport width in pixels'),
              height: z.number().describe('Viewport height in pixels'),
            })
            .optional()
            .describe('Viewport dimensions for the screenshot'),
        }),
        z.object({
          type: z.literal('attributes'),
          selectors: z
            .array(
              z.object({
                selector: z.string().describe('CSS selector for the element'),
                attribute: z.string().describe('Attribute name to extract'),
              })
            )
            .describe('Array of selectors and attributes to extract'),
        }),
      ])
    )
    .default(['markdown'])
    .describe('Formats to scrape from the URL'),
  headers: z
    .record(z.string())
    .optional()
    .describe('HTTP headers to include in the request'),
  includeTags: z
    .array(z.string())
    .optional()
    .describe('HTML tags/classes/ids to include in the scrape'),
  excludeTags: z
    .array(z.string())
    .optional()
    .describe('HTML tags/classes/ids to exclude from the scrape'),
  onlyMainContent: z
    .boolean()
    .default(true)
    .describe('Whether to extract only main content or full page content'),
  timeout: z
    .number()
    .default(30000)
    .describe('Max duration in milliseconds before aborting the request'),
  waitFor: z
    .number()
    .default(0)
    .describe(
      'Milliseconds of extra wait time before scraping (use sparingly). This waiting time is in addition to Firecrawl’s smart wait feature.'
    ),
  mobile: z.boolean().optional().describe('Whether to emulate a mobile device'),
  parsers: z
    .array(
      z.union([
        z.string(),
        z.object({
          type: z.literal('pdf'),
          maxPages: z
            .number()
            .optional()
            .describe('Maximum number of PDF pages to parse'),
        }),
      ])
    )
    .optional()
    .describe('Extract structured content from various document formats'),
  actions: z
    .array(
      z.union([
        z.object({
          type: z.literal('wait'),
          milliseconds: z
            .number()
            .optional()
            .describe('Time to wait in milliseconds (for wait)'),
          selector: z
            .string()
            .optional()
            .describe('CSS selector to wait for (for wait)'),
        }),
        z.object({
          type: z.literal('screenshot'),
          fullPage: z
            .boolean()
            .optional()
            .describe('Whether to capture full page screenshot'),
          quality: z
            .number()
            .optional()
            .describe('Quality of the screenshot (1-100)'),
          viewport: z
            .object({
              width: z.number().describe('Viewport width in pixels'),
              height: z.number().describe('Viewport height in pixels'),
            })
            .optional()
            .describe('Viewport dimensions for the screenshot'),
        }),
        z.object({
          type: z.literal('click'),
          selector: z.string().describe('CSS selector to click on'),
        }),
        z.object({
          type: z.literal('write'),
          text: z.string().describe('Text to write into the element'),
        }),
        z.object({
          type: z.literal('press'),
          key: z.string().describe('Key to press (e.g., "Enter")'),
        }),
        z.object({
          type: z.literal('scroll'),
          direction: z
            .enum(['up', 'down'])
            .describe('Scroll direction (for scroll)'),
          selector: z
            .string()
            .optional()
            .describe('CSS selector to scroll to (for scroll)'),
        }),
        z.object({
          type: z.literal('scrape'),
        }),
        z.object({
          type: z.literal('executeJavascript'),
          script: z.string().describe('JavaScript code to execute on the page'),
        }),
        z.object({
          type: z.literal('pdf'),
          format: z
            .enum([
              'A0',
              'A1',
              'A2',
              'A3',
              'A4',
              'A5',
              'A6',
              'Letter',
              'Legal',
              'Tabloid',
              'Ledger',
            ])
            .optional()
            .describe('Page format for PDF generation'),
          landscape: z
            .boolean()
            .optional()
            .describe('Whether to generate PDF in landscape orientation'),
          scale: z
            .number()
            .optional()
            .describe('Scale factor for PDF rendering'),
        }),
      ])
    )
    .optional()
    .describe('Sequence of browser actions to perform before scraping'),
  location: z
    .object({
      country: z
        .string()
        .optional()
        .describe('Country code for proxy location'),
      languages: z
        .array(z.string())
        .optional()
        .describe('Preferred languages for proxy location'),
    })
    .optional()
    .describe('Location configuration for proxy location'),
  skipTlsVerification: z
    .boolean()
    .optional()
    .describe('Whether to skip TLS certificate verification'),
  removeBase64Images: z
    .boolean()
    .optional()
    .describe('Whether to remove base64-encoded images from the content'),
  fastMode: z
    .boolean()
    .optional()
    .describe('Whether to enable fast mode for scraping'),
  useMock: z
    .string()
    .optional()
    .describe('Use a mock response for testing purposes'),
  blockAds: z
    .boolean()
    .optional()
    .describe('Whether to block ads during scraping'),
  proxy: z
    .union([z.enum(['basic', 'stealth', 'auto']), z.string()])
    .optional()
    .describe('Type of proxy to use for scraping'),
  maxAge: z
    .number()
    .default(172800000)
    .describe(
      'If a cached version of the page is newer than `maxAge` (in milliseconds), Firecrawl returns it instantly; otherwise it scrapes fresh and updates the cache. Set 0 to always fetch fresh.'
    ),
  storeInCache: z
    .boolean()
    .optional()
    .describe('Whether to store the scraped result in cache'),
  integration: z
    .string()
    .optional()
    .describe('Integration identifier for the scrape request'),
});

// Define the base shared parameters schema for Firecrawl operations
const FirecrawlParamsBaseSchema = z.object({
  maxRetries: z
    .number()
    .optional()
    .describe('Maximum number of retries for the scrape request'),
  backoffFactor: z
    .number()
    .optional()
    .describe('Backoff factor for retry delays'),
  credentials: z
    .record(z.nativeEnum(CredentialType), z.string())
    .optional()
    .describe(
      'Object mapping credential types to values (injected at runtime)'
    ),
});

// Define the parameters schema for Firecrawl operations
const FirecrawlParamsSchema = z.discriminatedUnion('operation', [
  // Scrape operation
  FirecrawlParamsBaseSchema.merge(FirecrawlScrapeOptionsSchema).extend({
    operation: z.literal('scrape').describe('Scrape a single URL'),
    url: z
      .string()
      .url('Must be a valid URL')
      .describe('The URL to scrape content from'),
  }),

  // Search operation
  FirecrawlParamsBaseSchema.extend({
    operation: z
      .literal('search')
      .describe('Search the web and optionally scrape each result'),
    query: z.string().describe('The search query to execute'),
    sources: z
      .array(
        z.union([
          z.enum(['web', 'news', 'images']),
          z.object({
            type: z.enum(['web', 'news', 'images']),
          }),
        ])
      )
      .optional()
      .describe(
        'Specialized result types to include in addition to regular web results'
      ),
    categories: z
      .array(
        z.union([
          z.enum(['github', 'research', 'pdf']),
          z.object({
            type: z.enum(['github', 'research', 'pdf']),
          }),
        ])
      )
      .optional()
      .describe('Filter search results by specific categories'),
    limit: z
      .number()
      .min(1)
      .optional()
      .describe('Maximum number of search results to return'),
    tbs: z
      .string()
      .optional()
      .describe(
        'Filter results by time (e.g., "qdr:h" for past hour, "qdr:m" for past month)'
      ),
    location: z
      .string()
      .optional()
      .describe('Geographical location to tailor search results'),
    ignoreInvalidURLs: z
      .boolean()
      .optional()
      .describe('Whether to ignore invalid URLs in the search results'),
    timeout: z
      .number()
      .optional()
      .describe('Timeout in milliseconds for the search operation'),
    scrapeOptions: FirecrawlScrapeOptionsSchema.optional().describe(
      'Scrape options to apply to each search result'
    ),
    integration: z
      .string()
      .optional()
      .describe('Integration identifier for the search request'),
  }),

  // Map operation
  FirecrawlParamsBaseSchema.extend({
    operation: z.literal('map').describe('Map a site to discover URLs'),
    url: z
      .string()
      .url('Must be a valid URL')
      .describe('The base URL of the site to map'),
    search: z
      .string()
      .optional()
      .describe('Search for specific urls inside a website'),
    sitemap: z
      .enum(['only', 'include', 'skip'])
      .optional()
      .describe('Sitemap handling strategy'),
    includeSubdomains: z
      .boolean()
      .optional()
      .describe('Whether to include subdomains in the site map'),
    limit: z.number().optional().describe('Maximum number of URLs to discover'),
    timeout: z
      .number()
      .optional()
      .describe('Timeout in milliseconds for the mapping operation'),
    integration: z
      .string()
      .optional()
      .describe('Integration identifier for the map request'),
    location: z
      .object({
        country: z
          .string()
          .optional()
          .describe('Country code for proxy location'),
        languages: z
          .array(z.string())
          .optional()
          .describe('Preferred languages for proxy location'),
      })
      .optional()
      .describe('Location configuration for proxy location'),
  }),

  // Crawl operation
  FirecrawlParamsBaseSchema.extend({
    operation: z
      .literal('crawl')
      .describe(
        'Recursively search through a urls subdomains, and gather the content'
      ),
    url: z.string().url('Must be a valid URL').describe('The URL to crawl'),
    prompt: z
      .string()
      .optional()
      .describe('Optional prompt to guide the crawl behavior'),
    excludePaths: z
      .array(z.string())
      .optional()
      .describe('List of URL paths to exclude from the crawl'),
    includePaths: z
      .array(z.string())
      .optional()
      .describe('List of URL paths to include in the crawl'),
    maxDiscoveryDepth: z
      .number()
      .optional()
      .describe('Maximum depth for link discovery during the crawl'),
    sitemap: z
      .enum(['skip', 'include'])
      .optional()
      .describe('Sitemap handling strategy during the crawl'),
    ignoreQueryParameters: z
      .boolean()
      .optional()
      .describe('Whether to ignore query parameters when crawling URLs'),
    limit: z.number().optional().describe('Maximum number of pages to crawl'),
    crawlEntireDomain: z
      .boolean()
      .optional()
      .describe('Whether to crawl the entire domain including subdomains'),
    allowExternalLinks: z
      .boolean()
      .optional()
      .describe('Whether to allow crawling external links'),
    allowSubdomains: z
      .boolean()
      .optional()
      .describe('Whether to include subdomains in the crawl'),
    delay: z
      .number()
      .optional()
      .describe('Delay in milliseconds between requests during the crawl'),
    maxConcurrency: z
      .number()
      .optional()
      .describe('Maximum number of concurrent requests during the crawl'),
    webhook: z
      .union([
        z.string().url().describe('Webhook URL to send crawl results to'),
        z.object({
          url: z
            .string()
            .url()
            .describe('Webhook URL to send crawl results to'),
          headers: z
            .record(z.string())
            .optional()
            .describe('HTTP headers to include in the webhook request'),
          metadata: z
            .record(z.string())
            .optional()
            .describe('Additional metadata to include in the webhook payload'),
          events: z
            .array(z.enum(['completed', 'failed', 'page', 'started']))
            .optional()
            .describe('Events that trigger the webhook'),
        }),
      ])
      .optional()
      .describe('Webhook configuration for crawl events'),
    scrapeOptions: FirecrawlScrapeOptionsSchema.optional().describe(
      'Scrape options to apply to each crawled page'
    ),
    zeroDataRetention: z
      .boolean()
      .optional()
      .describe('Whether to retain zero data from the crawl'),
    integration: z
      .string()
      .optional()
      .describe('Integration identifier for the crawl request'),
    pollInterval: z
      .number()
      .optional()
      .describe('Interval in milliseconds to poll for crawl status'),
    timeout: z
      .number()
      .optional()
      .describe('Timeout in milliseconds for the crawl operation'),
  }),

  // Extract operation
  FirecrawlParamsBaseSchema.extend({
    operation: z
      .literal('extract')
      .describe('Extract structured data from a URL'),
    urls: z
      .array(z.string().url('Must be a valid URL'))
      .describe('Array of URLs to extract data from'),
    prompt: z
      .string()
      .optional()
      .describe('Optional prompt to guide the extraction process'),
    schema: z
      .union([z.record(z.unknown()), z.any()])
      .optional()
      .describe('Optional schema to structure the extracted data'),
    systemPrompt: z
      .string()
      .optional()
      .describe('Optional system prompt for the extraction AI agent'),
    allowExternalLinks: z
      .boolean()
      .optional()
      .describe(
        'Whether to allow extraction from external links found on the page'
      ),
    enableWebSearch: z
      .boolean()
      .optional()
      .describe('Whether to enable web search to supplement extraction'),
    showSources: z
      .boolean()
      .optional()
      .describe('Whether to include source URLs in the extraction results'),
    scrapeOptions: FirecrawlScrapeOptionsSchema.optional().describe(
      'Optional scrape options to apply to the extraction process'
    ),
    ignoreInvalidURLs: z
      .boolean()
      .optional()
      .describe('Whether to ignore invalid URLs in the input list'),
    integration: z
      .string()
      .optional()
      .describe('Integration identifier for the extraction process'),
    agent: z
      .object({
        model: z.literal('FIRE-1').describe('AI model to use for extraction'),
      })
      .optional()
      .describe('Agent to use for the extraction process'),
    pollInterval: z
      .number()
      .optional()
      .describe('Interval in milliseconds to poll for extraction status'),
    timeout: z
      .number()
      .optional()
      .describe('Timeout in milliseconds for the extraction operation'),
  }),
]);

// Define the base shared result schema for Firecrawl operations
const FirecrawlResultBaseSchema = z.object({
  success: z.boolean().describe('Whether the operation succeeded'),
  error: z.string().describe('Error message if operation failed'),
});

// Define result schema for Firecrawl operations
const FirecrawlResultSchema = z.discriminatedUnion('operation', [
  // Scrape operation
  FirecrawlResultBaseSchema.merge(FirecrawlDocumentSchema).extend({
    operation: z.literal('scrape').describe('Scrape a single URL'),
  }),

  // Search operation
  FirecrawlResultBaseSchema.extend({
    operation: z
      .literal('search')
      .describe('Search the web and optionally scrape each result'),
    web: z
      .array(
        z.union([
          z.object({
            url: z.string().url().describe('Result URL'),
            title: z.string().optional().describe('Result title'),
            description: z.string().optional().describe('Result description'),
            category: z.string().optional().describe('Result category'),
          }),
          FirecrawlDocumentSchema,
        ])
      )
      .optional()
      .describe('Web search results'),
    news: z
      .array(
        z.union([
          z.object({
            title: z.string().optional().describe('Result title'),
            url: z.string().url().optional().describe('Result URL'),
            snippet: z.string().optional().describe('Result snippet'),
            date: z.string().optional().describe('Result date'),
            imageUrl: z.string().url().optional().describe('Result image URL'),
            position: z.number().optional().describe('Result position'),
            category: z.string().optional().describe('Result category'),
          }),
          FirecrawlDocumentSchema,
        ])
      )
      .optional()
      .describe('News search results'),
    images: z
      .array(
        z.union([
          z.object({
            title: z.string().optional().describe('Result title'),
            imageUrl: z.string().url().optional().describe('Result image URL'),
            imageWidth: z
              .number()
              .optional()
              .describe('Result image width in pixels'),
            imageHeight: z
              .number()
              .optional()
              .describe('Result image height in pixels'),
            url: z.string().url().optional().describe('Result URL'),
            position: z.number().optional().describe('Result position'),
          }),
          FirecrawlDocumentSchema,
        ])
      )
      .optional()
      .describe('Image search results'),
    other: z
      .array(z.unknown())
      .optional()
      .describe('Unknown mystery search results'),
  }),

  // Map operation
  FirecrawlResultBaseSchema.extend({
    operation: z.literal('map').describe('Map a site to discover URLs'),
    links: z
      .array(
        z.object({
          url: z.string().url().describe('Discovered URL'),
          title: z.string().optional().describe('Page title'),
          description: z.string().optional().describe('Page description'),
          category: z.string().optional().describe('URL category'),
        })
      )
      .describe('Discovered links'),
  }),

  // Crawl operation
  FirecrawlResultBaseSchema.extend({
    operation: z
      .literal('crawl')
      .describe(
        'Recursively search through a urls subdomains, and gather the content'
      ),
    status: z
      .enum(['scraping', 'completed', 'failed', 'cancelled'])
      .describe('Status of the crawl job'),
    total: z.number().describe('Total number of pages to crawl'),
    completed: z.number().describe('Number of pages crawled'),
    creditsUsed: z.number().optional().describe('Number of credits used'),
    expiresAt: z
      .string()
      .optional()
      .describe('Expiration time of the crawl job'),
    // next: z
    //   .string()
    //   .url()
    //   .nullable()
    //   .optional()
    //   .describe('URL to fetch the next batch of crawl results'),
    data: z.array(FirecrawlDocumentSchema).describe('Crawled documents'),
  }),

  // Extract operation
  FirecrawlResultBaseSchema.extend({
    operation: z
      .literal('extract')
      .describe('Extract structured data from a URL'),
    id: z.string().optional().describe('Extraction job identifier'),
    status: z
      .enum(['processing', 'completed', 'failed', 'cancelled'])
      .optional()
      .describe('Status of the extraction job'),
    data: z.unknown().optional().describe('Extracted structured data'),
    warning: z.string().optional().describe('Warning message if any'),
    sources: z.record(z.unknown()).optional().describe('Extraction sources'),
    expiresAt: z
      .string()
      .optional()
      .describe('Expiration time of the extraction job'),
  }),
]);

type FirecrawlParams = z.input<typeof FirecrawlParamsSchema>;
type FirecrawlResult = z.output<typeof FirecrawlResultSchema>;

// Export the input type for external usage
export type FirecrawlParamsInput = z.input<typeof FirecrawlParamsSchema>;

// Helper type to get the result type for a specific operation
export type FirecrawlOperationResult<T extends FirecrawlParams['operation']> =
  Extract<FirecrawlResult, { operation: T }>;

export class FirecrawlBubble<
  T extends FirecrawlParams = FirecrawlParams,
> extends ServiceBubble<
  T,
  Extract<FirecrawlResult, { operation: T['operation'] }>
> {
  static readonly type = 'service' as const;
  static readonly service = 'firecrawl';
  static readonly authType = 'apikey' as const;
  static readonly bubbleName = 'firecrawl';
  static readonly schema = FirecrawlParamsSchema;
  static readonly resultSchema = FirecrawlResultSchema;
  static readonly shortDescription =
    'Firecrawl API integration for web crawl operations.';
  static readonly longDescription = `
    Firecrawl API integration for web crawling, scraping, searching, and data extraction.

    Features:
    - Scrape content from any URL with customizable options.
    - Perform web searches and scrape results.
    - Map websites to discover URLs.
    - Crawl entire domains recursively.
    - Extract structured data using AI.

    Use cases:
    - Add web knowledge to your RAG chatbots and AI assistants.
    - Extract and filter leads from websites to enrich your sales pipeline.
    - Monitor SERP rankings and optimize content strategy.
    - Build agentic research tools with deep web search capabilities.
    - Monitor pricing and track inventory across e-commerce sites.
    - Generate AI content based on website data and structure.
    - Track companies and extract financial insights from web data.
    - Monitor competitor websites and track changes in real-time.
    - Transfer web data seamlessly between platforms and systems.
    - Monitor websites, track uptime, and detect changes in real-time.

    Security Features:
    - API key authentication (FIRECRAWL_API_KEY)
    - Secure credential injection at runtime
  `;
  static readonly alias = 'firecrawl';

  constructor(
    params: T = {
      operation: 'scrape',
    } as T,
    context?: BubbleContext,
    instanceId?: string
  ) {
    super(params, context, instanceId);
  }

  public async testCredential(): Promise<boolean> {
    const apiKey = this.chooseCredential();
    if (!apiKey) {
      return false;
    }
    const firecrawl = new Firecrawl({ apiKey });
    try {
      const _ = await firecrawl.getConcurrency();
      if (_) {
        // suppress ts(6133)
      }
      return true;
    } catch (error) {
      console.error('Firecrawl credential test failed:', error);
      return false;
    }
  }

  protected chooseCredential(): string | undefined {
    const credentials = this.params.credentials;
    if (!credentials || typeof credentials !== 'object') {
      return undefined;
    }
    return credentials[CredentialType.FIRECRAWL_API_KEY];
  }

  protected async performAction(
    context?: BubbleContext
  ): Promise<Extract<FirecrawlResult, { operation: T['operation'] }>> {
    void context;
    const { operation } = this.params;
    let result: Extract<FirecrawlResult, { operation: T['operation'] }>;

    switch (operation) {
      case 'scrape':
        result = (await this.handleScrape(
          this.params as Extract<FirecrawlParams, { operation: 'scrape' }>
        )) as Extract<FirecrawlResult, { operation: T['operation'] }>;
        break;
      case 'search':
        result = (await this.handleSearch(
          this.params as Extract<FirecrawlParams, { operation: 'search' }>
        )) as Extract<FirecrawlResult, { operation: T['operation'] }>;
        break;
      case 'map':
        result = (await this.handleMap(
          this.params as Extract<FirecrawlParams, { operation: 'map' }>
        )) as Extract<FirecrawlResult, { operation: T['operation'] }>;
        break;
      case 'crawl':
        result = (await this.handleCrawl(
          this.params as Extract<FirecrawlParams, { operation: 'crawl' }>
        )) as Extract<FirecrawlResult, { operation: T['operation'] }>;
        break;
      case 'extract':
        result = (await this.handleExtract(
          this.params as Extract<FirecrawlParams, { operation: 'extract' }>
        )) as Extract<FirecrawlResult, { operation: T['operation'] }>;
        break;
      default:
        return {
          operation: operation as T['operation'],
          success: false,
          error: `Unsupported operation: ${operation}`,
        } as Extract<FirecrawlResult, { operation: T['operation'] }>;
    }

    // Log token usage if operation was successful
    if (result.success && this.context?.logger) {
      const creditsUsed = this.calculateCreditsUsed(operation, result);
      if (creditsUsed > 0) {
        this.context?.logger.logTokenUsage(
          {
            usage: creditsUsed,
            service: CredentialType.FIRECRAWL_API_KEY,
            unit: this.getUsageUnit(operation),
            subService: operation,
          },
          `Firecrawl ${operation}: ${creditsUsed} credits used`,
          {
            bubbleName: 'firecrawl',
            variableId: this.context?.variableId,
            operationType: 'bubble_execution',
          }
        );
      }
    }

    return result;
  }

  /**
   * Calculate credits used based on operation type and result
   */
  private calculateCreditsUsed(
    operation: string,
    result: FirecrawlResult
  ): number {
    switch (operation) {
      case 'scrape':
        // Scrape uses 1 credit per page
        return 1;
      case 'search': {
        // Search uses 2 credits per 10 results
        const searchResult = result as Extract<
          FirecrawlResult,
          { operation: 'search' }
        >;
        const webResults = searchResult.web?.length ?? 0;
        const newsResults = searchResult.news?.length ?? 0;
        const imageResults = searchResult.images?.length ?? 0;
        const otherResults = searchResult.other?.length ?? 0;
        const totalResults =
          webResults + newsResults + imageResults + otherResults;
        return Math.ceil(totalResults / 10) * 2;
      }
      case 'map': {
        // Map uses 1 credit per operation
        return 1;
      }
      case 'crawl': {
        // Crawl uses 1 credit per page crawled
        const crawlResult = result as Extract<
          FirecrawlResult,
          { operation: 'crawl' }
        >;
        return crawlResult.creditsUsed ?? crawlResult.data?.length ?? 0;
      }
      case 'extract': {
        // Extract uses credits based on URLs processed
        const extractResult = result as Extract<
          FirecrawlResult,
          { operation: 'extract' }
        >;
        // Extract typically charges per URL, estimate 1 credit per URL if not provided
        const urlCount =
          (this.params as Extract<FirecrawlParams, { operation: 'extract' }>)
            ?.urls?.length ?? 1;
        return extractResult.success ? urlCount : 0;
      }
      default:
        return 0;
    }
  }

  /**
   * Get the usage unit string for the operation
   */
  private getUsageUnit(
    operation: string
  ): 'per_result' | 'per_10_results' | 'per_url' | 'per_page' {
    switch (operation) {
      case 'scrape':
        return 'per_result';
      case 'search':
        return 'per_10_results';
      case 'map':
        return 'per_result';
      case 'crawl':
        return 'per_result';
      case 'extract':
        return 'per_url';
      default:
        return 'per_result';
    }
  }

  private async handleScrape(
    params: Extract<FirecrawlParams, { operation: 'scrape' }>
  ): Promise<Extract<FirecrawlResult, { operation: 'scrape' }>> {
    const apiKey = this.chooseCredential();
    const {
      maxRetries,
      backoffFactor,
      url,
      formats,
      headers,
      includeTags,
      excludeTags,
      onlyMainContent,
      timeout,
      waitFor,
      mobile,
      parsers,
      actions,
      location,
      skipTlsVerification,
      removeBase64Images,
      fastMode,
      useMock,
      blockAds,
      proxy,
      maxAge,
      storeInCache,
      integration,
    } = params;
    if (!apiKey) {
      return {
        operation: 'scrape',
        success: false,
        error: 'FIRECRAWL_API_KEY is required',
      };
    }
    const firecrawl = new Firecrawl({
      apiKey,
      maxRetries,
      backoffFactor,
      // timeoutMs: timeout,
    });
    try {
      const response = await firecrawl.scrape(url, {
        formats,
        headers,
        includeTags,
        excludeTags,
        onlyMainContent,
        timeout,
        waitFor,
        mobile,
        parsers,
        actions,
        location,
        skipTlsVerification,
        removeBase64Images,
        fastMode,
        useMock,
        blockAds,
        proxy,
        maxAge,
        storeInCache,
        integration,
      });
      return {
        operation: 'scrape',
        success: true,
        error: '',
        ...response,
      };
    } catch (error) {
      return {
        operation: 'scrape',
        success: false,
        error:
          error instanceof Error ? error.message : `Unknown error occurred`,
      };
    }
  }

  private async handleSearch(
    params: Extract<FirecrawlParams, { operation: 'search' }>
  ): Promise<Extract<FirecrawlResult, { operation: 'search' }>> {
    const apiKey = this.chooseCredential();
    const {
      maxRetries,
      backoffFactor,
      query,
      sources,
      categories,
      limit,
      tbs,
      location,
      ignoreInvalidURLs,
      timeout,
      scrapeOptions,
      integration,
    } = params;
    if (!apiKey) {
      return {
        operation: 'search',
        success: false,
        error: 'FIRECRAWL_API_KEY is required',
      };
    }
    const firecrawl = new Firecrawl({
      apiKey,
      maxRetries,
      backoffFactor,
      // timeoutMs: timeout,
    });
    try {
      const response = await firecrawl.search(query, {
        sources,
        categories,
        limit,
        tbs,
        location,
        ignoreInvalidURLs,
        timeout,
        scrapeOptions,
        integration,
      });
      // Handle the response based on Firecrawl's actual API structure
      // The search API might return different structures, so handle both cases
      if (Array.isArray(response)) {
        return {
          operation: 'search',
          success: true,
          error: '',
          other: response,
        };
      } else {
        if ('data' in response && Array.isArray(response.data)) {
          const { data, ...rest } = response;
          return {
            operation: 'search',
            success: true,
            error: '',
            other: data,
            ...rest,
          };
        } else {
          return {
            operation: 'search',
            success: true,
            error: '',
            ...response,
          };
        }
      }
    } catch (error) {
      return {
        operation: 'search',
        success: false,
        error:
          error instanceof Error ? error.message : `Unknown error occurred`,
      };
    }
  }

  private async handleMap(
    params: Extract<FirecrawlParams, { operation: 'map' }>
  ): Promise<Extract<FirecrawlResult, { operation: 'map' }>> {
    const apiKey = this.chooseCredential();
    const {
      maxRetries,
      backoffFactor,
      url,
      search,
      sitemap,
      includeSubdomains,
      limit,
      timeout,
      integration,
      location,
    } = params;
    if (!apiKey) {
      return {
        operation: 'map',
        success: false,
        error: 'FIRECRAWL_API_KEY is required',
        links: [],
      };
    }
    const firecrawl = new Firecrawl({
      apiKey,
      maxRetries,
      backoffFactor,
      // timeoutMs: timeout,
    });
    try {
      const response = await firecrawl.map(url, {
        search,
        sitemap,
        includeSubdomains,
        limit,
        timeout,
        integration,
        location,
      });
      return {
        operation: 'map',
        success: true,
        error: '',
        ...response,
      };
    } catch (error) {
      return {
        operation: 'map',
        success: false,
        error:
          error instanceof Error ? error.message : `Unknown error occurred`,
        links: [],
      };
    }
  }

  private async handleCrawl(
    params: Extract<FirecrawlParams, { operation: 'crawl' }>
  ): Promise<Extract<FirecrawlResult, { operation: 'crawl' }>> {
    const apiKey = this.chooseCredential();
    const {
      maxRetries,
      backoffFactor,
      url,
      prompt,
      excludePaths,
      includePaths,
      maxDiscoveryDepth,
      sitemap,
      ignoreQueryParameters,
      limit,
      crawlEntireDomain,
      allowExternalLinks,
      allowSubdomains,
      delay,
      maxConcurrency,
      webhook,
      scrapeOptions,
      zeroDataRetention,
      integration,
      pollInterval,
      timeout,
    } = params;
    if (!apiKey) {
      return {
        operation: 'crawl',
        success: false,
        error: 'FIRECRAWL_API_KEY is required',
        status: 'failed',
        total: 0,
        completed: 0,
        data: [],
      };
    }
    const firecrawl = new Firecrawl({
      apiKey,
      maxRetries,
      backoffFactor,
      // timeoutMs: timeout,
    });
    try {
      const response = await firecrawl.crawl(url, {
        prompt,
        excludePaths,
        includePaths,
        maxDiscoveryDepth,
        sitemap,
        ignoreQueryParameters,
        limit,
        crawlEntireDomain,
        allowExternalLinks,
        allowSubdomains,
        delay,
        maxConcurrency,
        webhook,
        scrapeOptions,
        zeroDataRetention,
        integration,
        pollInterval,
        timeout,
      });
      return {
        operation: 'crawl',
        success: response.status === 'completed',
        error:
          response.status === 'completed' ? '' : `Crawl ${response.status}`,
        ...response,
      };
    } catch (error) {
      return {
        operation: 'crawl',
        success: false,
        error:
          error instanceof Error ? error.message : `Unknown error occurred`,
        status: 'failed',
        total: 0,
        completed: 0,
        data: [],
      };
    }
  }

  private async handleExtract(
    params: Extract<FirecrawlParams, { operation: 'extract' }>
  ): Promise<Extract<FirecrawlResult, { operation: 'extract' }>> {
    const apiKey = this.chooseCredential();
    const {
      maxRetries,
      backoffFactor,
      urls,
      prompt,
      schema,
      systemPrompt,
      allowExternalLinks,
      enableWebSearch,
      showSources,
      scrapeOptions,
      ignoreInvalidURLs,
      integration,
      agent,
      pollInterval,
      timeout,
    } = params;
    if (!apiKey) {
      return {
        operation: 'extract',
        success: false,
        error: 'FIRECRAWL_API_KEY is required',
      };
    }
    const firecrawl = new Firecrawl({
      apiKey,
      maxRetries,
      backoffFactor,
      // timeoutMs: timeout,
    });
    try {
      const {
        success: responseSuccess,
        error: responseError,
        ...response
      } = await firecrawl.extract({
        urls,
        prompt,
        schema,
        systemPrompt,
        allowExternalLinks,
        enableWebSearch,
        showSources,
        scrapeOptions,
        ignoreInvalidURLs,
        integration,
        agent,
        pollInterval,
        timeout,
      });
      const success = responseSuccess ?? response.status === 'completed';
      const error =
        responseError ??
        (success
          ? ''
          : response.status === undefined
            ? 'Unknown error occurred'
            : `Extraction ${response.status}`);
      return {
        operation: 'extract',
        success,
        error,
        ...response,
      };
    } catch (error) {
      return {
        operation: 'extract',
        success: false,
        error:
          error instanceof Error ? error.message : `Unknown error occurred`,
      };
    }
  }
}
