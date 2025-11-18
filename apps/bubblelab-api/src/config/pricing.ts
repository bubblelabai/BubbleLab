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
  // Web Scraping Services - Firecrawl with subServices
  [getPricingKey(CredentialType.FIRECRAWL_API_KEY, 'web-search', 'per_result')]:
    {
      unit: 'per_result',
      unitCost: 0.00087, // $0.00087 per result (was $83/month for 100k tokens, pro-rated with 1.05x markup)
    },
  [getPricingKey(CredentialType.FIRECRAWL_API_KEY, 'web-scrape', 'per_result')]:
    {
      unit: 'per_result',
      unitCost: 0.00087, // $0.00087 per result (was $83/month for 100k tokens, pro-rated with 1.05x markup)
    },
  [getPricingKey(CredentialType.FIRECRAWL_API_KEY, 'web-crawl', 'per_result')]:
    {
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
  [getPricingKey(
    CredentialType.GOOGLE_GEMINI_CRED,
    'google/gemini-3-pro-preview',
    'input_tokens'
  )]: {
    unit: 'input_tokens',
    unitCost: 2.0 / 1_000_000, // $2.00 per 1M tokens = $0.000002 per token (for prompts <= 200k tokens; $4.00 for prompts > 200k tokens)
  },
  [getPricingKey(
    CredentialType.GOOGLE_GEMINI_CRED,
    'google/gemini-3-pro-preview',
    'output_tokens'
  )]: {
    unit: 'output_tokens',
    unitCost: 12.0 / 1_000_000, // $12.00 per 1M tokens = $0.000012 per token (for prompts <= 200k tokens; $18.00 for prompts > 200k tokens, includes thinking tokens)
  },

  // AI Services - OpenAI with subServices and Input/Output tokens
  // Note: Prices are per 1M tokens, but we store per token (divide by 1,000,000)
  // Pricing includes 1.05x markup
  [getPricingKey(CredentialType.OPENAI_CRED, 'openai/gpt-5', 'input_tokens')]: {
    unit: 'input_tokens',
    unitCost: (1.25 * 1.05) / 1_000_000, // $1.25 per 1M tokens * 1.05 markup = $1.3125 per 1M tokens
  },
  [getPricingKey(CredentialType.OPENAI_CRED, 'openai/gpt-5', 'output_tokens')]:
    {
      unit: 'output_tokens',
      unitCost: (10.0 * 1.05) / 1_000_000, // $10.00 per 1M tokens * 1.05 markup = $10.50 per 1M tokens
    },
  [getPricingKey(
    CredentialType.OPENAI_CRED,
    'openai/gpt-5-mini',
    'input_tokens'
  )]: {
    unit: 'input_tokens',
    unitCost: (0.25 * 1.05) / 1_000_000, // $0.25 per 1M tokens * 1.05 markup = $0.2625 per 1M tokens
  },
  [getPricingKey(
    CredentialType.OPENAI_CRED,
    'openai/gpt-5-mini',
    'output_tokens'
  )]: {
    unit: 'output_tokens',
    unitCost: (2.0 * 1.05) / 1_000_000, // $2.00 per 1M tokens * 1.05 markup = $2.10 per 1M tokens
  },
  // GPT-5.1: Official pricing from OpenAI
  // Note: Cached input pricing is $0.125 / 1M tokens (not tracked separately)
  [getPricingKey(CredentialType.OPENAI_CRED, 'openai/gpt-5.1', 'input_tokens')]:
    {
      unit: 'input_tokens',
      unitCost: (1.25 * 1.05) / 1_000_000, // $1.25 per 1M tokens * 1.05 markup = $1.3125 per 1M tokens
    },
  [getPricingKey(
    CredentialType.OPENAI_CRED,
    'openai/gpt-5.1',
    'output_tokens'
  )]: {
    unit: 'output_tokens',
    unitCost: (10.0 * 1.05) / 1_000_000, // $10.00 per 1M tokens * 1.05 markup = $10.50 per 1M tokens
  },

  // AI Services - Anthropic with subServices and Input/Output tokens
  // Note: Prices are per 1M tokens, but we store per token (divide by 1,000,000)
  // Pricing includes 1.05x markup
  // Claude Sonnet 4.5: Official pricing from Anthropic
  // Note: Sonnet 4.5 has tiered pricing (≤ 200K tokens vs > 200K tokens). Using standard pricing (≤ 200K tokens) as base.
  // For prompts > 200K tokens: Input $6/MTok, Output $22.50/MTok
  [getPricingKey(
    CredentialType.ANTHROPIC_CRED,
    'anthropic/claude-sonnet-4-5',
    'input_tokens'
  )]: {
    unit: 'input_tokens',
    unitCost: (3.0 * 1.05) / 1_000_000, // $3.00 per 1M tokens * 1.05 markup = $3.15 per 1M tokens (for prompts ≤ 200K tokens)
  },
  [getPricingKey(
    CredentialType.ANTHROPIC_CRED,
    'anthropic/claude-sonnet-4-5',
    'output_tokens'
  )]: {
    unit: 'output_tokens',
    unitCost: (15.0 * 1.05) / 1_000_000, // $15.00 per 1M tokens * 1.05 markup = $15.75 per 1M tokens (for prompts ≤ 200K tokens)
  },
  // Claude Haiku 4.5: Official pricing from Anthropic
  [getPricingKey(
    CredentialType.ANTHROPIC_CRED,
    'anthropic/claude-haiku-4-5',
    'input_tokens'
  )]: {
    unit: 'input_tokens',
    unitCost: (1.0 * 1.05) / 1_000_000, // $1.00 per 1M tokens * 1.05 markup = $1.05 per 1M tokens
  },
  [getPricingKey(
    CredentialType.ANTHROPIC_CRED,
    'anthropic/claude-haiku-4-5',
    'output_tokens'
  )]: {
    unit: 'output_tokens',
    unitCost: (5.0 * 1.05) / 1_000_000, // $5.00 per 1M tokens * 1.05 markup = $5.25 per 1M tokens
  },

  // AI Services - OpenRouter with subServices and Input/Output tokens
  // Note: Prices are per 1M tokens, but we store per token (divide by 1,000,000)
  // Pricing includes 1.05x markup
  // z-ai/glm-4.6: Official pricing from OpenRouter
  [getPricingKey(
    CredentialType.OPENROUTER_CRED,
    'openrouter/z-ai/glm-4.6',
    'input_tokens'
  )]: {
    unit: 'input_tokens',
    unitCost: (0.55 * 1.05) / 1_000_000, // $0.55 per 1M tokens * 1.05 markup = $0.5775 per 1M tokens
  },
  [getPricingKey(
    CredentialType.OPENROUTER_CRED,
    'openrouter/z-ai/glm-4.6',
    'output_tokens'
  )]: {
    unit: 'output_tokens',
    unitCost: (2.19 * 1.05) / 1_000_000, // $2.19 per 1M tokens * 1.05 markup = $2.2995 per 1M tokens
  },
  // x-ai/grok-code-fast-1: Official pricing from OpenRouter
  // Note: Cache read pricing is $0.02 / 1M tokens (not tracked separately)
  [getPricingKey(
    CredentialType.OPENROUTER_CRED,
    'openrouter/x-ai/grok-code-fast-1',
    'input_tokens'
  )]: {
    unit: 'input_tokens',
    unitCost: (0.2 * 1.05) / 1_000_000, // $0.20 per 1M tokens * 1.05 markup = $0.21 per 1M tokens
  },
  [getPricingKey(
    CredentialType.OPENROUTER_CRED,
    'openrouter/x-ai/grok-code-fast-1',
    'output_tokens'
  )]: {
    unit: 'output_tokens',
    unitCost: (1.5 * 1.05) / 1_000_000, // $1.50 per 1M tokens * 1.05 markup = $1.575 per 1M tokens
  },
  // morph/morph-v3-large: Official pricing from OpenRouter
  [getPricingKey(
    CredentialType.OPENROUTER_CRED,
    'openrouter/morph/morph-v3-large',
    'input_tokens'
  )]: {
    unit: 'input_tokens',
    unitCost: (0.9 * 1.05) / 1_000_000, // $0.90 per 1M tokens * 1.05 markup = $0.945 per 1M tokens
  },
  [getPricingKey(
    CredentialType.OPENROUTER_CRED,
    'openrouter/morph/morph-v3-large',
    'output_tokens'
  )]: {
    unit: 'output_tokens',
    unitCost: (1.9 * 1.05) / 1_000_000, // $1.90 per 1M tokens * 1.05 markup = $1.995 per 1M tokens
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
};

/**
 * Get the pricing table
 * This is the single source of truth for pricing data
 */
export function getPricingTable(): PricingTable {
  return PRICING_TABLE;
}
