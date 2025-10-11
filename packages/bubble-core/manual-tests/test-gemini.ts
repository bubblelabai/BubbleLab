import { AIAgentBubble } from '../src/index.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the directory name for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from the parent directory
dotenv.config({ path: path.join(__dirname, '..', '.env') });

async function testGeminiAgent() {
  console.log('💎 Testing AIAgent Bubble with Google Gemini...\n');
  console.log('🔑 Google API Key found:', !!process.env.GOOGLE_API_KEY);
  console.log('');

  try {
    // Test 2: Gemini with calculator for compound growth
    console.log(
      '📊 Test 2: Gemini with calculator for investment calculations'
    );
    console.log(
      'Question: "Calculate compound interest on $10,000 invested at 8% annually for 15 years"'
    );
    console.log('');

    const financeAgent = new AIAgentBubble({
      message:
        'I want to invest $10,000 at 8% annual compound interest for 15 years. Please calculate the final amount and total interest earned using the calculator.',
      systemPrompt:
        'You are a financial advisor. Use the calculator for precise calculations and explain the compound interest formula.',
      tools: [{ name: 'calculator' }],
      model: {
        model: 'google/gemini-2.5-pro',
        temperature: 0.3,
        maxTokens: 9000,
      },
    });

    const result2 = await financeAgent.action();
    console.log('✅ Success:', result2.success);
    console.log('📄 Response:\n', result2.data?.response);
    console.log(
      '\n🔧 Tool Calls:',
      result2.data?.toolCalls?.length || 0,
      'tools used'
    );
    if (result2.data?.toolCalls) {
      result2.data.toolCalls.forEach((call, index) => {
        console.log(
          `   ${index + 1}. ${call.tool}: ${JSON.stringify(call.input)}`
        );
      });
    }
    console.log('\n🔄 Iterations:', result2.data?.iterations);
    console.log('\n' + '='.repeat(80) + '\n');
  } catch (error) {
    console.error('❌ Error testing Gemini AIAgent:', error.message);
    if (
      error.message.includes('API key') ||
      error.message.includes('401') ||
      error.message.includes('403')
    ) {
      console.log('\n💡 Make sure to:');
      console.log(
        '   1. Get a Google AI API key from https://aistudio.google.com/app/apikey'
      );
      console.log('   2. Set your GOOGLE_API_KEY in packages/bubble-core/.env');
      console.log(
        '   3. Ensure the API key is valid and has access to Gemini models'
      );
    }
    console.log('\n🔍 Full error:', error);
  }
}

// Run the test
console.log('🚀 Starting Gemini AIAgent tests...\n');
testGeminiAgent();
