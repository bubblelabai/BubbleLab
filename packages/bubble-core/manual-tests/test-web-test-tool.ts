/**
 * Manual test for WebTestTool - Advanced web testing with browser automation and screenshots
 *
 * This demonstrates the comprehensive capabilities of the web-test-tool:
 * - Browser automation with actions (click, write, scroll, etc.)
 * - Screenshot capture (full page and viewport)
 * - Structured data extraction with JSON schemas
 * - Multiple content formats (markdown, HTML, links)
 * - Advanced options (include/exclude tags, timeouts, etc.)
 *
 * To run this test:
 * 1. Set FIRE_CRAWL_API_KEY environment variable
 * 2. Run: npx tsx packages/bubble-core/manual-tests/test-web-test-tool.ts
 */

import { WebTestTool } from '../src/bubbles/tool-bubble/web-test-tool.js';
import { BubbleContext } from '../src/types/bubble.js';
import * as fs from 'fs';
import * as path from 'path';

// Helper to save screenshot to file
function saveScreenshot(base64Data: string, filename: string) {
  const outputDir = path.join(process.cwd(), 'test-output');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  const filepath = path.join(outputDir, filename);
  const buffer = Buffer.from(base64Data, 'base64');
  fs.writeFileSync(filepath, buffer);
  console.log(`Screenshot saved to: ${filepath}`);
}

