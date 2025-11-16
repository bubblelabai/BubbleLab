import { CredentialType } from '@bubblelab/shared-schemas';

/**
 * Pricing configuration for all services
 * Maps service keys (in format "service:subService:unit" or "service:unit") to pricing information
 *
 * Key format matches BubbleLogger.getServiceUsageKey():
 * - For services without subService: "SERVICE:unit"
 * - For services with subService: "SERVICE:subService:unit"
 *
 * unitCost is in dollars per unit (stored as high precision float in DB)
 * unit describes the billing unit (e.g., "input_tokens", "output_tokens", "per_email", "per_result")
 *
 * For token-based services, unitCost is per token (not per 1M tokens).
 * To convert from per-1M-tokens pricing: divide by 1,000,000
 */
export type PricingTable = Record<string, { unit: string; unitCost: number }>;

/**
 * Helper function to construct pricing key in the same format as BubbleLogger.getServiceUsageKey()
 * Format: "service:subService:unit" or "service:unit" if no subService
 */
function getPricingKey(
  service: string,
  subService?: string,
  unit: string = 'per_1m_tokens'
): string {
  return `${service}${subService ? `:${subService}` : ''}:${unit}`;
}

/**
 * Global pricing table with hardcoded cost data for all services
 *
 * Pricing is based on Bubble Lab's markup over provider costs (1.05x multiplier).
 * Keys use the format: "service:subService:unit" matching BubbleLogger.getServiceUsageKey()
 *
 * Update these values as pricing changes.
 */
