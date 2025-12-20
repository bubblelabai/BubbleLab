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
});

const GoogleMapsOpeningHoursSchema = z.object({
  day: z.string().describe('Day of the week'),
  hours: z.string().describe('Opening hours for the day'),
});

const GoogleMapsReviewsDistributionSchema = z.object({
  oneStar: z.number().optional(),
  twoStar: z.number().optional(),
  threeStar: z.number().optional(),
  fourStar: z.number().optional(),
  fiveStar: z.number().optional(),
});

const GoogleMapsLocationSchema = z.object({
  lat: z.number().describe('Latitude'),
  lng: z.number().describe('Longitude'),
});

const GoogleMapsAdditionalInfoSchema = z.record(
  z.string(),
  z.array(z.record(z.string(), z.boolean()))
);

const GoogleMapsAdditionalOpeningHoursSchema = z.record(
  z.string(),
  z.array(GoogleMapsOpeningHoursSchema)
);

export const GoogleMapsPlaceSchema = z.object({
  title: z.string().optional().describe('Place name'),

  description: z.string().optional().describe('Place description'),

  price: z.string().nullable().optional().describe('Price level indicator'),

  categoryName: z.string().optional().describe('Primary category name'),

  address: z.string().optional().describe('Full address'),

  neighborhood: z.string().nullable().optional().describe('Neighborhood'),

  street: z.string().nullable().optional().describe('Street address'),

  city: z.string().optional().describe('City'),

  postalCode: z.string().nullable().optional().describe('Postal code'),

  state: z.string().optional().describe('State or province'),

  countryCode: z.string().optional().describe('Country code'),

  website: z.string().optional().describe('Business website'),

  phone: z.string().optional().describe('Phone number'),

  phoneUnformatted: z.string().optional().describe('Unformatted phone number'),

  claimThisBusiness: z
    .boolean()
    .optional()
    .describe('Whether business is unclaimed'),

  location: GoogleMapsLocationSchema.optional().describe(
    'Geographic coordinates'
  ),

  locatedIn: z.string().optional().describe('Located within another business'),

  totalScore: z.number().optional().describe('Average rating score'),

  permanentlyClosed: z
    .boolean()
    .optional()
    .describe('Whether permanently closed'),

  temporarilyClosed: z
    .boolean()
    .optional()
    .describe('Whether temporarily closed'),

  placeId: z.string().optional().describe('Google Maps place ID'),

  categories: z.array(z.string()).optional().describe('Place categories'),

  fid: z.string().optional().describe('Feature ID'),

  cid: z.string().optional().describe('Customer ID'),

  reviewsCount: z
    .number()
    .nullable()
    .optional()
    .describe('Total number of reviews'),

  reviewsDistribution: GoogleMapsReviewsDistributionSchema.optional().describe(
    'Distribution of reviews by star rating'
  ),

  imagesCount: z.number().optional().describe('Number of images'),

  imageCategories: z.array(z.string()).optional().describe('Image categories'),

  scrapedAt: z.string().optional().describe('When data was scraped'),

  googleFoodUrl: z.string().nullable().optional().describe('Google Food URL'),

  hotelAds: z.array(z.unknown()).optional().describe('Hotel advertisements'),

  openingHours: z
    .array(GoogleMapsOpeningHoursSchema)
    .optional()
    .describe('Opening hours by day'),

  additionalOpeningHours:
    GoogleMapsAdditionalOpeningHoursSchema.optional().describe(
      'Additional opening hours for specific services'
    ),

  peopleAlsoSearch: z
    .array(z.string())
    .optional()
    .describe('Related search suggestions'),

  placesTags: z.array(z.string()).optional().describe('Place tags'),

  reviewsTags: z.array(z.string()).optional().describe('Review tags'),

  additionalInfo: GoogleMapsAdditionalInfoSchema.optional().describe(
    'Additional place attributes and amenities'
  ),

  gasPrices: z
    .array(z.unknown())
    .optional()
    .describe('Gas prices if applicable'),

  url: z.string().optional().describe('Google Maps URL'),

  searchPageUrl: z.string().optional().describe('Search page URL'),

  searchString: z.string().optional().describe('Original search string'),

  language: z.string().optional().describe('Language of the results'),

  rank: z.number().optional().describe('Rank in search results'),

  isAdvertisement: z
    .boolean()
    .optional()
    .describe('Whether this is a sponsored result'),

  imageUrl: z.string().optional().describe('Primary image URL'),

  kgmid: z.string().optional().describe('Knowledge Graph machine ID'),
});

export type GoogleMapsScraperInput = z.output<
  typeof GoogleMapsScraperInputSchema
>;
export type GoogleMapsPlace = z.output<typeof GoogleMapsPlaceSchema>;
