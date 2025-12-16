import { z } from 'zod';
import { ToolBubble } from '../../types/tool-bubble-class.js';
import type { BubbleContext } from '../../types/bubble.js';
import { CredentialType, type BubbleName } from '@bubblelab/shared-schemas';
import { ApifyBubble } from '../service-bubble/apify/apify.js';
import type { ActorOutput } from '../service-bubble/apify/types.js';

// Unified Google Maps data types
const GoogleMapsReviewSchema = z.object({
  name: z.string().nullable().describe('Reviewer name'),
  rating: z.number().nullable().describe('Rating (1-5)'),
  text: z.string().nullable().describe('Review text'),
  publishedAtDate: z.string().nullable().describe('Publish date'),
  likesCount: z.number().nullable().describe('Number of likes'),
  responseFromOwnerText: z.string().nullable().describe('Owner response'),
});

const GoogleMapsPlaceSchema = z.object({
  title: z.string().nullable().describe('Place name'),
  placeId: z.string().nullable().describe('Place ID'),
  url: z.string().nullable().describe('Place URL'),
  address: z.string().nullable().describe('Full address'),
  category: z.string().nullable().describe('Primary category'),
  website: z.string().nullable().describe('Website URL'),
  phone: z.string().nullable().describe('Phone number'),
  rating: z.number().nullable().describe('Average rating'),
  reviewsCount: z.number().nullable().describe('Total reviews'),
  priceLevel: z.string().nullable().describe('Price level'),
  isAdvertisement: z.boolean().nullable().describe('Is sponsored'),
  location: z
    .object({
      lat: z.number().nullable(),
      lng: z.number().nullable(),
    })
    .nullable()
    .describe('Coordinates'),
  openingHours: z
    .array(
      z.object({
        day: z.string().nullable(),
        hours: z.string().nullable().or(z.array(z.string()).nullable()),
      })
    )
    .nullable()
    .describe('Opening hours'),
  reviews: z
    .array(GoogleMapsReviewSchema)
    .nullable()
    .describe('Recent reviews'),
  imageUrls: z.array(z.string()).nullable().describe('Image URLs'),
  additionalInfo: z
    .record(z.array(z.string()))
    .nullable()
    .describe('Additional attributes (accessibility, amenities, etc.)'),
});

const GoogleMapsToolParamsSchema = z.object({
  operation: z.enum(['search']).describe('Operation (only search supported)'),

  queries: z
    .array(z.string())
    .min(1)
    .describe('Search queries (e.g. "restaurants in NYC")'),

  location: z
    .string()
    .optional()
    .describe('Location to focus search (e.g. "New York, USA")'),

  limit: z
    .number()
    .min(1)
    .max(500)
    .default(20)
    .optional()
    .describe('Maximum number of places to scrape per query'),

  language: z.string().default('en').optional().describe('Result language'),

  extractReviews: z
    .number()
    .min(0)
    .max(100)
    .default(0)
    .optional()
    .describe('Number of reviews to extract per place'),

  extractPhotos: z
    .number()
    .min(0)
    .max(100)
    .default(0)
    .optional()
    .describe('Number of photos to extract per place'),

  credentials: z
    .record(z.nativeEnum(CredentialType), z.string())
    .optional()
    .describe('Required credentials (auto-injected)'),
});

const GoogleMapsToolResultSchema = z.object({
  operation: z.enum(['search']).describe('Operation performed'),

  places: z.array(GoogleMapsPlaceSchema).describe('Found places'),

  totalPlaces: z.number().describe('Total places found'),
  success: z.boolean().describe('Whether the operation was successful'),
  error: z.string().describe('Error message if operation failed'),
});

type GoogleMapsToolParams = z.output<typeof GoogleMapsToolParamsSchema>;
type GoogleMapsToolResult = z.output<typeof GoogleMapsToolResultSchema>;
type GoogleMapsToolParamsInput = z.input<typeof GoogleMapsToolParamsSchema>;

export class GoogleMapsTool extends ToolBubble<
  GoogleMapsToolParams,
  GoogleMapsToolResult