export const PRICING_TABLE: PricingTable = {
  // Web Scraping Services
  [getPricingKey(CredentialType.FIRECRAWL_API_KEY, undefined, 'per_result')]: {
    unit: 'per_result',
    unitCost: 0.00087, // $0.00087 per result (was $83/month for 100k tokens, pro-rated with 1.05x markup)
  },

  // Communication Services
  [getPricingKey(CredentialType.RESEND_CRED, undefined, 'per_email')]: {
    unit: 'per_email',
    unitCost: 0.00042, // $0.00042 per email (was $20/month for 50k emails, pro-rated with 1.05x markup)
  },

  // Scraping Services - Apify with subServices
  [getPricingKey(
    CredentialType.APIFY_CRED,
    'apimaestro/linkedin-profile-posts',
    'per_result'
  )]: {
    unit: 'per_result',
    unitCost: 0.00525, // $0.00525 per result ($5 for 1000 results with 1.05x markup)
  },
  [getPricingKey(
    CredentialType.APIFY_CRED,
    'apimaestro/linkedin-posts-search-scraper-no-cookies',
    'per_result'
  )]: {
    unit: 'per_result',
    unitCost: 0.00525, // $0.00525 per result ($5 for 1000 results with 1.05x markup)
  },
  [getPricingKey(
    CredentialType.APIFY_CRED,
    'apify/instagram-scraper',
    'per_result'
  )]: {
    unit: 'per_result',
    unitCost: 0.00284, // $0.00284 per result ($2.70 for 1000 results with 1.05x markup)
  },
  [getPricingKey(
    CredentialType.APIFY_CRED,
    'apify/instagram-hashtag-scraper',
    'per_result'
  )]: {
    unit: 'per_result',
    unitCost: 0.00242, // $0.00242 per result ($2.30 for 1000 results with 1.05x markup)
  },
  [getPricingKey(
    CredentialType.APIFY_CRED,
    'streamers/youtube-scraper',
    'per_result'
  )]: {
    unit: 'per_result',
    unitCost: 0.00525, // $0.00525 per result ($5.00 for 1000 results with 1.05x markup)
  },
  [getPricingKey(
    CredentialType.APIFY_CRED,
    'pintostudio/youtube-transcript-scraper',
    'per_result'
  )]: {
    unit: 'per_result',
    unitCost: 0.00525, // $0.00525 per result ($5.00 for 1000 results with 1.05x markup)
  },

  // AI Services - Google Gemini with subServices and Input/Output tokens
  // Note: Prices are per 1M tokens, but we store per token (divide by 1,000,000)
  [getPricingKey(
    CredentialType.GOOGLE_GEMINI_CRED,
    'google/gemini-2.5-pro',
    'input_tokens'
  )]: {
    unit: 'input_tokens',
    unitCost: 1.969 / 1_000_000, // $1.969 per 1M tokens = $0.000001969 per token
  },
  [getPricingKey(
    CredentialType.GOOGLE_GEMINI_CRED,
    'google/gemini-2.5-pro',
    'output_tokens'
  )]: {
    unit: 'output_tokens',
    unitCost: 13.13 / 1_000_000, // $13.13 per 1M tokens = $0.00001313 per token
  },
  [getPricingKey(
    CredentialType.GOOGLE_GEMINI_CRED,
    'google/gemini-2.5-flash',
    'input_tokens'
  )]: {
    unit: 'input_tokens',
    unitCost: 0.32 / 1_000_000, // $0.32 per 1M tokens = $0.00000032 per token
  },
  [getPricingKey(
    CredentialType.GOOGLE_GEMINI_CRED,
    'google/gemini-2.5-flash',
    'output_tokens'
  )]: {
    unit: 'output_tokens',
    unitCost: 2.63 / 1_000_000, // $2.63 per 1M tokens = $0.00000263 per token
  },
  [getPricingKey(
    CredentialType.GOOGLE_GEMINI_CRED,
    'google/gemini-2.5-flash-lite',
    'input_tokens'
  )]: {
    unit: 'input_tokens',
    unitCost: 0.11 / 1_000_000, // $0.11 per 1M tokens = $0.00000011 per token
  },
  [getPricingKey(
    CredentialType.GOOGLE_GEMINI_CRED,
    'google/gemini-2.5-flash-lite',
    'output_tokens'
  )]: {
    unit: 'output_tokens',
    unitCost: 0.42 / 1_000_000, // $0.42 per 1M tokens = $0.00000042 per token
  },
  [getPricingKey(
    CredentialType.GOOGLE_GEMINI_CRED,
    'google/gemini-2.5-flash-image-preview',
    'input_tokens'
  )]: {
    unit: 'input_tokens',
    unitCost: 0.32 / 1_000_000, // $0.32 per 1M tokens = $0.00000032 per token
  },
  [getPricingKey(
    CredentialType.GOOGLE_GEMINI_CRED,
    'google/gemini-2.5-flash-image-preview',
    'output_tokens'
  )]: {
    unit: 'output_tokens',
    unitCost: 2.63 / 1_000_000, // $2.63 per 1M tokens = $0.00000263 per token
  },

  // Legacy entries for services without subService (fallback pricing)
  // These may be used if subService is not provided
  [getPricingKey(CredentialType.OPENAI_CRED, undefined, 'per_1m_tokens')]: {
    unit: 'per_1m_tokens',
    unitCost: 2.1, // $2.10 per 1M tokens (placeholder - needs model-specific pricing)
  },
  [getPricingKey(CredentialType.ANTHROPIC_CRED, undefined, 'per_1m_tokens')]: {
    unit: 'per_1m_tokens',
    unitCost: 3.0, // $3.00 per 1M tokens (placeholder - needs model-specific pricing)
  },
  [getPricingKey(CredentialType.OPENROUTER_CRED, undefined, 'per_1m_tokens')]: {
    unit: 'per_1m_tokens',
    unitCost: 2.5, // $2.50 per 1M tokens (varies by model - needs model-specific pricing)
  },

  // Database Services
  [getPricingKey(CredentialType.DATABASE_CRED, undefined, 'per_query')]: {
    unit: 'per_query',
    unitCost: 0.001, // $0.001 per query
  },

  // Communication Services
  [getPricingKey(CredentialType.SLACK_CRED, undefined, 'per_message')]: {
    unit: 'per_message',
    unitCost: 0.0001, // $0.0001 per message
  },

  // Storage Services
  [getPricingKey(CredentialType.CLOUDFLARE_R2_ACCESS_KEY, undefined, 'per_gb')]:
    {
      unit: 'per_gb',
      unitCost: 0.015, // $0.015 per GB stored
    },
  [getPricingKey(CredentialType.CLOUDFLARE_R2_SECRET_KEY, undefined, 'per_gb')]:
    {
      unit: 'per_gb',
      unitCost: 0.015, // $0.015 per GB stored
    },
  [getPricingKey(CredentialType.CLOUDFLARE_R2_ACCOUNT_ID, undefined, 'per_gb')]:
    {
      unit: 'per_gb',
      unitCost: 0.015, // $0.015 per GB stored
    },

  // OAuth Services (typically free or low cost)
  [getPricingKey(CredentialType.GOOGLE_DRIVE_CRED, undefined, 'per_api_call')]:
    {
      unit: 'per_api_call',
      unitCost: 0.0001, // $0.0001 per API call
    },
  [getPricingKey(CredentialType.GMAIL_CRED, undefined, 'per_email')]: {
    unit: 'per_email',
    unitCost: 0.001, // $0.001 per email operation
  },
  [getPricingKey(CredentialType.GOOGLE_SHEETS_CRED, undefined, 'per_api_call')]:
    {
      unit: 'per_api_call',
      unitCost: 0.0001, // $0.0001 per API call
    },
  [getPricingKey(
    CredentialType.GOOGLE_CALENDAR_CRED,
    undefined,
    'per_api_call'
  )]: {
    unit: 'per_api_call',
    unitCost: 0.0001, // $0.0001 per API call
  },

  // Development Platform Services
  [getPricingKey(CredentialType.GITHUB_TOKEN, undefined, 'per_api_call')]: {
    unit: 'per_api_call',
    unitCost: 0.0, // Free (GitHub API is free)
  },
};

/**
 * Get the pricing table
 * This is the single source of truth for pricing data
 */
export function getPricingTable(): PricingTable {
  return PRICING_TABLE;
}
