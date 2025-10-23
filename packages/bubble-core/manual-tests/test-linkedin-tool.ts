/**
 * Comprehensive LinkedIn Tool Test
 *
 * This test covers:
 * 1. Basic tool instantiation (no API token needed)
 * 2. Factory registration verification
 * 3. Full integration test with real Apify API
 *
 * Usage:
 *   # Basic tests (no API token needed)
 *   pnpm exec tsx manual-tests/test-linkedin-tool.ts
 *
 *   # Full integration test (requires API token)
 *   APIFY_API_TOKEN=your_token pnpm exec tsx manual-tests/test-linkedin-tool.ts
 *
 *   # Test specific profile
 *   APIFY_API_TOKEN=your_token LINKEDIN_USERNAME=username pnpm exec tsx manual-tests/test-linkedin-tool.ts
 */

import { LinkedInTool } from '../src/bubbles/tool-bubble/linkedin-tool.js';
import { BubbleFactory } from '../src/bubble-factory.js';
import { CredentialType } from '@bubblelab/shared-schemas';

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const BLUE = '\x1b[36m';
const RESET = '\x1b[0m';

function log(message: string, color: string = RESET) {
  console.log(`${color}${message}${RESET}`);
}

async function testBasicInstantiation() {
  log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', BLUE);
  log('TEST 1: Basic Tool Instantiation', BLUE);
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n', BLUE);

  try {
    const tool = new LinkedInTool({
      operation: 'scrapePosts',
      username: 'test-user',
      limit: 10,
    });

    log(`✅ Tool instantiated successfully`, GREEN);
    log(`   - Tool name: ${LinkedInTool.bubbleName}`);
    log(`   - Tool alias: ${LinkedInTool.alias}`);
    log(`   - Tool type: ${LinkedInTool.type}`);
    log(
      `   - Short description: ${LinkedInTool.shortDescription.substring(0, 80)}...`
    );

    // Test schema validation
    const schema = (tool.constructor as any).schema;
    const parsed = schema.parse({
      operation: 'scrapePosts',
      username: 'test-user',
      limit: 50,
    });

    log(`✅ Schema validation passed`, GREEN);
    log(`   - Operation: ${parsed.operation}`);
    log(`   - Username: ${parsed.username}`);
    log(`   - Limit: ${parsed.limit}`);

    return true;
  } catch (error) {
    log(`❌ Basic instantiation test failed: ${error}`, RED);
    return false;
  }
}

async function testFactoryRegistration() {
  log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', BLUE);
  log('TEST 2: Factory Registration', BLUE);
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n', BLUE);

  try {
    const factory = new BubbleFactory();
    await factory.registerDefaults();

    // Check if linkedin-tool is registered
    const allBubbles = factory.list();
    const hasLinkedInTool = allBubbles.includes('linkedin-tool');

    if (!hasLinkedInTool) {
      log(`❌ LinkedIn tool not found in registry!`, RED);
      return false;
    }

    log(`✅ LinkedIn tool registered in factory`, GREEN);
    log(`   - Total bubbles: ${allBubbles.length}`);

    // Check if it's in the code generator list
    const codeGenBubbles = factory.listBubblesForCodeGenerator();
    const inCodeGen = codeGenBubbles.includes('linkedin-tool');

    if (!inCodeGen) {
      log(`❌ LinkedIn tool not in code generator list!`, RED);
      return false;
    }

    log(`✅ LinkedIn tool in code generator list`, GREEN);

    // Test metadata retrieval
    const metadata = factory.getMetadata('linkedin-tool');
    log(`✅ Metadata retrieved`, GREEN);
    log(`   - Name: ${metadata?.name}`);
    log(`   - Type: ${metadata?.type}`);
    log(`   - Alias: ${metadata?.alias}`);

    // Test bubble creation via factory
    const linkedinTool = factory.createBubble('linkedin-tool', {
      operation: 'scrapePosts',
      username: 'test-user',
      limit: 10,
    });

    log(`✅ Created instance via factory`, GREEN);
    log(`   - Instance type: ${linkedinTool.constructor.name}`);

    return true;
  } catch (error) {
    log(`❌ Factory registration test failed: ${error}`, RED);
    return false;
  }
}

