import {
  InstagramScraperInputSchema,
  InstagramScraperItemSchema,
} from './actors/instagram-scraper.js';
import {
  InstagramHashtagScraperInputSchema,
  InstagramHashtagScraperItemSchema,
} from './actors/instagram-hashtag-scraper.js';
import {
  LinkedInProfilePostsInputSchema,
  LinkedInProfilePostsOutputSchema,
} from './actors/linkedin-profile-posts.js';
import {
  LinkedInPostsSearchInputSchema,
  LinkedInPostsSearchOutputSchema,
} from './actors/linkedin-posts-search.js';
import {
  YouTubeScraperInputSchema,
  YouTubeVideoSchema,
} from './actors/youtube-scraper.js';
import {
  YouTubeTranscriptScraperInputSchema,
  YouTubeTranscriptResultSchema,
} from './actors/youtube-transcript-scraper.js';

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
  'apimaestro/linkedin-profile-posts': {
    input: LinkedInProfilePostsInputSchema,
    output: LinkedInProfilePostsOutputSchema,
    description: 'Scrape LinkedIn profile posts and activity',
    documentation: 'https://apify.com/apimaestro/linkedin-profile-posts',
    category: 'social-media',
  },
  'apimaestro/linkedin-posts-search-scraper-no-cookies': {
    input: LinkedInPostsSearchInputSchema,
    output: LinkedInPostsSearchOutputSchema,
    description: 'Search LinkedIn posts by keyword without login',
    documentation:
      'https://apify.com/apimaestro/linkedin-posts-search-scraper-no-cookies',
    category: 'social-media',
  },
  'streamers/youtube-scraper': {
    input: YouTubeScraperInputSchema,
    output: YouTubeVideoSchema,
    description: 'YouTube crawler and video scraper with no API limits',
    documentation: 'https://apify.com/streamers/youtube-scraper',
    category: 'social-media',
  },
  'pintostudio/youtube-transcript-scraper': {
    input: YouTubeTranscriptScraperInputSchema,
    output: YouTubeTranscriptResultSchema,
    description: 'Extract transcripts from YouTube videos with timestamps',
    documentation: 'https://apify.com/pintostudio/youtube-transcript-scraper',
    category: 'social-media',
  },
};
