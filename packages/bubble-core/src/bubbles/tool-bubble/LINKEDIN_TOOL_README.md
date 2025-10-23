# LinkedIn Tool - Implementation Summary

## Overview

The LinkedIn Tool is a new tool bubble that enables scraping LinkedIn profile posts using the Apify actor `apimaestro/linkedin-profile-posts`. It follows the same architecture pattern as the Instagram Tool.

## Architecture

### Two-Layer Design

1. **Service Layer**: `ApifyBubble` - Generic Apify API integration
2. **Tool Layer**: `LinkedInTool` - Domain-specific LinkedIn interface

### Key Features

- ✅ Scrape posts from any LinkedIn profile
- ✅ Get complete post metadata (text, engagement stats, media)
- ✅ Support for all post types (regular, quotes, articles, documents, reshared)
- ✅ Pagination support
- ✅ Clean, typed output with camelCase field names
- ✅ Automatic credential injection (APIFY_CRED)

## Files Created/Modified

### New Files

1. **`src/bubbles/service-bubble/apify/actors/linkedin-profile-posts.ts`**
   - Zod schemas for LinkedIn actor input/output
   - Type definitions for posts, authors, stats, media, etc.

2. **`src/bubbles/tool-bubble/linkedin-tool.ts`**
   - Main tool implementation
   - Transforms raw Apify data to clean, typed format
   - Handles errors and provides user-friendly responses

3. **`manual-tests/test-linkedin-tool.ts`**
   - Manual test for LinkedIn tool with real API
   - Can be run with: `APIFY_API_TOKEN=xxx pnpm exec tsx manual-tests/test-linkedin-tool.ts`

4. **`manual-tests/test-linkedin-tool-factory.ts`**
   - Tests BubbleFactory integration
   - Validates registration and metadata

### Modified Files

1. **`src/bubbles/service-bubble/apify/apify-scraper.schema.ts`**
   - Added LinkedIn actor to APIFY_ACTOR_SCHEMAS registry

2. **`src/bubble-factory.ts`**
   - Imported LinkedInTool
   - Registered in `registerDefaults()`
   - Added to `listBubblesForCodeGenerator()`
   - Added to boilerplate template

3. **`src/index.ts`**
   - Exported LinkedInTool class and types

4. **`packages/bubble-shared-schemas/src/types.ts`**
   - Added `'linkedin-tool'` to BubbleName union type

5. **`packages/bubble-shared-schemas/src/credential-schema.ts`**
   - Added linkedin-tool to BUBBLE_CREDENTIAL_OPTIONS

## Usage Example

```typescript
import { LinkedInTool } from '@bubblelab/bubble-core';
import { CredentialType } from '@bubblelab/shared-schemas';

// Create the tool
const linkedinTool = new LinkedInTool({
  operation: 'scrapePosts',
  username: 'satyanadella',
  limit: 20,
  credentials: {
    [CredentialType.APIFY_CRED]: 'your-apify-token',
  },
});

// Execute and get results
const result = await linkedinTool.action();

if (result.data.success) {
  console.log(`Total posts: ${result.data.totalPosts}`);

  result.data.posts.forEach((post) => {
    console.log(`- ${post.text?.substring(0, 100)}...`);
    console.log(`  Reactions: ${post.stats?.totalReactions}`);
    console.log(`  Comments: ${post.stats?.comments}`);
    console.log(`  Author: ${post.author?.firstName} ${post.author?.lastName}`);
  });
}
```

## Via BubbleFactory

```typescript
import { BubbleFactory } from '@bubblelab/bubble-core';

const factory = new BubbleFactory();
await factory.registerDefaults();

const linkedinTool = factory.createBubble('linkedin-tool', {
  operation: 'scrapePosts',
  username: 'billgates',
  limit: 10,
});

const result = await linkedinTool.action();
```

## Data Structure

### Input Schema

```typescript
{
  operation: 'scrapePosts',
  username: string,           // LinkedIn username (without @)
  limit?: number,             // Max posts to fetch (default: 100)
  pageNumber?: number,        // Page number for pagination (default: 1)
  credentials?: Record<...>   // Auto-injected APIFY_CRED
}
```

### Output Schema

```typescript
{
  operation: 'scrapePosts',
  posts: LinkedInPost[],      // Array of posts
  totalPosts: number,         // Count of posts returned
  username: string,           // Username that was scraped
  paginationToken: string | null,  // Token for next page
  success: boolean,           // Whether operation succeeded
  error: string               // Error message if failed
}
```

### Post Structure

Each `LinkedInPost` includes:

- `urn`, `fullUrn`, `url` - Post identifiers
- `text` - Post text content
- `postType` - Type (regular, quote, etc.)
- `postedAt` - Timestamp information
- `author` - Author details (name, headline, profile URL, picture)
- `stats` - Engagement metrics (likes, comments, reposts, all reaction types)
- `media` - Media content (images, videos)
- `article` - Shared article information
- `document` - Shared document information
- `resharedPost` - Original post for quote posts

## Testing

### Build Verification

```bash
pnpm --filter @bubblelab/bubble-core run build
```

### Manual Tests

```bash
# Basic instantiation test (no API token needed)
pnpm exec tsx manual-tests/test-linkedin-tool.ts

# Factory integration test
pnpm exec tsx manual-tests/test-linkedin-tool-factory.ts

# Full integration test with real API
APIFY_API_TOKEN=your_token pnpm exec tsx manual-tests/test-linkedin-tool.ts
```

## Verification Checklist

- ✅ All files created and modified
- ✅ Types compile without errors
- ✅ Build succeeds (shared-schemas and bubble-core)
- ✅ No linter errors
- ✅ Tool registered in BubbleFactory (35 total bubbles)
- ✅ Tool available in code generator list
- ✅ Schema validation works
- ✅ Tool can be instantiated via factory
- ✅ Metadata correctly exposed
- ✅ Manual tests pass

## Integration Complete

The LinkedIn tool is now fully integrated and ready to use! It follows the same pattern as the Instagram tool and provides a clean, type-safe interface for scraping LinkedIn profile posts via Apify.