async function testFullIntegration(apiToken: string, username: string) {
  log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', BLUE);
  log('TEST 3: Full Integration with Apify API', BLUE);
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n', BLUE);

  log(`🚀 Scraping LinkedIn profile: ${username}`);
  log(`⏳ This may take 1-3 minutes...\n`);

  try {
    const tool = new LinkedInTool({
      operation: 'scrapePosts',
      username,
      limit: 10,
      credentials: {
        [CredentialType.APIFY_CRED]: apiToken,
      },
    });

    const startTime = Date.now();
    const result = await tool.action();
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    log(`⏱️  Completed in ${duration}s\n`, BLUE);

    if (result.data.success) {
      log(`✅ Successfully scraped LinkedIn profile!`, GREEN);
      log(`\n📊 Results Summary:`);
      log(`   - Username: ${result.data.username}`);
      log(`   - Total posts: ${result.data.totalPosts}`);
      log(
        `   - Pagination token: ${result.data.paginationToken ? 'Yes' : 'No'}`
      );

      if (result.data.posts.length === 0) {
        log(`\n⚠️  No posts found for this profile`, YELLOW);
        log(`   This could mean:`);
        log(`   - The profile has no public posts`);
        log(`   - The profile is private`);
        log(`   - The username is incorrect`);
      } else {
        log(`\n📝 Sample posts (showing first 3):\n`, BLUE);

        const samplesToShow = Math.min(3, result.data.posts.length);
        for (let i = 0; i < samplesToShow; i++) {
          const post = result.data.posts[i];
          log(`Post ${i + 1}:`, BLUE);
          log(`   - Posted: ${post.postedAt?.relative || 'N/A'}`);

          if (post.text) {
            const preview =
              post.text.length > 100
                ? post.text.substring(0, 100) + '...'
                : post.text;
            log(`   - Text: ${preview}`);
          }

          if (post.author) {
            log(
              `   - Author: ${post.author.firstName || ''} ${post.author.lastName || ''}`
            );
          }

          if (post.stats) {
            log(
              `   - Reactions: ${post.stats.totalReactions || 0} | Comments: ${post.stats.comments || 0}`
            );
          }

          if (post.media) {
            log(`   - Media: ${post.media.type || 'N/A'}`);
          }

          log('');
        }

        if (result.data.totalPosts > samplesToShow) {
          log(
            `   ... and ${result.data.totalPosts - samplesToShow} more posts\n`
          );
        }
      }

      return true;
    } else {
      log(`❌ Scraping failed: ${result.data.error}`, RED);
      log(`\n🔍 Troubleshooting tips:`, YELLOW);
      log(`   - Verify username is correct: ${username}`);
      log(`   - Check if the profile is public`);
      log(`   - Ensure APIFY_API_TOKEN is valid`);
      return false;
    }
  } catch (error) {
    log(
      `❌ Integration test error: ${error instanceof Error ? error.message : error}`,
      RED
    );
    return false;
  }
}

async function runAllTests() {
  log('\n╔══════════════════════════════════════════════════════╗', BLUE);
  log('║       LinkedIn Tool - Comprehensive Test Suite      ║', BLUE);
  log('╚══════════════════════════════════════════════════════╝', BLUE);

  const results: { name: string; passed: boolean }[] = [];

  // Test 1: Basic instantiation
  const test1 = await testBasicInstantiation();
  results.push({ name: 'Basic Instantiation', passed: test1 });

  // Test 2: Factory registration
  const test2 = await testFactoryRegistration();
  results.push({ name: 'Factory Registration', passed: test2 });

  // Test 3: Full integration (only if API token is available)
  const apiToken = process.env.APIFY_API_TOKEN;
  const username = process.env.LINKEDIN_USERNAME || 'selina-li-2624a4198';

  if (apiToken && !apiToken.startsWith('test-')) {
    const test3 = await testFullIntegration(apiToken, username);
    results.push({ name: 'Full Integration', passed: test3 });
  } else {
    log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', YELLOW);
    log('TEST 3: Skipped (No API Token)', YELLOW);
    log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n', YELLOW);
    log(`⚠️  Set APIFY_API_TOKEN to run full integration test`, YELLOW);
    log(
      `   Usage: APIFY_API_TOKEN=token pnpm exec tsx manual-tests/test-linkedin-tool.ts\n`,
      YELLOW
    );
  }

  // Summary
  log('\n╔══════════════════════════════════════════════════════╗', BLUE);
  log('║                   Test Summary                       ║', BLUE);
  log('╚══════════════════════════════════════════════════════╝\n', BLUE);

  const passed = results.filter((r) => r.passed).length;
  const total = results.length;

  results.forEach((result) => {
    const status = result.passed ? '✅ PASSED' : '❌ FAILED';
    const color = result.passed ? GREEN : RED;
    log(`${status} - ${result.name}`, color);
  });

  log('');
  if (passed === total) {
    log(`🎉 All ${total} tests passed!`, GREEN);
  } else {
    log(`⚠️  ${passed}/${total} tests passed`, YELLOW);
  }
  log('');

  return passed === total;
}

// Run the test suite
runAllTests()
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    log(`\n❌ Unhandled error: ${error}`, RED);
    process.exit(1);
  });
