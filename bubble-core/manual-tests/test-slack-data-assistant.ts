import { SlackDataAssistantWorkflow } from '../src/bubbles/workflow-bubble/slack-data-assistant.workflow.js';
import { CredentialType } from '@bubblelab/shared-schemas';
import './setup.ts';

async function runTest() {
  console.log('🚀 Testing Slack Data Assistant Workflow\n');

  const credentials = {
    [CredentialType.GOOGLE_GEMINI_CRED]: process.env.GOOGLE_API_KEY || '',
    [CredentialType.SLACK_CRED]: process.env.SLACK_TOKEN || '',
    [CredentialType.DATABASE_CRED]:
      process.env.BUBBLE_CONNECTING_STRING_URL || '',
  };

  if (!credentials[CredentialType.GOOGLE_GEMINI_CRED]) {
    console.error(
      '❌ Error: GOOGLE_API_KEY not found in environment variables'
    );
    process.exit(1);
  }

  if (!credentials[CredentialType.SLACK_CRED]) {
    console.error('❌ Error: SLACK_TOKEN not found in environment variables');
    process.exit(1);
  }

  if (!credentials[CredentialType.DATABASE_CRED]) {
    console.error(
      '❌ Error: BUBBLE_CONNECTING_STRING_URL not found in environment variables'
    );
    process.exit(1);
  }

  try {
    console.log(
      '📋 Testing with question: "How many users are there in the database?"'
    );
    console.log('='.repeat(80));

    const workflow = new SlackDataAssistantWorkflow({
      slackChannel: 'staging-bot',
      userQuestion: 'How active are our users?',
      userName: 'Test User',
      dataSourceType: 'postgresql',
      ignoreSSLErrors: true,
      aiModel: 'google/gemini-2.5-pro',
      temperature: 0.3,
      verbosity: '1',
      technicality: '1',
      includeQuery: true,
      includeExplanation: true,
      credentials,
    });

    const result = await workflow.action();

    if (result.success) {
      console.log('✅ Workflow completed successfully!\n');

      console.log('📊 Results:');
      console.log('-'.repeat(40));
      console.log(`Query: ${result.data?.query || 'N/A'}`);
      console.log(`Explanation: ${result.data?.queryExplanation || 'N/A'}`);
      console.log(
        `Is Data Question: ${result.data?.isDataQuestion ? 'Yes' : 'No'}`
      );
      console.log(`Row Count: ${result.data?.metadata?.rowCount || 0}`);
      console.log(
        `Execution Time: ${result.data?.metadata?.executionTime || 0}ms`
      );
      console.log(`Word Count: ${result.data?.metadata?.wordCount || 0}`);

      if (result.data?.queryResults && result.data.queryResults.length > 0) {
        console.log('\n📈 Query Results (first 3 rows):');
        console.log(
          JSON.stringify(result.data.queryResults.slice(0, 3), null, 2)
        );
      }

      if (result.data?.slackBlocks && result.data.slackBlocks.length > 0) {
        console.log(
          `\n🔧 Slack Blocks Generated: ${result.data.slackBlocks.length} blocks`
        );
        console.log(
          'Block Types:',
          result.data.slackBlocks.map((b: any) => b.type).join(', ')
        );
      }

      console.log(
        `\n💬 Slack Message Timestamp: ${result.data?.slackMessageTs || 'N/A'}`
      );
    } else {
      console.error(`❌ Workflow failed: ${result.error}`);
    }
  } catch (error) {
    console.error(
      `❌ Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

// Run the test
runTest().catch(console.error);
