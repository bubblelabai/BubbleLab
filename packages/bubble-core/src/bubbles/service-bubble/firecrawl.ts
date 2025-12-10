import { z } from 'zod';
import { ServiceBubble } from '../../types/service-bubble-class.js';
import type { BubbleContext } from '../../types/bubble.js';
import { CredentialType } from '@bubblelab/shared-schemas';

// Define the schema for Firecrawl document metadata
const FirecrawlDocumentMetadataSchema = z
  .object({
    title: z.string().optional().describe('Title of the document'),
    description: z.string().optional().describe('Description of the document'),
    url: z.string().url().optional().describe('URL of the document'),
    language: z.string().optional().describe('Language of the document'),
    keywords: z
      .union([z.string(), z.array(z.string())])
      .optional()
      .describe('Keywords associated with the document'),
    robots: z.string().optional().describe('Robots meta tag content'),
    ogTitle: z.string().optional().describe('Open Graph title'),
    ogDescription: z.string().optional().describe('Open Graph description'),
    ogUrl: z.string().url().optional().describe('Open Graph URL'),
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
