import { AIAgentBubble } from '@bubblelab/bubble-core';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the directory name for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from the parent directory
dotenv.config({ path: path.join(__dirname, '..', '.env') });

async function testAIAgent() {
  console.log('🤖 Testing AIAgent Bubble...\n');
  console.log('🔑 OpenAI API Key found:', !!process.env.OPENAI_API_KEY);
  console.log('');

  try {
    // Test 1: Basic question about today's news/trends
    console.log('📰 Test 1: Ask about current AI news and trends');
    console.log(
      'Question: "What are the most significant AI developments and trends happening in 2025?"'
    );
    console.log('');

    const newsAgent = new AIAgentBubble({
      message:
        'What are the most significant AI developments and trends happening in 2025? Focus on recent breakthroughs, industry adoption, and emerging technologies.',
      systemPrompt:
        'You are a knowledgeable AI expert who stays up-to-date with the latest developments in artificial intelligence. Provide informative insights about current trends, recent breakthroughs, and industry developments.',
      model: {
        model: 'openai/gpt-4o',
        temperature: 0.7,
        maxTokens: 500,
      },
    });

    const result1 = await newsAgent.action();
    console.log('✅ Success:', result1.success);
    console.log('📄 Response:\n', result1.data?.response);
    console.log('\n🔄 Iterations:', result1.data?.iterations);
    console.log('\n' + '='.repeat(80) + '\n');

    // Test 2: Agent with calculator for tech predictions
    console.log('📊 Test 2: AI with calculator for market calculations');
    console.log(
      'Question: "If the AI market was worth $150B in 2024 and grows 37% annually, what will it be worth in 2027?"'
    );
    console.log('');

    const mathAgent = new AIAgentBubble({
      message:
        'If the global AI market was worth $150 billion in 2024 and grows at 37% annually, what will it be worth in 2027? Please use the calculator to show the exact calculation.',
      systemPrompt:
        'You are a financial analyst with access to a calculator. Use the calculator for precise mathematical calculations and explain your methodology.',
      tools: [{ name: 'calculator' }],
      model: {
        model: 'openai/gpt-4o',
        temperature: 0.3,
        maxTokens: 300,
      },
    });

    const result2 = await mathAgent.action();
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

    // Test 3: Agent with search tool for current information
    console.log('🔍 Test 3: AI with search capability (simulated)');
    console.log(
      'Question: "Find recent information about OpenAI\'s latest model releases"'
    );
    console.log('');

    const searchAgent = new AIAgentBubble({
      message:
        "Search for the latest information about OpenAI's recent model releases and updates. What are the newest models and their capabilities?",
      systemPrompt:
        'You are a tech research assistant. When using search, look for the most recent and relevant information about AI model releases and developments.',
      tools: [{ name: 'search' }],
      model: {
        model: 'openai/gpt-4o',
        temperature: 0.5,
        maxTokens: 400,
      },
    });

    const result3 = await searchAgent.action();
    console.log('✅ Success:', result3.success);
    console.log('📄 Response:\n', result3.data?.response);
    console.log(
      '\n🔧 Tool Calls:',
      result3.data?.toolCalls?.length || 0,
      'tools used'
    );
    if (result3.data?.toolCalls) {
      result3.data.toolCalls.forEach((call, index) => {
        console.log(
          `   ${index + 1}. ${call.tool}: ${JSON.stringify(call.input)}`
        );
      });
    }
    console.log('\n🔄 Iterations:', result3.data?.iterations);

    console.log('\n🎉 All tests completed successfully!');
  } catch (error) {
    console.error('❌ Error testing AIAgent:', error.message);
    if (error.message.includes('API key') || error.message.includes('401')) {
      console.log('\n💡 Make sure to:');
      console.log('   1. Set your OPENAI_API_KEY in packages/bubble-core/.env');
      console.log(
        '   2. Ensure the API key is valid and has sufficient credits'
      );
    }
    console.log('\n🔍 Full error:', error);
  }
}

// Run the test
console.log('🚀 Starting AIAgent tests...\n');
testAIAgent();
