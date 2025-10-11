import { AIAgentBubble } from '../src/bubbles/service-bubble/ai-agent.js';
import './setup.ts';

async function testAgentChartGeneration() {
  console.log('🤖 Testing AI Agent Chart Generation...\n');

  // Sample data that the agent will work with
  const salesData = [
    { month: 'Jan', sales: 12000, profit: 2400, expenses: 9600 },
    { month: 'Feb', sales: 15000, profit: 3500, expenses: 11500 },
    { month: 'Mar', sales: 13000, profit: 2800, expenses: 10200 },
    { month: 'Apr', sales: 18000, profit: 4200, expenses: 13800 },
    { month: 'May', sales: 16000, profit: 3800, expenses: 12200 },
    { month: 'Jun', sales: 20000, profit: 5000, expenses: 15000 },
  ];

  const userQuestions = [
    "Create a line chart showing sales trends over the months and save it as 'monthly-sales-trend.png'",
    "Make a bar chart comparing profit by month and generate the file as 'profit-comparison.png'",
    'Generate a pie chart showing the expense breakdown for May (use expenses, profit values) and save it to a file',
  ];

  // Test with different credential scenarios
  const mockCredentials = {
    GOOGLE_GEMINI_CRED: process.env.GOOGLE_API_KEY,
  };

  try {
    for (let i = 0; i < userQuestions.length; i++) {
      const question = userQuestions[i];
      console.log(`\n📋 Test ${i + 1}: ${question}`);
      console.log('='.repeat(80));

      // Create AI agent with chart generation capabilities
      const agent = new AIAgentBubble({
        message: `You have access to sales data and a chart generation tool. Here's the data:
${JSON.stringify(salesData, null, 2)}

User request: ${question}

Use the chart-js-tool to create the requested visualization. Make sure to:
1. Set generateFile to true
2. Use the requested filename if provided, or create a descriptive one
3. Choose appropriate chart type and columns
4. Include a title and proper labels
5. After generating the chart, tell the user the filename of the generated file

IMPORTANT: When the chart is generated successfully, output the exact filename that was created.`,

        model: {
          model: 'google/gemini-2.5-flash',
          temperature: 0.3,
          maxTokens: 2000,
        },

        systemPrompt: `You are a helpful data visualization assistant. You have access to a chart-js-tool that can generate actual chart image files. 

When using the chart-js-tool:
- Always set generateFile to true to create actual files
- Use descriptive filenames with .png extension
- Choose appropriate chart types for the data
- Include helpful titles and axis labels
- After successful chart generation, always mention the filename in your response

Be concise but informative in your responses.`,

        tools: [
          {
            name: 'chart-js-tool',
            credentials: mockCredentials,
          },
        ],

        maxIterations: 5,
        credentials: mockCredentials,
      });

      const result = await agent.action();

      console.log('\n🤖 Agent Response:');
      console.log('-'.repeat(40));
      if (result.success && result.data?.response) {
        console.log(result.data.response);

        // Extract tool calls to see what charts were generated
        if (result.data.toolCalls && result.data.toolCalls.length > 0) {
          console.log('\n🔧 Tool Calls Made:');
          result.data.toolCalls.forEach((call, idx) => {
            if (call.tool === 'chart-js-tool') {
              console.log(`\n   📊 Chart ${idx + 1}:`);
              console.log(
                `      Type: ${(call.input as any)?.chartType || 'unknown'}`
              );
              console.log(
                `      Generate File: ${(call.input as any)?.generateFile}`
              );
              console.log(
                `      File Name: ${(call.input as any)?.fileName || 'auto-generated'}`
              );

              if (call.output && typeof call.output === 'object') {
                const output = call.output as any;
                if (output.success) {
                  console.log(`      ✅ Success: ${output.success}`);
                  console.log(
                    `      📁 File Path: ${output.filePath || 'N/A'}`
                  );
                  console.log(
                    `      📏 File Size: ${output.fileSize || 'N/A'} bytes`
                  );
                  console.log(`      🔍 File Exists: ${output.fileExists}`);

                  // Extract just the filename from the path
                  if (output.filePath) {
                    const fileName = output.filePath.split('/').pop();
                    console.log(`      🎯 GENERATED FILE: ${fileName}`);
                  }
                } else {
                  console.log(`      ❌ Error: ${output.error}`);
                }
              }
            }
          });
        }
      } else {
        console.log(`❌ Agent failed: ${result.error}`);
      }

      console.log('\n' + '='.repeat(80));
    }

    console.log('\n🎉 AI Agent Chart Generation Tests Completed!');
    console.log(
      '\nGenerated files should be saved in the default chart directory.'
    );
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testAgentChartGeneration().catch(console.error);
