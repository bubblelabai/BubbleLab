import { z } from 'zod';

export const GoogleMapsScraperInputSchema = z.object({
  searchStringsArray: z
    .array(z.string())
    .min(1, 'At least one search query is required')
    .describe(
      'Search queries for Google Maps. Examples: ["restaurants in New York", "hotels in Paris"]'
    ),

  locationQuery: z
    .string()
    .optional()
    .describe('Location to search in. Examples: "New York, USA", "London, UK"'),

  maxCrawledPlaces: z
    .number()
    .min(1)
    .max(1000)
    .default(100)
    .optional()
    .describe('Maximum number of places to scrape per search (default: 100)'),

  language: z
    .string()
    .default('en')
    .optional()
    .describe('Language code for results (default: en)'),

  onlyDataFromSearchPage: z
    .boolean()
    .default(false)
    .optional()
    .describe('Only scrape data from search page (faster but less detailed)'),

  scrapeReviewsCount: z
    .number()
    .min(0)
    .max(1000)
    .default(0)
    .optional()
    .describe('Number of reviews to scrape per place (default: 0)'),

  scrapePhotosCount: z
    .number()
    .min(0)
    .max(100)
    .default(0)
    .optional()
    .describe('Number of photos to scrape per place (default: 0)'),

  scrapeDirections: z
    .boolean()
    .default(false)
    .optional()
    .describe('Whether to scrape directions information'),

  includeWebResults: z
    .boolean()
    .default(false)
    .optional()
    .describe('Include web search results'),
});

const GoogleMapsOpeningHoursSchema = z.object({
  monday: z.string().optional(),
  tuesday: z.string().optional(),
  wednesday: z.string().optional(),
  thursday: z.string().optional(),
  friday: z.string().optional(),
  saturday: z.string().optional(),
  sunday: z.string().optional(),
});

const GoogleMapsReviewSchema = z.object({
  name: z.string().optional().describe('Reviewer name'),

  rating: z.number().optional().describe('Rating given (1-5)'),

  text: z.string().optional().describe('Review text'),

  publishedAtDate: z.string().optional().describe('When review was published'),

  likesCount: z.number().optional().describe('Number of likes on review'),

  reviewerId: z.string().optional().describe('Reviewer ID'),

  reviewerUrl: z.string().optional().describe('Reviewer profile URL'),

  reviewerNumberOfReviews: z
    .number()
    .optional()
    .describe('Total reviews by this reviewer'),

  responseFromOwnerText: z
    .string()
    .optional()
    .describe('Owner response to review'),
});

const GoogleMapsCoordinatesSchema = z.object({
  lat: z.number().optional().describe('Latitude'),
  lng: z.number().optional().describe('Longitude'),
});

export const GoogleMapsPlaceSchema = z.object({
  title: z.string().optional().describe('Place name'),

  placeId: z.string().optional().describe('Google Maps place ID'),

  url: z.string().optional().describe('Google Maps URL'),

  address: z.string().optional().describe('Full address'),

  addressParsed: z
    .object({
      neighborhood: z.string().optional(),
      street: z.string().optional(),
      city: z.string().optional(),
      postalCode: z.string().optional(),
      state: z.string().optional(),
      countryCode: z.string().optional(),
    })
    .optional()
    .describe('Parsed address components'),

  location: GoogleMapsCoordinatesSchema.optional().describe(
    'Geographic coordinates'
  ),

  categories: z.array(z.string()).optional().describe('Place categories'),

  website: z.string().optional().describe('Business website'),

  phone: z.string().optional().describe('Phone number'),

  phoneUnformatted: z.string().optional().describe('Unformatted phone number'),

  rating: z.number().optional().describe('Average rating (1-5)'),

  reviewsCount: z.number().optional().describe('Total number of reviews'),

  reviews: z
    .array(GoogleMapsReviewSchema)
    .optional()
    .describe('Array of reviews (if scrapeReviewsCount > 0)'),

  openingHours: z
    .array(GoogleMapsOpeningHoursSchema)
    .optional()
    .describe('Opening hours by day'),

  isAdvertisement: z
    .boolean()
    .optional()
    .describe('Whether this is a sponsored result'),

  priceLevel: z.string().optional().describe('Price level ($, $$, $$$, $$$$)'),

  temporarily_closed: z
    .boolean()
    .optional()
    .describe('Whether temporarily closed'),

  permanently_closed: z
    .boolean()
    .optional()
    .describe('Whether permanently closed'),

  claimThisBusiness: z
    .boolean()
    .optional()
    .describe('Whether business is unclaimed'),

  plus_code: z.string().optional().describe('Plus code'),

  imageUrls: z
    .array(z.string())
    .optional()
    .describe('Array of image URLs (if scrapePhotosCount > 0)'),

  menuUrl: z.string().optional().describe('Menu URL if available'),

  orderUrl: z.string().optional().describe('Online ordering URL if available'),

  reservationUrl: z
    .string()
    .optional()
    .describe('Reservation URL if available'),

  popularTimes: z
    .array(
      z.object({
        day: z.string().optional(),
        hours: z.array(z.number()).optional(),
      })
    )
    .optional()
    .describe('Popular times data'),

  additionalInfo: z
    .object({
      accessibility: z.array(z.string()).optional(),
      amenities: z.array(z.string()).optional(),
      atmosphere: z.array(z.string()).optional(),
      crowd: z.array(z.string()).optional(),
      highlights: z.array(z.string()).optional(),
      offerings: z.array(z.string()).optional(),
      payments: z.array(z.string()).optional(),
      planning: z.array(z.string()).optional(),
      popularFor: z.array(z.string()).optional(),
      serviceOptions: z.array(z.string()).optional(),
    })
    .optional()
    .describe('Additional place attributes'),
});

export type GoogleMapsScraperInput = z.output<
  typeof GoogleMapsScraperInputSchema
>;
export type GoogleMapsPlace = z.output<typeof GoogleMapsPlaceSchema>;
