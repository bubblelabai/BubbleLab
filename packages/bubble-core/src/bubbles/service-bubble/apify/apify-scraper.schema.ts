import {
  InstagramScraperInputSchema,
  InstagramScraperItemSchema,
} from './actors/instagram-scraper.js';
import {
  InstagramHashtagScraperInputSchema,
  InstagramHashtagScraperItemSchema,
} from './actors/instagram-hashtag-scraper.js';

// ============================================================================
// ACTOR REGISTRY
// ============================================================================
export const APIFY_ACTOR_SCHEMAS = {
  'apify/instagram-scraper': {
    input: InstagramScraperInputSchema,
    output: InstagramScraperItemSchema,
    description: 'Scrape Instagram profiles, posts, stories, and highlights',
    documentation:
      'https://docs.apify.com/platform/actors/apify/instagram-scraper',
    category: 'social-media',
  },
  'apify/instagram-hashtag-scraper': {
    input: InstagramHashtagScraperInputSchema,
    output: InstagramHashtagScraperItemSchema,
    description: 'Scrape Instagram posts by hashtag',
    documentation: 'https://apify.com/apify/instagram-hashtag-scraper',
    category: 'social-media',
  },
};