> {
  static readonly bubbleName: BubbleName = 'google-maps-tool';
  static readonly schema = GoogleMapsToolParamsSchema;
  static readonly resultSchema = GoogleMapsToolResultSchema;
  static readonly shortDescription =
    'Scrape Google Maps business listings, reviews, and place data.';
  static readonly longDescription = `
    Universal Google Maps scraping tool.
    
    Operations:
    - search: Find businesses and places by keyword and location
    
    Uses Apify's nwua/google-maps-scraper.
  `;
  static readonly alias = 'maps';
  static readonly type = 'tool';

  constructor(
    params: GoogleMapsToolParamsInput = {
      operation: 'search',
      queries: ['restaurants in SF'],
      limit: 20,
    },
    context?: BubbleContext
  ) {
    super(params, context);
  }

  async performAction(): Promise<GoogleMapsToolResult> {
    const credentials = this.params.credentials;
    if (!credentials || !credentials[CredentialType.APIFY_CRED]) {
      return this.createErrorResult(
        'Google Maps scraping requires authentication. Please configure APIFY_CRED.'
      );
    }

    try {
      const result = await this.runScraper();

      return {
        operation: 'search',
        places: result.places,
        totalPlaces: result.places.length,
        success: result.success,
        error: result.error,
      };
    } catch (error) {
      return this.createErrorResult(
        error instanceof Error ? error.message : 'Unknown error occurred'
      );
    }
  }

  private createErrorResult(errorMessage: string): GoogleMapsToolResult {
    return {
      operation: 'search',
      places: [],
      totalPlaces: 0,
      success: false,
      error: errorMessage,
    };
  }

  private async runScraper(): Promise<{
    places: z.infer<typeof GoogleMapsPlaceSchema>[];
    success: boolean;
    error: string;
  }> {
    const {
      queries,
      location,
      limit,
      language,
      extractReviews,
      extractPhotos,
    } = this.params;

    const input: any = {
      searchStringsArray: queries,
      locationQuery: location,
      maxCrawledPlaces: limit,
      language,
      scrapeReviewsCount: extractReviews || 0,
      scrapePhotosCount: extractPhotos || 0,
      // Default safer settings
      onlyDataFromSearchPage: false,
      scrapeDirections: false,
      includeWebResults: false,
    };

    const scraper = new ApifyBubble<'nwua/google-maps-scraper'>(
      {
        actorId: 'nwua/google-maps-scraper',
        input,
        waitForFinish: true,
        timeout: 240000, // 4 minutes, maps can be slow
        credentials: this.params.credentials,
      },
      this.context,
      'googleMapsScraper'
    );

    const apifyResult = await scraper.action();

    if (!apifyResult.data.success) {
      return {
        places: [],
        success: false,
        error: apifyResult.data.error || 'Failed to scrape Google Maps',
      };
    }

    const items = apifyResult.data.items || [];
    const places = this.transformPlaces(items);

    return {
      places,
      success: true,
      error: '',
    };
  }

  private transformPlaces(
    items: ActorOutput<'nwua/google-maps-scraper'>[]
  ): z.infer<typeof GoogleMapsPlaceSchema>[] {
    return items.map((item) => ({
      title: item.title || null,
      placeId: item.placeId || null,
      url: item.url || null,
      address: item.address || null,
      category: item.categories?.[0] || null,
      website: item.website || null,
      phone: item.phone || item.phoneUnformatted || null,
      rating: item.rating || null,
      reviewsCount: item.reviewsCount || null,
      priceLevel: item.priceLevel || null,
      isAdvertisement: item.isAdvertisement || null,
      location: item.location
        ? {
            lat: item.location.lat || null,
            lng: item.location.lng || null,
          }
        : null,
      openingHours: item.openingHours
        ? item.openingHours.map((h: any) => ({
            day: h.day || null,
            hours: Array.isArray(h.hours) ? null : h.hours || null, // Simplified
          }))
        : null,
      reviews: item.reviews
        ? item.reviews.map((r) => ({
            name: r.name || null,
            rating: r.rating || null,
            text: r.text || null,
            publishedAtDate: r.publishedAtDate || null,
            likesCount: r.likesCount || null,
            responseFromOwnerText: r.responseFromOwnerText || null,
          }))
        : null,
      imageUrls: item.imageUrls || null,
      additionalInfo: item.additionalInfo
        ? (Object.fromEntries(
            Object.entries(item.additionalInfo).filter(([_, v]) =>
              Array.isArray(v)
            )
          ) as Record<string, string[]>)
        : null,
    }));
  }
}
