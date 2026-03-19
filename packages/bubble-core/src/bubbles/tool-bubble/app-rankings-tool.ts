import { z } from 'zod';
import { ToolBubble } from '../../types/tool-bubble-class.js';
import type { BubbleContext } from '../../types/bubble.js';
import { CredentialType, type BubbleName } from '@bubblelab/shared-schemas';
import { ApifyBubble } from '../service-bubble/apify/apify.js';
import type { ActorOutput, ActorInput } from '../service-bubble/apify/types.js';

const AppRankingSchema = z.object({
  store: z
    .enum(['apple', 'google'])
    .describe('Which app store this ranking is from'),
  rank: z.number().describe('Chart position (1-indexed)'),
  appName: z.string().describe('App display name'),
  appId: z.string().describe('Unique app identifier'),
  appUrl: z.string().nullable().describe('Direct link to store listing'),
  developer: z.string().nullable().describe('Developer or publisher name'),
  rating: z
    .union([z.number(), z.string()])
    .nullable()
    .describe('Average user rating or "Not enough reviews yet"'),
  ratingCount: z
    .union([z.number(), z.string()])
    .nullable()
    .describe('Total ratings count'),
  price: z.string().nullable().describe('Price ("Free" for free apps)'),
  category: z.string().describe('Human-readable category name'),
  chartType: z.string().describe('Chart type (e.g., "top-free")'),
  genres: z.string().nullable().describe('Comma-separated genre tags'),
  country: z.string().describe('ISO country code'),
  releaseDate: z.string().nullable().describe('Original release date'),
  iconUrl: z.string().nullable().describe('App icon image URL'),
  scrapedAt: z.string().describe('When data was scraped (ISO 8601)'),
});

const AppRankingsToolParamsSchema = z.object({
  operation: z
    .enum(['rankings'])
    .describe('Operation (only rankings supported)'),

  stores: z
    .array(z.enum(['apple', 'google']))
    .min(1)
    .default(['apple', 'google'])
    .optional()
    .describe(
      "Array of stores to scrape: 'apple', 'google', or both. Default: ['apple', 'google']. Pass ['apple'] for App Store only."
    ),

  countries: z
    .array(z.string())
    .default(['us'])
    .optional()
    .describe(
      'Array of ISO 3166-1 alpha-2 country codes. Default: ["us"]. Example: ["us", "jp", "de"]'
    ),

  appleCategories: z
    .array(z.string())
    .default(['overall'])
    .optional()
    .describe(
      'Array of Apple category IDs. Use "overall" for all apps. Common IDs: "6014" (Games), "6015" (Finance), "6013" (Health & Fitness), "6020" (Medical), "6016" (Entertainment), "6005" (Social Networking), "6007" (Productivity), "6002" (Utilities), "6017" (Education), "6008" (Lifestyle). Default: ["overall"]'
    ),

  googleCategories: z
    .array(z.string())
    .default(['APPLICATION'])
    .optional()
    .describe(
      'Array of Google Play category IDs. Use "APPLICATION" for all apps. Common values: "GAME", "FINANCE", "HEALTH_AND_FITNESS", "MEDICAL", "ENTERTAINMENT", "SOCIAL", "PRODUCTIVITY", "TOOLS", "EDUCATION", "LIFESTYLE". Default: ["APPLICATION"]'
    ),

  chartType: z
    .enum(['free', 'paid', 'grossing'])
    .default('free')
    .optional()
    .describe(
      "Which chart to scrape. One of: 'free', 'paid', 'grossing'. Default: 'free'"
    ),

  limit: z
    .number()
    .min(1)
    .max(100)
    .default(100)
    .optional()
    .describe(
      'Number of apps to return per store/country/category combination (1-100, default: 100)'
    ),

  credentials: z
    .record(z.nativeEnum(CredentialType), z.string())
    .optional()
    .describe('Required credentials (auto-injected)'),
});

