#!/usr/bin/env tsx

import { config } from 'dotenv';
import { AIAgentBubble } from '../src/bubbles/service-bubble/ai-agent.js';

// Load environment variables
config();

async function testResultValidation() {
  console.log('🧪 Testing Result Validation...\n');

  // Test 1: Valid result should pass validation
  console.log('Test 1: Valid AI Agent execution');
  try {
    const agent = new AIAgentBubble({
      message: 'What is 2 + 2?',
      systemPrompt: 'You are a helpful math assistant.',
      model: {
        model: 'google/gemini-2.5-flash',
        temperature: 0,
      },
      tools: [{ name: 'calculator' }],
    });

    const result = await agent.action();
    console.log('✅ Result validation passed');
    console.log('Result:', JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('❌ Test 1 failed:', error);
  }

  console.log('\n' + '='.repeat(50) + '\n');

  // Test 2: Test that result schema is properly defined
  console.log('Test 2: Check result schema metadata');
  try {
    console.log('AIAgent result schema:', AIAgentBubble.resultSchema);
    if (AIAgentBubble.resultSchema) {
      console.log('✅ Result schema is defined');

      // Test schema validation with mock data
      const mockValidResult = {
        response: 'The answer is 4',
        toolCalls: [
          {
            tool: 'calculator',
            input: { operation: 'add', a: 2, b: 2 },
            output: 4,
          },
        ],
        iterations: 1,
        success: true,
      };

      const validationResult =
        AIAgentBubble.resultSchema.safeParse(mockValidResult);
      if (validationResult.success) {
        console.log('✅ Mock result validation passed');
      } else {
        console.error(
          '❌ Mock result validation failed:',
          validationResult.error
        );
      }

      // Test invalid result
      const mockInvalidResult = {
        response: 123, // Should be string
        iterations: 'invalid', // Should be number
        success: 'true', // Should be boolean
      };

      const invalidValidation =
        AIAgentBubble.resultSchema.safeParse(mockInvalidResult);
      if (!invalidValidation.success) {
        console.log('✅ Invalid result properly rejected');
        console.log(
          'Validation errors:',
          invalidValidation.error.issues.map((i) => i.message)
        );
      } else {
        console.error('❌ Invalid result was incorrectly accepted');
      }
    } else {
      console.error('❌ Result schema is not defined');
    }
  } catch (error) {
    console.error('❌ Test 2 failed:', error);
  }
}

// Run the test
testResultValidation().catch(console.error);
