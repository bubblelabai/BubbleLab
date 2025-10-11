/**
 * Simple test to demonstrate AI Agent using tool bubbles
 * This shows how the ai-agent can now use any registered tool bubble
 */

import { AIAgentBubble } from '../src/bubbles/service-bubble/ai-agent.js';
import { CredentialType } from '@bubblelab/shared-schemas';
import './setup.ts';

async function testAIAgentWithToolBubbles() {
  console.log('🤖 Testing AI Agent with Tool Bubbles Integration...\n');

  // Create an AI agent that uses tool bubbles
  const aiAgent = new AIAgentBubble({
    message: 'tell me about the slack',
    systemPrompt:
      'You are a helpful assistant that can use various tools to help users.',
    model: {
      model: 'google/gemini-2.5-flash',
      temperature: 0.1,
    },
    tools: [{ name: 'list-bubbles-tool' }, { name: 'get-bubble-details-tool' }],
    credentials: {
      [CredentialType.GOOGLE_GEMINI_CRED]:
        process.env.GOOGLE_API_KEY || 'fake-key-for-demo',
    },
  });

  console.log('📝 Configuration:');
  console.log(`- Message: "${aiAgent.currentParams.message}"`);
  console.log(`- Model: ${aiAgent.currentParams.model.model}`);
  console.log(
    `- Tools: ${aiAgent.currentParams.tools.map((t) => t.name).join(', ')}`
  );
  console.log(`- Has credentials: ${!!aiAgent.currentParams.credentials}`);
  console.log('');

  try {
    console.log('🚀 Executing AI Agent...');

    // Execute the agent - this will fail due to no real API key, but will show tool initialization
    const result = await aiAgent.action();
    console.log('✅ Result:', {
      success: result.success,
      response: result.data?.response,
      hasResponse: !!result.data?.response,

      toolCalls: JSON.stringify(result.data?.toolCalls, null, 2),
      iterations: result.data?.iterations,
      error: result.error ? result.error.substring(0, 100) + '...' : undefined,
    });
  } catch (error) {
    console.log(
      '❌ Error during execution:',
      error instanceof Error ? error.message : error
    );
  }

  console.log('\n🎉 Integration test completed!');
  console.log('The AI Agent can now accept any tool bubble name and will:');
  console.log('1. Look up the tool in the BubbleRegistry');
  console.log('2. Create an instance of the tool bubble');
  console.log('3. Convert it to a LangGraph tool');
  console.log('4. Use it in the agent workflow');
}

// Run the test if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testAIAgentWithToolBubbles().catch(console.error);
}

export { testAIAgentWithToolBubbles };
