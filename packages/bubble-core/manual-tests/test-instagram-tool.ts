/**
 * Manual test for Instagram Tool (Generic, Service-Agnostic)
 *
 * This tool provides a simple, unified interface for Instagram scraping
 * regardless of the underlying service (currently Apify).
 *
 * Prerequisites:
 * 1. Add APIFY_API_TOKEN to your .env file
 *
 * Usage:
 * bun packages/bubble-core/manual-tests/test-instagram-tool.ts
 */

import { InstagramTool } from '../src/bubbles/tool-bubble/instagram-tool.js';
import { CredentialType } from '@bubblelab/shared-schemas';

async function testInstagramTool() {
  const apiToken = process.env.APIFY_API_TOKEN;

  if (!apiToken) {
    console.error('❌ APIFY_API_TOKEN not found in environment');
    process.exit(1);
  }

  console.log('🚀 Testing Instagram Tool (Service-Agnostic Interface)');
  console.log('='.repeat(60));

  // Test 1: Simple username scraping
  console.log('\n📊 Test 1: Scrape posts from username (simple interface)');
  const tool1 = new InstagramTool({
    profiles: ['@humansofny'], // Accepts @username format
    limit: 3,
    credentials: {
      [CredentialType.APIFY_CRED]: apiToken,
    },
  });

  console.log('⏳ Scraping...\n');
  const result1 = await tool1.action();

  console.log('Results:');
  console.log('- Success:', result1.data.success);
  console.log('- Total Posts:', result1.data.totalPosts);
  console.log('- Scraped Profiles:', result1.data.scrapedProfiles);

  if (result1.data.success && result1.data.posts.length > 0) {
    console.log('\n📸 Sample Post:');
    const post = result1.data.posts[0];
    console.log('  URL:', post.url);
    console.log('  Owner:', post.ownerUsername);
    console.log('  Type:', post.type);
    console.log('  Likes:', post.likesCount);
    console.log('  Comments:', post.commentsCount);
    console.log('  Caption:', post.caption?.substring(0, 80) + '...');
  }

  // Test 2: Multiple profiles (URL format)
  console.log('\n' + '='.repeat(60));
  console.log('\n📊 Test 2: Scrape multiple profiles (URL format)');
  const tool2 = new InstagramTool({
    profiles: [
      'https://www.instagram.com/humansofny/',
      'instagram.com', // Also accepts plain usernames
    ],
    limit: 2,
    credentials: {
      [CredentialType.APIFY_CRED]: apiToken,
    },
  });

  console.log('⏳ Scraping multiple profiles...\n');
  const result2 = await tool2.action();

  console.log('Results:');
  console.log('- Success:', result2.data.success);
  console.log('- Total Posts:', result2.data.totalPosts);
  console.log('- Scraped Profiles:', result2.data.scrapedProfiles.join(', '));

  if (result2.data.success) {
    const postsByOwner = result2.data.posts.reduce(
      (acc, post) => {
        const owner = post.ownerUsername || 'unknown';
        acc[owner] = (acc[owner] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    console.log('\n📊 Posts by Owner:');
    Object.entries(postsByOwner).forEach(([owner, count]) => {
      console.log(`  ${owner}: ${count} posts`);
    });
  }

  console.log('\n' + '='.repeat(60));
  console.log('✅ Tests completed!');
  console.log('\n💡 Key Features Demonstrated:');
  console.log('  ✓ Simple interface (just profiles + limit)');
  console.log('  ✓ Accepts @username, username, or full URLs');
  console.log('  ✓ Uniform data format regardless of service');
  console.log('  ✓ Service-agnostic (currently Apify, future: any service)');
}

testInstagramTool().catch((error) => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});
