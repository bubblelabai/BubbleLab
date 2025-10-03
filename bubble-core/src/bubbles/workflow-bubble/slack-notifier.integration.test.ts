import dotenv from 'dotenv';
import path from 'path';
import { SlackNotifierWorkflowBubble } from './slack-notifier.workflow';

// Load environment variables from the package root
dotenv.config({ path: path.join(process.cwd(), '../../.env') });

describe('SlackNotifierWorkflowBubble Integration Tests', () => {
  describe('Full Slack notification pipeline integration', () => {
    test('should format content with AI and send notification to Slack without error', async () => {
      // Skip if no real Google API key is available
      if (
        !process.env.GOOGLE_API_KEY ||
        process.env.GOOGLE_API_KEY.startsWith('test-') ||
        process.env.GOOGLE_API_KEY.length < 10
      ) {
        console.log('⚠️  Skipping Gemini integration test - no real API key');
        return;
      }

      // Skip if no Slack token is available
      if (
        !process.env.SLACK_TOKEN ||
        process.env.SLACK_TOKEN.startsWith('xoxb-test-')
      ) {
        console.log('⚠️  Skipping Slack integration - no real Slack token');
        return;
      }

      // Simulate realistic SQL query results from a business analytics query
      const rawSqlQueryResult = {
        query:
          "SELECT DATE(created_at) as signup_date, COUNT(*) as daily_signups, AVG(subscription_value) as avg_value FROM users WHERE created_at >= NOW() - INTERVAL '30 days' GROUP BY DATE(created_at) ORDER BY signup_date",
        results: [
          { signup_date: '2024-01-15', daily_signups: 23, avg_value: 49.99 },
          { signup_date: '2024-01-16', daily_signups: 31, avg_value: 52.5 },
          { signup_date: '2024-01-17', daily_signups: 18, avg_value: 45.25 },
          { signup_date: '2024-01-18', daily_signups: 41, avg_value: 58.75 },
          { signup_date: '2024-01-19', daily_signups: 37, avg_value: 51.2 },
        ],
        execution_time_ms: 245,
        total_rows: 5,
      };

      const slackNotifierBubble = await new SlackNotifierWorkflowBubble({
        contentToFormat: JSON.stringify(rawSqlQueryResult, null, 2),
        originalUserQuery:
          'Show me daily signup trends and revenue patterns for the last 30 days',
        targetChannel: 'staging-bot',
        messageTitle: '📊 Daily Signup Analytics Report',
        messageStyle: 'professional',
        includeFormatting: true,
        credentials: {
          GOOGLE_GEMINI_CRED: process.env.GOOGLE_API_KEY,
          SLACK_CRED: process.env.SLACK_TOKEN,
        },
      }).action();

      // console.log('✅ Business analytics report sent to Slack');
      // console.log('📈 Transformed raw SQL data into actionable insights');
      // console.log('📝 Report details:', {
      //   channel: slackNotifierBubble.data?.messageInfo?.channelName,
      //   messageLength: slackNotifierBubble.data?.messageInfo?.messageLength,
      //   aiModel: slackNotifierBubble.data?.formattingInfo?.modelUsed,
      //   originalDataPoints: rawSqlQueryResult.total_rows
      // });

      // Verify the test completed successfully
      expect(slackNotifierBubble.success).toBe(true);
      expect(slackNotifierBubble.data?.messageInfo?.channelName).toBe(
        'staging-bot'
      );
      expect(
        slackNotifierBubble.data?.messageInfo?.messageTimestamp
      ).toBeDefined();
    }, 30000); // 30 second timeout for AI processing and Slack API calls
  });
});