async function runTests() {
  const apiKey = process.env.FIRE_CRAWL_API_KEY;
  if (!apiKey) {
    console.error('❌ FIRE_CRAWL_API_KEY environment variable is not set');
    console.log('Please set it with: export FIRE_CRAWL_API_KEY=your-api-key');
    process.exit(1);
  }

  const context: BubbleContext = {
    executionId: 'test-web-test-tool',
    userId: 'test-user',
  } as BubbleContext;

  console.log('🚀 Starting WebTestTool Manual Tests\n');
  console.log('='.repeat(80));

  // Test 1: Basic scraping with screenshot
  console.log('\n📝 Test 1: Basic Scraping with Screenshot');
  console.log('-'.repeat(80));
  try {
    const test1 = new WebTestTool(
      {
        url: 'https://example.com',
        formats: [
          'markdown',
          {
            type: 'screenshot',
            fullPage: true,
            quality: 85,
          },
        ],
        credentials: {
          FIRECRAWL_API_KEY: apiKey,
        },
      },
      context
    );

    const result1 = await test1.action();
    console.log('✅ Success:', result1.data?.success);
    console.log('📄 Markdown length:', result1.data?.markdown?.length);
    console.log('📸 Screenshot captured:', !!result1.data?.screenshot);

    if (result1.data?.screenshot) {
      saveScreenshot(result1.data.screenshot.base64, 'example-com-full.png');
    }
  } catch (error) {
    console.error('❌ Test 1 failed:', error);
  }

  // Test 2: Browser automation - Cookie acceptance and scroll
  console.log('\n📝 Test 2: Browser Automation - Cookie Banner & Scroll');
  console.log('-'.repeat(80));
  try {
    const test2 = new WebTestTool(
      {
        url: 'https://news.ycombinator.com',
        actions: [
          { type: 'wait', milliseconds: 1000 },
          { type: 'scroll', direction: 'down' },
          { type: 'wait', milliseconds: 500 },
        ],
        formats: [
          'markdown',
          {
            type: 'screenshot',
            fullPage: false,
            quality: 90,
          },
        ],
        credentials: {
          FIRECRAWL_API_KEY: apiKey,
        },
      },
      context
    );

    const result2 = await test2.action();
    console.log('✅ Success:', result2.data?.success);
    console.log(
      '🎬 Actions performed:',
      result2.data?.metadata?.actionsPerformed
    );
    console.log(
      '⏱️  Execution time:',
      result2.data?.metadata?.executionTime,
      'ms'
    );

    if (result2.data?.screenshot) {
      saveScreenshot(result2.data.screenshot.base64, 'hackernews-viewport.png');
    }
  } catch (error) {
    console.error('❌ Test 2 failed:', error);
  }

  // Test 3: Form interaction simulation
  console.log('\n📝 Test 3: Form Interaction Simulation');
  console.log('-'.repeat(80));
  try {
    const test3 = new WebTestTool(
      {
        url: 'https://httpbin.org/forms/post',
        actions: [
          { type: 'wait', milliseconds: 500 },
          {
            type: 'write',
            selector: 'input[name="custname"]',
            text: 'John Doe',
          },
          {
            type: 'write',
            selector: 'input[name="custtel"]',
            text: '555-1234',
          },
          {
            type: 'write',
            selector: 'input[name="custemail"]',
            text: 'john@example.com',
          },
          { type: 'click', selector: 'input[value="small"]' },
          { type: 'wait', milliseconds: 500 },
        ],
        formats: [
          'markdown',
          {
            type: 'screenshot',
            fullPage: true,
          },
        ],
        credentials: {
          FIRECRAWL_API_KEY: apiKey,
        },
      },
      context
    );

    const result3 = await test3.action();
    console.log('✅ Success:', result3.data?.success);
    console.log(
      '🎬 Actions performed:',
      result3.data?.metadata?.actionsPerformed
    );
    console.log(
      '📄 Content preview:',
      result3.data?.markdown?.substring(0, 200)
    );

    if (result3.data?.screenshot) {
      saveScreenshot(result3.data.screenshot.base64, 'form-filled.png');
    }
  } catch (error) {
    console.error('❌ Test 3 failed:', error);
  }

  // Test 4: Multiple formats extraction
  console.log('\n📝 Test 4: Multiple Formats Extraction');
  console.log('-'.repeat(80));
  try {
    const test4 = new WebTestTool(
      {
        url: 'https://example.com',
        formats: ['markdown', 'html', 'rawHtml', 'links'],
        onlyMainContent: false,
        credentials: {
          FIRECRAWL_API_KEY: apiKey,
        },
      },
      context
    );

    const result4 = await test4.action();
    console.log('✅ Success:', result4.data?.success);
    console.log('📄 Markdown:', !!result4.data?.markdown);
    console.log('🏷️  HTML:', !!result4.data?.html);
    console.log('📝 Raw HTML:', !!result4.data?.rawHtml);
    console.log('🔗 Links found:', result4.data?.links?.length || 0);
    console.log('🔗 First few links:', result4.data?.links?.slice(0, 3));
  } catch (error) {
    console.error('❌ Test 4 failed:', error);
  }

  // Test 5: Advanced filtering with include/exclude tags
  console.log('\n📝 Test 5: Advanced Filtering (Include/Exclude Tags)');
  console.log('-'.repeat(80));
  try {
    const test5 = new WebTestTool(
      {
        url: 'https://example.com',
        formats: ['markdown'],
        includeTags: ['h1', 'p', 'a'],
        excludeTags: ['nav', 'footer', '#sidebar'],
        onlyMainContent: true,
        credentials: {
          FIRECRAWL_API_KEY: apiKey,
        },
      },
      context
    );

    const result5 = await test5.action();
    console.log('✅ Success:', result5.data?.success);
    console.log('📄 Filtered content length:', result5.data?.markdown?.length);
    console.log(
      '📄 Content preview:',
      result5.data?.markdown?.substring(0, 300)
    );
  } catch (error) {
    console.error('❌ Test 5 failed:', error);
  }

  // Test 6: Execute JavaScript before scraping
  console.log('\n📝 Test 6: Execute Custom JavaScript');
  console.log('-'.repeat(80));
  try {
    const test6 = new WebTestTool(
      {
        url: 'https://example.com',
        actions: [
          {
            type: 'executeJavascript',
            script: `
              const banner = document.createElement('div');
              banner.id = 'test-banner';
              banner.textContent = 'This was added by JavaScript!';
              banner.style.cssText = 'background: yellow; padding: 20px; font-size: 24px;';
              document.body.insertBefore(banner, document.body.firstChild);
            `,
          },
          { type: 'wait', milliseconds: 500 },
        ],
        formats: [
          'markdown',
          {
            type: 'screenshot',
            fullPage: false,
          },
        ],
        credentials: {
          FIRECRAWL_API_KEY: apiKey,
        },
      },
      context
    );

    const result6 = await test6.action();
    console.log('✅ Success:', result6.data?.success);
    console.log('🎬 JavaScript executed');

    if (result6.data?.screenshot) {
      saveScreenshot(result6.data.screenshot.base64, 'javascript-modified.png');
    }
  } catch (error) {
    console.error('❌ Test 6 failed:', error);
  }

  // Test 7: Comprehensive E2E test with all features
  console.log('\n📝 Test 7: Comprehensive E2E Test (All Features)');
  console.log('-'.repeat(80));
  try {
    const test7 = new WebTestTool(
      {
        url: 'https://httpbin.org',
        actions: [
          { type: 'wait', milliseconds: 1000 },
          { type: 'scroll', direction: 'down' },
          { type: 'wait', milliseconds: 500 },
        ],
        formats: [
          'markdown',
          'links',
          {
            type: 'screenshot',
            fullPage: true,
            quality: 95,
          },
        ],
        onlyMainContent: true,
        waitFor: 500,
        timeout: 30000,
        credentials: {
          FIRECRAWL_API_KEY: apiKey,
        },
      },
      context
    );

    const result7 = await test7.action();
    console.log('✅ Success:', result7.data?.success);
    console.log(
      '🎬 Actions performed:',
      result7.data?.metadata?.actionsPerformed
    );
    console.log(
      '⏱️  Total execution time:',
      result7.data?.metadata?.executionTime,
      'ms'
    );
    console.log('📊 Page title:', result7.data?.metadata?.title);
    console.log('📄 Markdown length:', result7.data?.markdown?.length);
    console.log('🔗 Links found:', result7.data?.links?.length);
    console.log('💰 Credits used:', result7.data?.creditsUsed);

    if (result7.data?.screenshot) {
      saveScreenshot(result7.data.screenshot.base64, 'comprehensive-test.png');
    }
  } catch (error) {
    console.error('❌ Test 7 failed:', error);
  }

  console.log('\n' + '='.repeat(80));
  console.log('✅ All tests completed!');
  console.log('📁 Screenshots saved to: ./test-output/');
  console.log('='.repeat(80));
}

// Run the tests
runTests().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
