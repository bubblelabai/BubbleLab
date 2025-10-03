/**
 * Manual test for Slack bubble - List all channels
 *
 * This test demonstrates how to use the SlackBubble to list all channels in a Slack workspace.
 *
 * To run this test:
 * 1. Set up a Slack bot token with the following scopes:
 *    - channels:read (for public channels)
 *    - groups:read (for private channels)
 *    - im:read (for direct messages)
 *    - mpim:read (for multi-party direct messages)
 * 2. Set the SLACK_TOKEN environment variable
 * 3. Run: npx ts-node test/slack-manual-test.ts
 */

import { SlackBubble, BubbleContext } from '@bubblelab/bubble-core';
import dotenv from 'dotenv';
import path from 'path';

// load .env file
dotenv.config({ path: path.join(process.cwd(), '../../.env') });

async function testListAllChannels() {
  console.log('🚀 Starting Slack channel list test...\n');

  // Get Slack token from environment variable
  const slackToken = process.env.SLACK_TOKEN;

  if (!slackToken) {
    console.error('❌ Error: SLACK_TOKEN environment variable is not set');
    console.log('Please set your Slack bot token:');
    console.log('export SLACK_TOKEN="xoxb-your-bot-token-here"');
    process.exit(1);
  }

  // Create bubble context (optional)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const context: BubbleContext = {
    userId: 'test-user',
    organizationId: 'test-org',
    environment: 'development',
    metadata: {
      testRun: true,
      timestamp: new Date().toISOString(),
    },
  };

  try {
    // Create the Slack bubble for listing channels with optimized defaults
    console.log(
      '📋 Creating Slack bubble to list channels (using optimized defaults)...'
    );
    const slackBubble = new SlackBubble({
      operation: 'list_channels',
      token: slackToken,
    });

    console.log('✅ Slack bubble created successfully');
    console.log(`📊 Bubble metadata:`);
    console.log(`   - Name: ${slackBubble.name}`);
    console.log(`   - Description: ${slackBubble.shortDescription}`);
    console.log(`   - Service: ${slackBubble.type}`);
    console.log(`   - Auth Type: ${slackBubble.authType}\n`);

    // Execute the bubble action
    console.log('🔄 Executing channel list operation...');
    const result = await slackBubble.action();

    // Check if the operation was successful
    if (!result.success) {
      console.error('❌ Bubble execution failed:');
      console.error(`   Error: ${result.error}`);
      console.error(`   Execution ID: ${result.executionId}`);
      console.error(`   Timestamp: ${result.timestamp}`);
      return;
    }

    console.log('✅ Channel list operation completed successfully!');
    console.log(`   Execution ID: ${result.executionId}`);
    console.log(`   Timestamp: ${result.timestamp}\n`);

    // Display the results
    const channelData = result.data;
    if (!channelData || !channelData.ok) {
      console.error('❌ Slack API returned an error:');
      console.error(`   Error: ${channelData?.error || 'Unknown error'}`);
      return;
    }

    const channels = channelData.channels;
    if (!channels || channels.length === 0) {
      console.log('📭 No channels found in this workspace');
      return;
    }

    console.log(`📚 Found ${channels.length} channels:\n`);
    console.log(
      '┌─────────────────────┬──────────────────────┬─────────┬───────────┬──────────────────────┐'
    );
    console.log(
      '│ Channel Name        │ ID                   │ Type    │ Members   │ Purpose              │'
    );
    console.log(
      '├─────────────────────┼──────────────────────┼─────────┼───────────┼──────────────────────┤'
    );

    channels.forEach((channel) => {
      const name = channel.name?.padEnd(19) || 'Unknown'.padEnd(19);
      const id = channel.id.padEnd(20);

      let type = 'Unknown';
      if (channel.is_channel) type = 'Public';
      else if (channel.is_group) type = 'Private';
      else if (channel.is_im) type = 'DM';
      else if (channel.is_mpim) type = 'Group DM';
      type = type.padEnd(7);

      const memberCount = (channel.num_members?.toString() || 'N/A').padEnd(9);
      const purpose = (channel.purpose?.value || 'No purpose set')
        .substring(0, 20)
        .padEnd(20);

      console.log(
        `│ ${name} │ ${id} │ ${type} │ ${memberCount} │ ${purpose} │`
      );
    });

    console.log(
      '└─────────────────────┴──────────────────────┴─────────┴───────────┴──────────────────────┘'
    );

    // Display pagination info if available
    if (channelData.response_metadata?.next_cursor) {
      console.log(
        `\n📄 More channels available. Next cursor: ${channelData.response_metadata.next_cursor}`
      );
    }

    // Display additional channel details for first 3 channels
    console.log('\n📋 Detailed information for first 3 channels:');
    channels.slice(0, 3).forEach((channel, index) => {
      console.log(`\n${index + 1}. #${channel.name} (${channel.id})`);
      console.log(
        `   - Created: ${new Date(channel.created * 1000).toLocaleDateString()}`
      );
      console.log(`   - Archived: ${channel.is_archived ? 'Yes' : 'No'}`);
      console.log(`   - Members: ${channel.num_members || 'Unknown'}`);
      console.log(`   - Topic: ${channel.topic?.value || 'No topic set'}`);
      console.log(
        `   - Purpose: ${channel.purpose?.value || 'No purpose set'}`
      );

      if (channel.is_general) {
        console.log('   - ⭐ This is the general channel');
      }

      if (channel.is_member) {
        console.log('   - ✅ Bot is a member of this channel');
      } else {
        console.log('   - ❌ Bot is not a member of this channel');
      }
    });

    console.log('\n🎉 Test completed successfully!');
  } catch (error) {
    console.error('❌ Test failed with error:');
    console.error(error instanceof Error ? error.message : 'Unknown error');
    console.error('\nPossible issues:');
    console.error('1. Invalid Slack token');
    console.error('2. Insufficient bot permissions');
    console.error('3. Network connectivity issues');
    console.error('4. Slack API rate limiting');

    if (error instanceof Error && error.message.includes('invalid_auth')) {
      console.error('\n💡 Hint: Your Slack token might be invalid or expired');
    }

    if (error instanceof Error && error.message.includes('missing_scope')) {
      console.error('\n💡 Hint: Your bot needs additional OAuth scopes:');
      console.error('   - channels:read (for public channels)');
      console.error('   - groups:read (for private channels)');
    }
  }
}

