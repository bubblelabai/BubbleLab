import { z } from 'zod';
import type { BubbleName } from '@bubblelab/shared-schemas';

// Define available tool types that can be used in AI agents
// These should all be valid BubbleName values to ensure consistency
export const AvailableTools = z.enum([
  // Web tools
  'web-search-tool',
  'web-scrape-tool',
  'web-crawl-tool',
  'web-extract-tool',
  'research-agent-tool',
  'reddit-scrape-tool',
  // Social media tools
  'instagram-tool',
  // Existing bubble tools (for reference - these are handled by bubble names)
  'list-bubbles-tool',
  'get-bubble-details-tool',
  'get-trigger-detail-tool',
  'bubbleflow-validation-tool',
  'code-edit-tool',
  'chart-js-tool',
  'amazon-shopping-tool',
  'linkedin-tool',
  'tiktok-tool',
  'twitter-tool',
  'google-maps-tool',
  'youtube-tool',
  'people-search-tool',
  'sql-query-tool',
] as const satisfies readonly BubbleName[]);

export type AvailableTool = z.infer<typeof AvailableTools>;
