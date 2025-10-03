import type { BubbleTriggerEventRegistry } from '@bubblelab/bubble-core';
import {
  DatabaseAnalyzerWorkflowBubble,
  DataAnalystWorkflow,
  SlackNotifierWorkflowBubble,
} from '@bubblelab/bubble-core';
import { CredentialType } from '@bubblelab/shared-schemas';
import './setup.ts';

/**
 * Test the DataAnalystFlow with proper credential injection
 *
 * This test simulates production by:
 * 1. Creating bubbles with credentials in the constructor parameters
 * 2. Executing them in sequence as the flow would
 *
 * Run with: bun run manual-tests/test-data-analyst-flow-with-creds.ts
 */

async function testDataAnalystFlowWithCredentials() {
  console.log('🧪 TESTING DATA ANALYST FLOW WITH CREDENTIALS');
  console.log('='.repeat(60));

  // The production Slack event payload
  const slackEvent: BubbleTriggerEventRegistry['slack/bot_mentioned'] = {
    type: 'slack/bot_mentioned',
    timestamp: '2025-07-28T22:05:37.026Z',
    path: '/webhook/1/slack-analysis',
    body: {},
    slack_event: {
      token: 'test-token',
      team_id: 'T07UVUG5ZNY',
      api_app_id: 'A08H7A3BHS5',
      event: {
        user: 'U07UTL8MA9Y',
        type: 'app_mention',
        ts: '1753740266.783209',
        event_ts: '1753740266.783209',
        text: '<@U08GXBRKML2> Who is the user of the month?',
        channel: 'C08J0L09PT6',
      },
      type: 'event_callback',
      event_id: 'Ev098A3TEY73',
      event_time: 1753740266,
      authorizations: [
        {
          team_id: 'T07UVUG5ZNY',
          user_id: 'U08GXBRKML2',
          is_bot: true,
        },
      ],
      event_context: 'test-context',
    },
    channel: 'C08J0L09PT6',
    user: 'U07UTL8MA9Y',
    text: '<@U08GXBRKML2> How is the company doing?',
  };

  // Extract the question
  const userQuestion = slackEvent.text.replace(/<@[^>]+>/g, '').trim();
  console.log('📦 User question:', userQuestion);

  if (!userQuestion) {
    console.error('❌ No question provided');
    return;
  }

  try {
    // Step 1: Analyze database schema (with credentials)
    console.log('\n🔍 Step 1: Analyzing database schema...');
    const databaseAnalyzer = new DatabaseAnalyzerWorkflowBubble({
      dataSourceType: 'postgresql',
      ignoreSSLErrors: true,
      includeMetadata: true,
      credentials: {
        [CredentialType.DATABASE_CRED]:
          process.env.BUBBLE_CONNECTING_STRING_URL!,
      },
    });

    const schemaResult = await databaseAnalyzer.action();

    if (!schemaResult.success) {
      console.error('❌ Schema analysis failed:', schemaResult.error);
      return;
    }

    const schema = schemaResult.data?.databaseSchema;
    const schemaContext = schema?.cleanedJSON
      ? `TABLES:${schema.cleanedJSON}`
      : '';

    console.log('✅ Schema analysis succeeded!');
    console.log(`📊 Found ${schema?.tableCount} tables`);
    console.log(`📄 Schema context: ${schemaContext.length} chars`);

    // Step 2: Run AI-powered analysis (with credentials)
    console.log('\n🔍 Step 2: Running AI analysis...');
    const dataAnalyst = new DataAnalystWorkflow({
      userQuestion,
      dataSourceType: 'postgresql',
      analysisDepth: 'comprehensive',
      targetAudience: 'business',
      aiPersonality: 'analytical',
      includeInsights: true,
      maxQueries: 20,
      queryTimeout: 30000,
      ignoreSSLErrors: true,

      additionalContext: schemaContext,
      aiModel: {
        model: 'google/gemini-2.5-flash',
        temperature: 0.3,
        maxTokens: 50000,
      },
      credentials: {
        [CredentialType.GOOGLE_GEMINI_CRED]: process.env.GOOGLE_API_KEY!,
        [CredentialType.DATABASE_CRED]:
          process.env.BUBBLE_CONNECTING_STRING_URL!,
      },
    });

    const result = await dataAnalyst.action();

    if (!result.success) {
      console.error('❌ Data analysis failed:', result.error);
      return;
    }

    console.log('✅ Data analysis succeeded!');
    console.log('🎯 Direct answer:', result.data?.directAnswer);
    console.log('💡 Insights:', result.data?.insights?.length || 0);
    console.log(
      '📋 Recommendations:',
      result.data?.recommendations?.length || 0
    );

    // Step 3: Send results to Slack (with credentials)
    console.log('\n🔍 Step 3: Sending to Slack...');
    const analysisContent = {
      question: userQuestion,
      answer: result.data?.directAnswer || 'No answer found',
      insights: result.data?.insights?.slice(0, 3) || [],
      recommendations: result.data?.recommendations?.slice(0, 2) || [],
    };

    const slackNotification = await new SlackNotifierWorkflowBubble({
      contentToFormat: JSON.stringify(analysisContent, null, 2),
      originalUserQuery: userQuestion,
      targetChannel: slackEvent.channel,
      messageTitle: '📊 Analysis Results',
      messageStyle: 'concise',
      includeFormatting: true,
      maxMessageLength: 2000,
      aiModel: {
        model: 'google/gemini-2.5-flash',
        temperature: 0.5,
        maxTokens: 50000,
      },
      credentials: {
        [CredentialType.GOOGLE_GEMINI_CRED]: process.env.GOOGLE_API_KEY!,
        [CredentialType.SLACK_CRED]:
          process.env.SLACK_TOKEN || 'test-slack-token',
      },
    });

    const slackResult = await slackNotification.action();

    if (slackResult.success) {
      console.log('✅ Slack notification sent!');
      console.log(
        '📨 Message ID:',
        slackResult.data?.messageInfo?.messageTimestamp
      );
    } else {
      console.log('❌ Slack notification failed:', slackResult.error);
    }

    console.log('\n' + '='.repeat(60));
    console.log('🎉 FLOW COMPLETED SUCCESSFULLY!');
    console.log('='.repeat(60));
    console.log('\n📊 Final Results:');
    console.log('- Direct Answer:', result.data?.directAnswer);
    console.log('- Insights:', result.data?.insights);
    console.log('- Recommendations:', result.data?.recommendations);
    console.log(
      '- Slack Message ID:',
      slackResult.data?.messageInfo?.messageTimestamp
    );
  } catch (error) {
    console.error('\n💥 ERROR:', error);
    if (error instanceof Error) {
      console.error('Stack:', error.stack);
    }
  }
}

// Execute the test
if (require.main === module) {
  testDataAnalystFlowWithCredentials().catch((error) => {
    console.error('💥 Test crashed:', error);
    process.exit(1);
  });
}
