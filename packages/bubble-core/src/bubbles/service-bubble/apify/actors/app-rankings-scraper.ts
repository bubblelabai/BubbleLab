import { z } from 'zod';

const APPLE_COUNTRIES = [
  'us',
  'gb',
  'ca',
  'au',
  'de',
  'fr',
  'jp',
  'kr',
  'cn',
  'in',
  'br',
  'mx',
  'es',
  'it',
  'nl',
  'se',
  'no',
  'dk',
  'fi',
  'pl',
  'ru',
  'tr',
  'sa',
  'ae',
  'za',
  'eg',
  'ng',
  'ke',
  'id',
  'th',
  'vn',
  'ph',
  'my',
  'sg',
  'tw',
  'hk',
  'nz',
  'at',
  'be',
  'ch',
  'cz',
  'hu',
  'ro',
  'bg',
  'hr',
  'sk',
  'si',
  'pt',
  'gr',
  'ie',
  'il',
  'ar',
  'cl',
  'co',
  'pe',
  'uy',
  'ec',
  'cr',
  'pa',
  'do',
] as const;

const APPLE_CATEGORIES = [
  'overall',
  '6000',
  '6001',
  '6002',
  '6003',
  '6004',
  '6005',
  '6006',
  '6007',
  '6008',
  '6009',
  '6010',
  '6011',
  '6012',
  '6013',
  '6014',
  '6015',
  '6016',
  '6017',
  '6018',
  '6020',
  '6023',
  '6024',
  '6025',
  '6026',
  '6027',
] as const;

const APPLE_CHART_TYPES = [
  'topfreeapplications',
  'toppaidapplications',
  'topgrossingapplications',
] as const;

const GOOGLE_CATEGORIES = [
  'APPLICATION',
  'GAME',
  'ART_AND_DESIGN',
  'AUTO_AND_VEHICLES',
  'BEAUTY',
  'BOOKS_AND_REFERENCE',
  'BUSINESS',
  'COMICS',
  'COMMUNICATION',
  'DATING',
  'EDUCATION',
  'ENTERTAINMENT',
  'EVENTS',
  'FINANCE',
  'FOOD_AND_DRINK',
  'HEALTH_AND_FITNESS',
  'HOUSE_AND_HOME',
  'LIBRARIES_AND_DEMO',
  'LIFESTYLE',
  'MAPS_AND_NAVIGATION',
  'MEDICAL',
  'MUSIC_AND_AUDIO',
  'NEWS_AND_MAGAZINES',
  'PARENTING',
  'PERSONALIZATION',
  'PHOTOGRAPHY',
  'PRODUCTIVITY',
  'SHOPPING',
  'SOCIAL',
  'SPORTS',
  'TOOLS',
  'TRAVEL_AND_LOCAL',
  'VIDEO_PLAYERS',
  'WEATHER',
] as const;

const GOOGLE_CHART_TYPES = [
  'topselling_free',
  'topselling_paid',
  'topgrossing',
] as const;

export const AppRankingsScraperInputSchema = z.object({
  stores: z
    .array(z.enum(['apple', 'google']))
    .min(1)
    .default(['apple', 'google'])
    .describe('App stores to scrape. Both stores supported in a single run.'),

  appleCountries: z
    .array(z.enum(APPLE_COUNTRIES))
    .default(['us'])
    .optional()
    .describe(
      'ISO country codes for Apple App Store (e.g., ["us", "jp", "de"])'
    ),

  appleCategories: z
    .array(z.enum(APPLE_CATEGORIES))
    .default(['overall'])
    .optional()
    .describe(
      'Apple category IDs. "overall" = all apps. Numeric IDs: 6014=Games, 6015=Finance, 6013=Health & Fitness, etc.'
    ),

  appleChartTypes: z
    .array(z.enum(APPLE_CHART_TYPES))
    .default(['topfreeapplications'])
    .optional()
    .describe(
      'Apple chart types: topfreeapplications, toppaidapplications, topgrossingapplications'
    ),

  googleCountries: z
    .array(z.enum(APPLE_COUNTRIES))
    .default(['us'])
    .optional()
    .describe('ISO country codes for Google Play Store'),

  googleCategories: z
    .array(z.enum(GOOGLE_CATEGORIES))
    .default(['APPLICATION'])
    .optional()
    .describe(
      'Google Play category IDs. "APPLICATION" = overall. Examples: GAME, FINANCE, HEALTH_AND_FITNESS'
    ),

  googleChartTypes: z
    .array(z.enum(GOOGLE_CHART_TYPES))
    .default(['topselling_free'])
    .optional()
    .describe(
      'Google chart types: topselling_free, topselling_paid, topgrossing'
    ),

  limit: z
    .number()
    .min(1)
    .max(100)
    .default(100)
    .optional()
    .describe('Number of apps per chart (1-100, default: 100)'),
});

export const AppRankingsItemSchema = z.object({
  store: z
    .enum(['apple', 'google'])
    .describe('Which app store this ranking is from'),

  appId: z.string().describe('Unique app identifier (bundle ID or store ID)'),

  rank: z.number().describe('Chart position (1-indexed)'),

  iconUrl: z.string().describe('App icon image URL'),

  appName: z.string().describe('App display name'),

  appUrl: z.string().describe('Direct link to store listing'),

  rating: z
    .union([z.number(), z.string()])
    .describe('Average user rating (number) or "Not enough reviews yet"'),

  ratingCount: z
    .union([z.number(), z.string()])
    .describe('Total ratings count (number) or "Rating count not available"'),

  price: z.string().describe('Price display string ("Free" for free apps)'),

  developer: z.string().describe('Developer or publisher name'),

  category: z
    .string()
    .describe('Human-readable category name (e.g., "Overall", "Games")'),

  chartType: z
    .string()
    .describe('Normalized chart type (e.g., "top-free", "top-paid")'),

  genres: z.string().describe('Comma-separated genre tags'),

  country: z.string().describe('ISO 3166-1 alpha-2 country code'),

  releaseDate: z
    .string()
    .describe('Original release date or "Release date not available"'),

  scrapedAt: z
    .string()
    .describe('UTC timestamp (ISO 8601) of when data was scraped'),
});

export type AppRankingsScraperInput = z.output<
  typeof AppRankingsScraperInputSchema
>;
export type AppRankingsItem = z.output<typeof AppRankingsItemSchema>;