// Test function to demonstrate optimized defaults across different operations
async function testOptimizedDefaults() {
  console.log('\n🚀 Testing optimized defaults across operations...\n');

  const slackToken = process.env.SLACK_TOKEN;
  if (!slackToken) {
    console.log('⏭️  Skipping optimized defaults test - no token provided');
    return;
  }

  try {
    // Test 1: List channels with minimal params
    console.log('1. Testing list_channels with minimal parameters...');
    const channelsBubble = new SlackBubble({
      operation: 'list_channels',
      token: slackToken,
      // All other params use optimized defaults
    });

    const channelsResult = await channelsBubble.action();
    if (channelsResult.success) {
      console.log('   ✅ Successfully listed channels with default settings');
      const channelCount = channelsResult.data?.channels?.length || 0;
      console.log(
        `   📊 Found ${channelCount} channels (limit: 50, exclude_archived: true)`
      );
    }

    // Test 2: List users with minimal params
    console.log('\n2. Testing list_users with minimal parameters...');
    const usersBubble = new SlackBubble({
      operation: 'list_users',
      token: slackToken,
      // All other params use optimized defaults
    });

    const usersResult = await usersBubble.action();
    if (usersResult.success) {
      console.log('   ✅ Successfully listed users with default settings');
      const userCount = usersResult.data?.members?.length || 0;
      console.log(
        `   📊 Found ${userCount} users (limit: 50, include_locale: false)`
      );
    }

    console.log('\n✨ Optimized defaults test completed successfully!');
    console.log(
      '💡 Benefits: Less configuration required, sensible defaults for 90% of use cases'
    );
  } catch (error) {
    console.error('❌ Optimized defaults test failed:', error);
  }
}

// Additional test function to demonstrate error handling
async function testInvalidToken() {
  console.log('\n🔍 Testing error handling with invalid token...\n');

  try {
    const slackBubble = new SlackBubble({
      operation: 'list_channels',
      token: 'invalid-token',
      // Using optimized defaults - no need to specify types, exclude_archived, or limit
    });

    const result = await slackBubble.action();

    if (!result.success) {
      console.log('✅ Error handling works correctly:');
      console.log(`   Expected error: ${result.error}`);
    } else {
      console.log('❌ Expected error but got success - this should not happen');
    }
  } catch (error) {
    console.log('✅ Exception handling works correctly:');
    console.log(
      `   Caught error: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

// Run the tests
async function runTests() {
  console.log('🧪 Slack Bubble Manual Test Suite\n');
  console.log(
    'This test will demonstrate the SlackBubble functionality by listing channels.\n'
  );

  await testListAllChannels();
  await testOptimizedDefaults();
  await testInvalidToken();

  console.log('\n✨ All tests completed!');
}

// Execute tests if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runTests().catch(console.error);
}
