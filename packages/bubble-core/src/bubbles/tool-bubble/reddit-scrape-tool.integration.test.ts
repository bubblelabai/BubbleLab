/**
 * Integration tests for RedditScrapeTool
 * Tests against real Reddit API without mocking
 */

import { RedditScrapeTool } from './reddit-scrape-tool.js';
import { BubbleFactory } from '../../bubble-factory.js';
import { RedditScrapeToolResult } from './reddit-scrape-tool.js';

describe('RedditScrapeTool Integration Tests', () => {
  describe('Basic Functionality', () => {
    it('should scrape posts from r/test subreddit', async () => {
      const tool = new RedditScrapeTool({
        subreddit: 'test',
        limit: 5,
        sort: 'hot',
      });

      const result = await tool.action();

      expect(result.success).toBe(true);
      expect(result.error).toBe('');
      expect(result.data.posts).toBeDefined();
      expect(Array.isArray(result.data.posts)).toBe(true);
      expect(result.data.metadata.subreddit).toBe('test');
      expect(result.data.metadata.sort).toBe('hot');
      expect(result.data.metadata.requestedLimit).toBe(5);

      // Verify post structure if posts exist
      if (result.data.posts.length > 0) {
        const post = result.data.posts[0];

        expect(typeof post.title).toBe('string');
        expect(typeof post.author).toBe('string');
        expect(typeof post.score).toBe('number');
        expect(typeof post.numComments).toBe('number');
        expect(typeof post.createdUtc).toBe('number');
        expect(typeof post.postUrl).toBe('string');
        expect(typeof post.selftext).toBe('string');
        expect(typeof post.isSelf).toBe('boolean');
        expect(post.subreddit).toBe('test');

        // Verify permalink format
        expect(post.postUrl).toMatch(
          /^https:\/\/reddit\.com\/r\/test\/comments\//
        );

        // Verify timestamp is reasonable (not in the future, not too old)
        const postDate = new Date(post.createdUtc * 1000);
        const now = new Date();
        const fiveYearsAgo = new Date(
          now.getFullYear() - 5,
          now.getMonth(),
          now.getDate()
        );

        expect(postDate).toBeInstanceOf(Date);
        expect(postDate.getTime()).toBeLessThanOrEqual(now.getTime());
        expect(postDate.getTime()).toBeGreaterThan(fiveYearsAgo.getTime());
      }
    });

    it('should handle different sorting options', async () => {
      const sortOptions = ['hot', 'new', 'top', 'rising'] as const;

      for (const sort of sortOptions) {
        const tool = new RedditScrapeTool({
          subreddit: 'programming',
          limit: 3,
          sort,
        });

        const result = await tool.action();

        expect(result.success).toBe(true);
        expect(result.data.metadata.sort).toBe(sort);

        // For 'top' sort, we can also test with time filters
        if (sort === 'top') {
          const toolWithTimeFilter = new RedditScrapeTool({
            subreddit: 'programming',
            limit: 3,
            sort: 'top',
            timeFilter: 'week',
          });

          const resultWithFilter = await toolWithTimeFilter.action();
          expect(resultWithFilter.success).toBe(true);
          expect(resultWithFilter.data.metadata.timeFilter).toBe('week');
        }
      }
    }, 30000); // Extended timeout for multiple API calls

    it('should respect post limits', async () => {
      const limits = [1, 5, 10, 25];

      for (const limit of limits) {
        const tool = new RedditScrapeTool({
          subreddit: 'news',
          limit,
          sort: 'hot',
        });

        const result = await tool.action();

        expect(result.success).toBe(true);
        expect(result.data.posts.length).toBeLessThanOrEqual(limit);
        expect(result.data.metadata.requestedLimit).toBe(limit);
      }
    }, 20000);

    it('should filter posts by minimum score', async () => {
      const tool = new RedditScrapeTool({
        subreddit: 'programming',
        limit: 10,
        sort: 'top',
        timeFilter: 'week',
        minScore: 100,
      });

      const result = await tool.action();

      expect(result.success).toBe(true);

      // All posts should have score >= 100
      result.data.posts.forEach((post) => {
        expect(post.score).toBeGreaterThanOrEqual(100);
      });
    });

    it("should filter to today's posts when requested", async () => {
      const tool = new RedditScrapeTool({
        subreddit: 'news',
        limit: 50,
        sort: 'new',
        filterToday: true,
      });

      const result = await tool.action();
      console.log(result);

      expect(result.success).toBe(true);

      // All posts should be from today
      const today = new Date();
      const todayStart =
        new Date(
          today.getFullYear(),
          today.getMonth(),
          today.getDate()
        ).getTime() / 1000;

      result.data.posts.forEach((post) => {
        expect(post.createdUtc).toBeGreaterThanOrEqual(todayStart);
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid subreddit gracefully', async () => {
      const tool = new RedditScrapeTool({
        subreddit: 'this_subreddit_absolutely_does_not_exist_12345',
        limit: 5,
      });

      const result = await tool.action();

      // Should return error but not throw
      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
      expect(result.data.posts).toEqual([]);
      expect(result.data.metadata.actualCount).toBe(0);
    });

    it('should validate subreddit name format', () => {
      // Test invalid characters
      expect(
        () =>
          new RedditScrapeTool({
            subreddit: 'invalid-name',
            limit: 5,
          })
      ).toThrow();

      expect(
        () =>
          new RedditScrapeTool({
            subreddit: 'invalid name',
            limit: 5,
          })
      ).toThrow();

      expect(
        () =>
          new RedditScrapeTool({
            subreddit: 'invalid.name',
            limit: 5,
          })
      ).toThrow();

      // Test empty name
      expect(
        () =>
          new RedditScrapeTool({
            subreddit: '',
            limit: 5,
          })
      ).toThrow();
    });

    it('should validate limit bounds', () => {
      // Test limit too low
      expect(
        () =>
          new RedditScrapeTool({
            subreddit: 'test',
            limit: 0,
          })
      ).toThrow();

      // Test limit too high
      expect(
        () =>
          new RedditScrapeTool({
            subreddit: 'test',
            limit: 999,
          })
      ).toThrow();
    });
  });

  describe('Schema Validation', () => {
    it('should have valid Zod schemas', () => {
      const tool = new RedditScrapeTool({
        subreddit: 'typescript',
        limit: 5,
      });

      // Check that schema is defined
      expect(RedditScrapeTool.schema).toBeDefined();
      expect(RedditScrapeTool.resultSchema).toBeDefined();

      // Validate default parameters
      const defaultParams = {
        subreddit: 'test',
        limit: 25,
        sort: 'hot' as const,
        filterToday: false,
        includeStickied: false,
      };

      const parsed = RedditScrapeTool.schema.safeParse(defaultParams);
      expect(parsed.success).toBe(true);
    });

    it('should apply default values correctly', () => {
      const tool = new RedditScrapeTool({
        subreddit: 'test',
        // Other parameters should get defaults
      });

      // @ts-expect-error - accessing private params for testing
      expect(tool.params.limit).toBe(25);
      // @ts-expect-error - accessing private params for testing
      expect(tool.params.sort).toBe('hot');
      // @ts-expect-error - accessing private params for testing
      expect(tool.params.filterToday).toBe(false);
      // @ts-expect-error - accessing private params for testing
      expect(tool.params.includeStickied).toBe(false);
    });
  });

  describe('BubbleFactory Integration', () => {
    it('should be registered in BubbleFactory', async () => {
      const factory = new BubbleFactory();
      await factory.registerDefaults();

      const bubbleNames = factory.list();
      expect(bubbleNames).toContain('reddit-scrape-tool');

      const bubbleClass = factory.get('reddit-scrape-tool');
      expect(bubbleClass).toBeDefined();
      expect(bubbleClass).toBe(RedditScrapeTool);
    });

    it('should be creatable through BubbleFactory', async () => {
      const factory = new BubbleFactory();
      await factory.registerDefaults();

      const bubble = factory.createBubble('reddit-scrape-tool', {
        subreddit: 'test',
        limit: 5,
      });

      expect(bubble).toBeInstanceOf(RedditScrapeTool);

      const result = (await bubble.action()) as RedditScrapeToolResult;
      expect(result.success).toBe(true);
    });

    it('should have correct static metadata', () => {
      expect(RedditScrapeTool.bubbleName).toBe('reddit-scrape-tool');
      expect(RedditScrapeTool.type).toBe('tool');
      expect(RedditScrapeTool.alias).toBe('reddit');
      expect(RedditScrapeTool.shortDescription).toBeTruthy();
      expect(RedditScrapeTool.longDescription).toBeTruthy();
    });
  });

  describe('AI Agent Tool Integration', () => {
    it('should provide toolAgent method for AI agents', async () => {
      expect(typeof RedditScrapeTool.toolAgent).toBe('function');

      const tool = RedditScrapeTool.toolAgent(
        {},
        {
          subreddit: 'test',
          limit: 3,
        }
      );

      expect(tool).toBeDefined();
      expect(typeof tool.name).toBe('string');
      expect(typeof tool.description).toBe('string');
      expect(tool.schema).toBeDefined();
      expect(typeof tool.func).toBe('function');

      // Test the tool function
      const result = await tool.func({
        subreddit: 'test',
        limit: 3,
        sort: 'hot',
      });

      expect(result).toBeDefined();
      // Result should be the actual data, not wrapped in BubbleResult
      if (typeof result === 'object' && result !== null && 'posts' in result) {
        expect(Array.isArray(result.posts)).toBe(true);
      }
    });
  });

  describe('Real-world Usage Scenarios', () => {
    it('should scrape r/n8n posts effectively', async () => {
      const tool = new RedditScrapeTool({
        subreddit: 'n8n',
        limit: 10,
        sort: 'hot',
      });

      const result = await tool.action();

      expect(result.success).toBe(true);
      expect(result.data.metadata.subreddit).toBe('n8n');

      // Should find some posts (r/n8n is active)
      expect(result.data.posts.length).toBeGreaterThan(0);

      // Posts should be relevant to n8n
      result.data.posts.forEach((post) => {
        expect(post.subreddit).toBe('n8n');
        // Post should have basic content
        expect(post.title.length).toBeGreaterThan(0);
      });
    });

    it('should handle large popular subreddits', async () => {
      const tool = new RedditScrapeTool({
        subreddit: 'programming',
        limit: 20,
        sort: 'hot',
        minScore: 10, // Filter for quality posts
      });

      const result = await tool.action();

      expect(result.success).toBe(true);
      expect(result.data.posts.length).toBeGreaterThan(0);

      // All posts should meet minimum score requirement
      result.data.posts.forEach((post) => {
        expect(post.score).toBeGreaterThanOrEqual(10);
      });
    });

    it('should provide comprehensive metadata', async () => {
      const tool = new RedditScrapeTool({
        subreddit: 'typescript',
        limit: 15,
        sort: 'top',
        timeFilter: 'day',
      });

      const result = await tool.action();

      expect(result.success).toBe(true);

      const metadata = result.data.metadata;
      expect(metadata.subreddit).toBe('typescript');
      expect(metadata.requestedLimit).toBe(15);
      expect(metadata.sort).toBe('top');
      expect(metadata.timeFilter).toBe('day');
      expect(metadata.scrapedAt).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/
      );
      expect(metadata.apiEndpoint).toMatch(
        /^https:\/\/www\.reddit\.com\/r\/typescript\/top\.json/
      );
      expect(typeof metadata.actualCount).toBe('number');
      expect(typeof metadata.filteredCount).toBe('number');
    });
  });

  describe('Performance and Reliability', () => {
    it('should complete requests within reasonable time', async () => {
      const startTime = Date.now();

      const tool = new RedditScrapeTool({
        subreddit: 'javascript',
        limit: 5,
        sort: 'hot',
      });

      const result = await tool.action();
      const duration = Date.now() - startTime;

      expect(result.success).toBe(true);
      expect(duration).toBeLessThan(10000); // Should complete within 10 seconds
    });

    it('should handle concurrent requests', async () => {
      const subreddits = ['javascript', 'python', 'golang', 'rust'];

      const promises = subreddits.map((subreddit) => {
        const tool = new RedditScrapeTool({
          subreddit,
          limit: 5,
          sort: 'hot',
        });
        return tool.action();
      });

      const results = await Promise.all(promises);

      results.forEach((result, index) => {
        expect(result.success).toBe(true);
        expect(result.data.metadata.subreddit).toBe(subreddits[index]);
      });
    }, 15000);
  });
});
