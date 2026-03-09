import { describe, it, expect } from 'vitest';
import { SlackBubble } from './slack.js';
import { CredentialType } from '@bubblelab/shared-schemas';
import { BLOCKS, BATCH_BLOCKS } from './slack-table-blocks.js';

const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN;
const SLACK_CHANNEL = process.env.SLACK_REMINDER_CHANNEL;

const credentials = { [CredentialType.SLACK_CRED]: SLACK_BOT_TOKEN! };

async function runSlackTest(text: string) {
  const bubble = new SlackBubble({
    operation: 'send_message',
    channel: SLACK_CHANNEL!,
    text,
    credentials,
  });
  const result = await bubble.action();
  console.log('Result:', JSON.stringify(result, null, 2));
  return result;
}

describe('Slack table block integration', () => {
  it('should send message with user activity table', async () => {
    if (!SLACK_BOT_TOKEN || !SLACK_CHANNEL) {
      console.log(
        'Skipping: SLACK_BOT_TOKEN or SLACK_REMINDER_CHANNEL not set'
      );
      return;
    }
    const result = await runSlackTest(BLOCKS.userActivityTable);
    expect(result.success).toBe(true);
    expect(result.data?.ok).toBe(true);
    expect(result.data?.ts).toBeDefined();
  });

  it('should send message with recent users table and numbered list', async () => {
    if (!SLACK_BOT_TOKEN || !SLACK_CHANNEL) {
      console.log(
        'Skipping: SLACK_BOT_TOKEN or SLACK_REMINDER_CHANNEL not set'
      );
      return;
    }
    const result = await runSlackTest(BLOCKS.recentUsersNumberedList);
    expect(result.success).toBe(true);
    expect(result.data?.ok).toBe(true);
    expect(result.data?.ts).toBeDefined();
  });

  it('should send message with flow analysis table, chart URL, and markdown header', async () => {
    if (!SLACK_BOT_TOKEN || !SLACK_CHANNEL) {
      console.log(
        'Skipping: SLACK_BOT_TOKEN or SLACK_REMINDER_CHANNEL not set'
      );
      return;
    }
    const result = await runSlackTest(BLOCKS.flowAnalysisChartHeader);
    expect(result.success).toBe(true);
    expect(result.data?.ok).toBe(true);
    expect(result.data?.ts).toBeDefined();
  });

  it('should send message with schema table containing backtick-wrapped values', async () => {
    if (!SLACK_BOT_TOKEN || !SLACK_CHANNEL) {
      console.log(
        'Skipping: SLACK_BOT_TOKEN or SLACK_REMINDER_CHANNEL not set'
      );
      return;
    }
    const result = await runSlackTest(BLOCKS.schemaBackticks);
    expect(result.success).toBe(true);
    expect(result.data?.ok).toBe(true);
    expect(result.data?.ts).toBeDefined();
  });

  it('should send message with wide engagement matrix, emojis, dividers, and chart', async () => {
    if (!SLACK_BOT_TOKEN || !SLACK_CHANNEL) {
      console.log(
        'Skipping: SLACK_BOT_TOKEN or SLACK_REMINDER_CHANNEL not set'
      );
      return;
    }
    const result = await runSlackTest(BLOCKS.engagementMatrix);
    expect(result.success).toBe(true);
    expect(result.data?.ok).toBe(true);
    expect(result.data?.ts).toBeDefined();
  });

  it('should send message with multi-table status report, emojis, and dividers', async () => {
    if (!SLACK_BOT_TOKEN || !SLACK_CHANNEL) {
      console.log(
        'Skipping: SLACK_BOT_TOKEN or SLACK_REMINDER_CHANNEL not set'
      );
      return;
    }
    const result = await runSlackTest(BLOCKS.multiTableStatus);
    expect(result.success).toBe(true);
    expect(result.data?.ok).toBe(true);
    expect(result.data?.ts).toBeDefined();
  });

  it('should send message with calendar flow announcement', async () => {
    if (!SLACK_BOT_TOKEN || !SLACK_CHANNEL) {
      console.log(
        'Skipping: SLACK_BOT_TOKEN or SLACK_REMINDER_CHANNEL not set'
      );
      return;
    }
    const result = await runSlackTest(BLOCKS.calendarAnnouncement);
    expect(result.success).toBe(true);
    expect(result.data?.ok).toBe(true);
    expect(result.data?.ts).toBeDefined();
  });

  it('should send message with pricing comparison charts, table, and image URLs', async () => {
    if (!SLACK_BOT_TOKEN || !SLACK_CHANNEL) {
      console.log(
        'Skipping: SLACK_BOT_TOKEN or SLACK_REMINDER_CHANNEL not set'
      );
      return;
    }
    // Even if R2 presigned URLs expire, the retry logic strips broken image
    // blocks and resends — so the message should always succeed.
    const result = await runSlackTest(BLOCKS.pricingComparisonCharts);
    expect(result.success).toBe(true);
    expect(result.data?.ok).toBe(true);
    expect(result.data?.ts).toBeDefined();
  });

  it('should send message with DAU chart image and bullet-point highlights', async () => {
    if (!SLACK_BOT_TOKEN || !SLACK_CHANNEL) {
      console.log(
        'Skipping: SLACK_BOT_TOKEN or SLACK_REMINDER_CHANNEL not set'
      );
      return;
    }
    const result = await runSlackTest(BLOCKS.dauChartHighlights);
    expect(result.success).toBe(true);
    expect(result.data?.ok).toBe(true);
    expect(result.data?.ts).toBeDefined();
  });

  it('should send message with last 5 users in Slack mrkdwn format with mailto links', async () => {
    if (!SLACK_BOT_TOKEN || !SLACK_CHANNEL) {
      console.log(
        'Skipping: SLACK_BOT_TOKEN or SLACK_REMINDER_CHANNEL not set'
      );
      return;
    }
    const result = await runSlackTest(BLOCKS.last5UsersSlackFormat);
    expect(result.success).toBe(true);
    expect(result.data?.ok).toBe(true);
    expect(result.data?.ts).toBeDefined();
  });

  it('should send message with last 5 users plain email table', async () => {
    if (!SLACK_BOT_TOKEN || !SLACK_CHANNEL) {
      console.log(
        'Skipping: SLACK_BOT_TOKEN or SLACK_REMINDER_CHANNEL not set'
      );
      return;
    }
    const result = await runSlackTest(BLOCKS.last5UsersPlainEmail);
    expect(result.success).toBe(true);
    expect(result.data?.ok).toBe(true);
    expect(result.data?.ts).toBeDefined();
  });

  it('should send message with no-tool drive instructions (numbered list, code block, links)', async () => {
    if (!SLACK_BOT_TOKEN || !SLACK_CHANNEL) {
      console.log(
        'Skipping: SLACK_BOT_TOKEN or SLACK_REMINDER_CHANNEL not set'
      );
      return;
    }
    const result = await runSlackTest(BLOCKS.noToolDriveInstructions);
    expect(result.success).toBe(true);
    expect(result.data?.ok).toBe(true);
    expect(result.data?.ts).toBeDefined();
  });

  it('should send message with Sortly search results table', async () => {
    if (!SLACK_BOT_TOKEN || !SLACK_CHANNEL) {
      console.log(
        'Skipping: SLACK_BOT_TOKEN or SLACK_REMINDER_CHANNEL not set'
      );
      return;
    }
    const result = await runSlackTest(BLOCKS.sortlySearchResults);
    expect(result.success).toBe(true);
    expect(result.data?.ok).toBe(true);
    expect(result.data?.ts).toBeDefined();
  });

  it('should send message with Drive invoice folder table and links', async () => {
    if (!SLACK_BOT_TOKEN || !SLACK_CHANNEL) {
      console.log(
        'Skipping: SLACK_BOT_TOKEN or SLACK_REMINDER_CHANNEL not set'
      );
      return;
    }
    const result = await runSlackTest(BLOCKS.driveInvoiceFolder);
    expect(result.success).toBe(true);
    expect(result.data?.ok).toBe(true);
    expect(result.data?.ts).toBeDefined();
  });

  it('should send message with investor brief with schedule table, headings, and emojis', async () => {
    if (!SLACK_BOT_TOKEN || !SLACK_CHANNEL) {
      console.log(
        'Skipping: SLACK_BOT_TOKEN or SLACK_REMINDER_CHANNEL not set'
      );
      return;
    }
    const result = await runSlackTest(BLOCKS.investorBriefSchedule);
    expect(result.success).toBe(true);
    expect(result.data?.ok).toBe(true);
    expect(result.data?.ts).toBeDefined();
  });

  it('should replace a thinking placeholder with pricing comparison (delete + post)', async () => {
    if (!SLACK_BOT_TOKEN || !SLACK_CHANNEL) {
      console.log(
        'Skipping: SLACK_BOT_TOKEN or SLACK_REMINDER_CHANNEL not set'
      );
      return;
    }
    // Simulate prod: send thinking placeholder, then replace via executionMeta
    const placeholder = new SlackBubble({
      operation: 'send_message',
      channel: SLACK_CHANNEL!,
      text: ':hourglass: Thinking...',
      credentials,
    });
    const placeholderResult = await placeholder.action();
    expect(placeholderResult.success).toBe(true);
    const ts = placeholderResult.data?.ts;
    expect(ts).toBeDefined();

    // Now send the real message with executionMeta pointing to the placeholder
    const sender = new SlackBubble({
      operation: 'send_message',
      channel: SLACK_CHANNEL!,
      text: BLOCKS.pricingComparisonCharts,
      credentials,
    });
    const result = await sender.action({
      executionMeta: {
        _thinkingMessageTs: ts!,
        _thinkingMessageChannel: SLACK_CHANNEL!,
      },
    } as Parameters<typeof sender.action>[0]);
    console.log('Replace result:', JSON.stringify(result, null, 2));
    expect(result.success).toBe(true);
    expect(result.data?.ok).toBe(true);
  });

  it('should send all test messages at once', async () => {
    if (!SLACK_BOT_TOKEN || !SLACK_CHANNEL) {
      console.log(
        'Skipping: SLACK_BOT_TOKEN or SLACK_REMINDER_CHANNEL not set'
      );
      return;
    }

    const results = await Promise.all(
      BATCH_BLOCKS.map((text) =>
        new SlackBubble({
          operation: 'send_message',
          channel: SLACK_CHANNEL!,
          text,
          credentials,
        }).action()
      )
    );

    for (const result of results) {
      console.log(
        `Message ${results.indexOf(result) + 1}:`,
        result.success ? 'OK' : result.error
      );
      expect(result.success).toBe(true);
      expect(result.data?.ok).toBe(true);
    }
  });
});