const AppRankingsToolResultSchema = z.object({
  operation: z.enum(['rankings']).describe('Operation performed'),
  rankings: z.array(AppRankingSchema).describe('App rankings'),
  totalApps: z.number().describe('Total apps returned'),
  success: z.boolean().describe('Whether the operation was successful'),
  error: z.string().describe('Error message if operation failed'),
});

type AppRankingsToolParams = z.output<typeof AppRankingsToolParamsSchema>;
type AppRankingsToolResult = z.output<typeof AppRankingsToolResultSchema>;
type AppRankingsToolParamsInput = z.input<typeof AppRankingsToolParamsSchema>;

const CHART_TYPE_MAP = {
  free: { apple: 'topfreeapplications', google: 'topselling_free' },
  paid: { apple: 'toppaidapplications', google: 'topselling_paid' },
  grossing: {
    apple: 'topgrossingapplications',
    google: 'topgrossing',
  },
} as const;

export class AppRankingsTool extends ToolBubble<
  AppRankingsToolParams,
  AppRankingsToolResult
> {
  static readonly bubbleName: BubbleName = 'app-rankings-tool';
  static readonly schema = AppRankingsToolParamsSchema;
  static readonly resultSchema = AppRankingsToolResultSchema;
  static readonly shortDescription =
    'Scrape Apple App Store and Google Play top free, paid, and grossing chart rankings across countries and categories.';
  static readonly longDescription = `
    App store rankings scraping tool for iOS and Android top charts.

    Operations:
    - rankings: Get top chart rankings (free, paid, or grossing) across 60+ countries and 50+ categories

    Supports both Apple App Store and Google Play Store in a single run.
    Returns up to \`limit\` apps per store/country/category combination as a flat array.
    Use the \`store\`, \`country\`, and \`category\` fields on each result to filter/group.

    Examples:
      // US top 10 free apps (both stores):
      { operation: 'rankings', limit: 10 }

      // Apple-only Games category, top 50:
      { operation: 'rankings', stores: ['apple'], appleCategories: ['6014'], limit: 50 }

      // Top grossing across US, JP, DE:
      { operation: 'rankings', chartType: 'grossing', countries: ['us', 'jp', 'de'] }

      // Multiple categories (Health & Medical):
      { operation: 'rankings', appleCategories: ['6013', '6020'], googleCategories: ['HEALTH_AND_FITNESS', 'MEDICAL'] }

    Apple Category IDs: overall, 6000 (Business), 6001 (Weather), 6002 (Utilities), 6003 (Travel),
      6004 (Sports), 6005 (Social Networking), 6006 (Reference), 6007 (Productivity), 6008 (Lifestyle),
      6009 (News), 6010 (Navigation), 6011 (Music), 6012 (Photo & Video), 6013 (Health & Fitness),
      6014 (Games), 6015 (Finance), 6016 (Entertainment), 6017 (Education), 6018 (Books),
      6020 (Medical), 6023 (Food & Drink), 6024 (Shopping), 6026 (Magazines & Newspapers)

    Google Play Categories: APPLICATION, GAME, ART_AND_DESIGN, AUTO_AND_VEHICLES, BEAUTY,
      BOOKS_AND_REFERENCE, BUSINESS, COMMUNICATION, DATING, EDUCATION, ENTERTAINMENT, EVENTS,
      FINANCE, FOOD_AND_DRINK, HEALTH_AND_FITNESS, LIFESTYLE, MAPS_AND_NAVIGATION, MEDICAL,
      MUSIC_AND_AUDIO, NEWS_AND_MAGAZINES, PHOTOGRAPHY, PRODUCTIVITY, SHOPPING, SOCIAL, SPORTS,
      TOOLS, TRAVEL_AND_LOCAL, VIDEO_PLAYERS, WEATHER

    Uses Apify's slothtechlabs/ios-android-app-rankings-scraper.
  `;
  static readonly alias = 'app-rankings';
  static readonly type = 'tool';

  constructor(
    params: AppRankingsToolParamsInput = {
      operation: 'rankings',
      stores: ['apple', 'google'],
      limit: 100,
    },
    context?: BubbleContext
  ) {
    super(params, context);
  }

  async performAction(): Promise<AppRankingsToolResult> {
    const credentials = this.params.credentials;
    if (!credentials || !credentials[CredentialType.APIFY_CRED]) {
      return this.createErrorResult(
        'App rankings scraping requires authentication. Please configure APIFY_CRED.'
      );
    }

    try {
      const result = await this.scrapeRankings();
      return {
        operation: 'rankings',
        rankings: result.rankings,
        totalApps: result.rankings.length,
        success: result.success,
        error: result.error,
      };
    } catch (error) {
      return this.createErrorResult(
        error instanceof Error ? error.message : 'Unknown error occurred'
      );
    }
  }

  private createErrorResult(errorMessage: string): AppRankingsToolResult {
    return {
      operation: 'rankings',
      rankings: [],
      totalApps: 0,
      success: false,
      error: errorMessage,
    };
  }

  private async scrapeRankings(): Promise<{
    rankings: z.infer<typeof AppRankingSchema>[];
    success: boolean;
    error: string;
  }> {
    const {
      stores = ['apple', 'google'],
      countries = ['us'],
      appleCategories = ['overall'],
      googleCategories = ['APPLICATION'],
      chartType = 'free',
      limit = 100,
    } = this.params;

    const chartMapping = CHART_TYPE_MAP[chartType];

    type RankingsInput =
      ActorInput<'slothtechlabs/ios-android-app-rankings-scraper'>;

    const input: RankingsInput = {
      stores: stores as RankingsInput['stores'],
      appleCountries: countries as RankingsInput['appleCountries'],
      appleCategories: appleCategories as RankingsInput['appleCategories'],
      appleChartTypes: [chartMapping.apple],
      googleCountries: countries as RankingsInput['googleCountries'],
      googleCategories: googleCategories as RankingsInput['googleCategories'],
      googleChartTypes: [chartMapping.google],
      limit,
    };

    const scraper =
      new ApifyBubble<'slothtechlabs/ios-android-app-rankings-scraper'>(
        {
          actorId: 'slothtechlabs/ios-android-app-rankings-scraper',
          input,
          waitForFinish: true,
          timeout: 300000,
          limit: stores.length * countries.length * limit,
          credentials: this.params.credentials,
        },
        this.context,
        'appRankingsScraper'
      );

    const apifyResult = await scraper.action();

    if (!apifyResult.data.success) {
      return {
        rankings: [],
        success: false,
        error: apifyResult.data.error || 'Failed to scrape app rankings',
      };
    }

    const items = apifyResult.data.items || [];
    const rankings = this.transformRankings(
      items as ActorOutput<'slothtechlabs/ios-android-app-rankings-scraper'>[]
    );

    return {
      rankings,
      success: true,
      error: '',
    };
  }

  private transformRankings(
    items: ActorOutput<'slothtechlabs/ios-android-app-rankings-scraper'>[]
  ): z.infer<typeof AppRankingSchema>[] {
    return items.map((item) => ({
      store: item.store,
      rank: item.rank,
      appName: item.appName,
      appId: item.appId,
      appUrl: item.appUrl || null,
      developer: item.developer || null,
      rating:
        typeof item.rating === 'number' || typeof item.rating === 'string'
          ? item.rating
          : null,
      ratingCount:
        typeof item.ratingCount === 'number' ||
        typeof item.ratingCount === 'string'
          ? item.ratingCount
          : null,
      price: item.price || null,
      category: item.category,
      chartType: item.chartType,
      genres: item.genres || null,
      country: item.country,
      releaseDate: item.releaseDate || null,
      iconUrl: item.iconUrl || null,
      scrapedAt: item.scrapedAt,
    }));
  }
}
