/**
 * Test webhook payload transformation
 * This demonstrates how raw webhook payloads are transformed into the appropriate
 * BubbleTriggerEvent structure based on the event type.
 */

// Example Slack webhook payload (what actually comes from Slack)
const slackWebhookPayload = {
  token: 'Z6MFCp3UUociOt9gF2aGft9O',
  team_id: 'T07UVUG5ZNY',
  api_app_id: 'A08H7A3BHS5',
  event: {
    user: 'U07UTL8MA9Y',
    type: 'app_mention',
    ts: '1753712246.912699',
    client_msg_id: 'a6df8886-25ab-40a1-8b9a-506e43b1853b',
    text: '<@U08GXBRKML2> hi',
    team: 'T07UVUG5ZNY',
    blocks: [
      {
        type: 'rich_text',
        block_id: 'lnk4t',
        elements: [
          {
            type: 'rich_text_section',
            elements: [
              { type: 'user', user_id: 'U08GXBRKML2' },
              { type: 'text', text: ' hi' },
            ],
          },
        ],
      },
    ],
    channel: 'C08J0L09PT6',
    event_ts: '1753712246.912699',
  },
  type: 'event_callback',
  event_id: 'Ev097Q4KBBSS',
  event_time: 1753712246,
  authorizations: [
    {
      enterprise_id: null,
      team_id: 'T07UVUG5ZNY',
      user_id: 'U08GXBRKML2',
      is_bot: true,
      is_enterprise_install: false,
    },
  ],
  is_ext_shared_channel: false,
  event_context:
    '4-eyJldCI6ImFwcF9tZW50aW9uIiwidGlkIjoiVDA3VVZVRzVaTlkiLCJhaWQiOiJBMDhIN0EzQkhTNSIsImNpZCI6IkMwOEowTDA5UFQ2In0',
};

// Example of what the transformation function would produce
const transformedSlackPayload = {
  type: 'slack/bot_mentioned',
  timestamp: '2025-01-28T14:17:28.242Z',
  path: '/webhook/1/test',
  body: slackWebhookPayload, // Original body preserved for compatibility
  slack_event: slackWebhookPayload, // Full Slack event wrapper
  channel: 'C08J0L09PT6',
  user: 'U07UTL8MA9Y',
  text: '<@U08GXBRKML2> hi',
  thread_ts: undefined,
};

console.log('🔗 Original Slack Webhook Payload:');
console.log('Keys:', Object.keys(slackWebhookPayload));
console.log('Event type:', slackWebhookPayload.event.type);
console.log('Channel:', slackWebhookPayload.event.channel);
console.log('User:', slackWebhookPayload.event.user);
console.log('Text:', slackWebhookPayload.event.text);

console.log('\n📦 Transformed Payload:');
console.log('Keys:', Object.keys(transformedSlackPayload));
console.log('Type:', transformedSlackPayload.type);
console.log('Channel:', transformedSlackPayload.channel);
console.log('User:', transformedSlackPayload.user);
console.log('Text:', transformedSlackPayload.text);
console.log('Has slack_event:', !!transformedSlackPayload.slack_event);
console.log('Has original body:', !!transformedSlackPayload.body);

console.log('\n✅ Benefits of this approach:');
console.log('1. Type safety: Each event type has its own interface');
console.log(
  '2. Convenience: Direct access to common fields (channel, user, text)'
);
console.log(
  "3. Flexibility: Full original payload preserved in 'body' and event-specific fields"
);
console.log('4. Consistency: All events follow the same base structure');
console.log('5. Future-proof: Easy to add new event types');

console.log('\n🎯 Usage in BubbleFlow:');
console.log(`
// In a BubbleFlow, you can now access data like this:
export class SlackBotFlow extends BubbleFlow<'slack/bot_mentioned'> {
  async handle(payload: BubbleTriggerEventRegistry['slack/bot_mentioned']) {
    // Direct access to common fields
    const channel = payload.channel;
    const user = payload.user;
    const text = payload.text;
    
    // Access to full Slack event if needed
    const fullSlackEvent = payload.slack_event;
    
    // Access to original webhook body if needed
    const originalBody = payload.body;
    
    return { message: \`Processed message from \${user} in \${channel}\` };
  }
}
`);
