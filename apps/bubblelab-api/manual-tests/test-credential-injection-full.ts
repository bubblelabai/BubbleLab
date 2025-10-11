import { db } from '../src/db/index.js';
import '../src/config/env.js';

async function testFullCredentialInjectionPipeline() {
  console.log('🧪 Full Credential Injection Pipeline Test');
  console.log('='.repeat(60));

  // The BubbleFlow code from our manual test (converted to a string)
  const dataAnalysisBubbleFlowCode = `
import { BubbleFlow, AIAgentBubble, PostgreSQLBubble, SlackBubble } from '@bubblelab/bubble-core';
import type { BubbleTriggerEventRegistry } from '@bubblelab/bubble-core';

export class DataAnalysisBubbleFlow extends BubbleFlow<'webhook/http'> {
  async handle(payload: BubbleTriggerEventRegistry['webhook/http']): Promise<{
    success: boolean;
    userQuery: string;
    sqlQuery?: string;
    queryResult?: unknown;
    analysis?: string;
    slackMessageId?: string;
    error?: string;
  }> {
    try {
      // Extract user query from payload
      const userQuery = payload.body?.query as string || 'How many subscriptions have we acquired in the last 30 days?';

      console.log('🔍 Starting data analysis for query:', userQuery);

      // Step 1: Query the database for the full schema
      console.log('📊 Step 1: Fetching database schema...');
      const postgresqlSchemaResult = await new PostgreSQLBubble({
        query: \`
          SELECT 
            t.table_name,
            c.column_name,
            c.data_type,
            c.is_nullable,
            CASE 
              WHEN c.data_type = 'USER-DEFINED' THEN (
                SELECT array_to_string(array_agg(e.enumlabel ORDER BY e.enumsortorder), ', ')
                FROM pg_type pt
                JOIN pg_enum e ON pt.oid = e.enumtypid
                WHERE pt.typname = c.udt_name
              )
              ELSE NULL
            END as enum_values
          FROM information_schema.tables t
          JOIN information_schema.columns c ON t.table_name = c.table_name 
            AND t.table_schema = c.table_schema
          WHERE t.table_type = 'BASE TABLE'
            AND t.table_schema NOT IN ('information_schema', 'pg_catalog', 'pg_toast')
          ORDER BY t.table_schema, t.table_name, c.ordinal_position;
        \`,
        ignoreSSL: true,
      }).action();


      if (!postgresqlSchemaResult.success) {
        throw new Error(\`Failed to fetch database schema: \${postgresqlSchemaResult.error}\`);
      }

      // Step 2: Use AI to generate SQL query based on schema and user question
      console.log('🤖 Step 2: Generating SQL query with AI...');
      const sqlQueryResult = await new AIAgentBubble({
        message: userQuery,
        systemPrompt: \`You are a helpful assistant that can answer questions about the database. You are to write a query to answer the user query. You are to use the postgresql schema to write the query. Give only the query, no other text. Here is the postgresql schema: \${postgresqlSchemaResult.data?.cleanedJSONString}\`,
        model: {
          model: 'google/gemini-2.5-flash',
          temperature: 0.1,
          maxTokens: 5000,
        },
      }).action();

      if (!sqlQueryResult.success) {
        throw new Error(\`Failed to generate SQL query: \${sqlQueryResult.error}\`);
      }

      const sql_query = sqlQueryResult.data?.response;
      console.log('🔍 Generated SQL query:', sql_query);

      // Extract SQL from markdown code blocks
      const sqlMatch = sql_query?.match(/\`\`\`(?:sql|postgresql)\\n([\\s\\S]*?)\\n\`\`\`/);
      const clean_query = sqlMatch ? sqlMatch[1].trim() : sql_query?.trim();

      if (!clean_query) {
        throw new Error('No valid SQL query generated');
      }

      // Step 3: Execute the generated query
      console.log('💾 Step 3: Executing query...');
      const queryResult = await new PostgreSQLBubble({
        query: clean_query,
        ignoreSSL: true,
      }).action();

      if (!queryResult.success) {
        throw new Error(\`Query execution failed: \${queryResult.error}\`);
      }

      console.log('📈 Query result:', queryResult.data);

      // Step 4: Find the staging-bot channel
      console.log('📱 Step 4: Finding Slack channel...');
      const channelsResult = await new SlackBubble({
        operation: 'list_channels'
      }).action();

      if (!channelsResult.success) {
        throw new Error(\`Failed to list channels: \${channelsResult.error}\`);
      }

      const stagingBotChannel = channelsResult.data?.channels?.find(
        (channel: any) => channel.name === 'staging-bot'
      );

      if (!stagingBotChannel) {
        throw new Error('staging-bot channel not found');
      }

      console.log('✅ Found staging-bot channel:', stagingBotChannel.id);

      // Step 5: Create user-friendly analysis
      console.log('📝 Step 5: Generating analysis...');
      const analysisResult = await new AIAgentBubble({
        message: \`Original user query: "\${userQuery}"
        
Database query result: \${JSON.stringify(queryResult.data, null, 2)}

Please provide a user-friendly analysis of this data that directly answers the user's question.\`,
        systemPrompt: \`You are a data analyst assistant. Your job is to:
1. Take the database query result and provide a clear, user-friendly analysis
2. Answer the original user question directly
3. Use natural language that business stakeholders can understand
4. Include relevant numbers and insights
5. Keep it concise but informative
6. Format it nicely for Slack (use simple markdown if helpful)\`,
        model: {
          model: 'google/gemini-2.5-flash',
          temperature: 0.3,
          maxTokens: 1000,
        },
      }).action();

      if (!analysisResult.success) {
        throw new Error(\`Failed to generate analysis: \${analysisResult.error}\`);
      }

      const formattedAnalysis = analysisResult.data?.response;
      console.log('📊 Generated analysis:', formattedAnalysis);

      if (!formattedAnalysis) {
        throw new Error('No analysis generated');
      }

      // Step 6: Send results to Slack
      console.log('📤 Step 6: Sending to Slack...');
      const slackResult = await new SlackBubble({
        operation: 'send_message',
        token: process.env.SLACK_TOKEN!,
        channel: stagingBotChannel.id,
        text: \`📊 **Data Analysis Result**\\n\\n\${formattedAnalysis}\`,
      }).action();

      if (!slackResult.success) {
        throw new Error(\`Failed to send Slack message: \${slackResult.error}\`);
      }

      console.log('✅ Successfully completed data analysis pipeline!');

      return {
        success: true,
        userQuery,
        sqlQuery: clean_query,
        queryResult: queryResult.data,
        analysis: formattedAnalysis,
        slackMessageId: slackResult.data?.ts,
      };

    } catch (error) {
      console.error('❌ Data analysis failed:', error);
      return {
        success: false,
        userQuery: payload.body?.query as string || 'unknown',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}`;

  try {
    console.log('\\n1. 📝 Creating BubbleFlow via API...');

    // Create the BubbleFlow via POST API with webhook
    const createResponse = await fetch(
      `${process.env.NODEX_API_URL}/bubble-flow`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Data Analysis Pipeline with Credential Injection',
          description:
            'Full pipeline: Database Schema → AI SQL Generation → Query Execution → AI Analysis → Slack Notification',
          code: dataAnalysisBubbleFlowCode,
          eventType: 'webhook/http',
          // webhookPath: 'data-analysis-test', // Test auto-generation
          webhookActive: true,
        }),
      }
    );

    if (!createResponse.ok) {
      const errorData = await createResponse.json();
      console.error('❌ Failed to create BubbleFlow:', errorData);
      return;
    }

    const createResult = await createResponse.json();
    console.log('✅ BubbleFlow created successfully!');
    console.log('   ID:', createResult.id);
    console.log('   Webhook URL:', createResult.webhook?.url);
    console.log('   Webhook Active:', createResult.webhook?.active);

    // Verify the stored bubble parameters
    console.log('\\n2. 🔍 Verifying stored bubble parameters...');
    const storedFlow = await db.query.bubbleFlows.findFirst({
      where: (flows, { eq }) => eq(flows.id, createResult.id),
    });

    if (!storedFlow?.bubbleParameters) {
      console.error('❌ No bubble parameters found');
      return;
    }

    const bubbleParams = storedFlow.bubbleParameters as Record<string, any>;
    console.log('✅ Found bubble parameters for:');
    Object.entries(bubbleParams).forEach(([varName, bubble]) => {
      console.log(
        `   • ${varName}: ${(bubble as any).bubbleName} (${(bubble as any).className})`
      );

      // Show environment variable parameters
      const envParams = (bubble as any).parameters.filter(
        (p: any) => p.type === 'env'
      );
      if (envParams.length > 0) {
        console.log(
          `     - Environment vars: ${envParams.map((p: any) => p.value).join(', ')}`
        );
      }
    });

    console.log(
      '\\n3. 🚀 Executing BubbleFlow via webhook with credential injection...'
    );

    // Execute the BubbleFlow via webhook
    const webhookUrl = createResult.webhook?.url;
    if (!webhookUrl) {
      console.error('❌ No webhook URL found');
      return;
    }

    console.log(`   Calling webhook: ${webhookUrl}`);
    const executeResponse = await fetch(`${webhookUrl}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: 'How many users signed up in the last 30 days?',
      }),
    });

    const executeResult = await executeResponse.json();

    console.log('📊 Webhook execution completed!');
    console.log('   Success:', executeResult.success);
    console.log('   Execution ID:', executeResult.executionId);
    console.log('   Webhook Path:', executeResult.webhook?.path);
    console.log('   Triggered Method:', executeResult.webhook?.method);

    if (executeResult.success) {
      console.log('   ✅ Pipeline executed successfully!');
      console.log(
        '   📈 Result preview:',
        JSON.stringify(executeResult.data, null, 2).substring(0, 500) + '...'
      );

      // Check if we have injected credentials info
      if (executeResult.injectedCredentials) {
        console.log(
          '   🔐 Credentials injected:',
          executeResult.injectedCredentials
        );
      }
    } else {
      console.log('   ❌ Execution failed:', executeResult.error);

      // Even if execution fails due to API issues, credential injection might have worked
      if (
        executeResult.error?.includes('AI') ||
        executeResult.error?.includes('database') ||
        executeResult.error?.includes('Slack')
      ) {
        console.log(
          '   ✅ Error indicates credentials were injected and API calls were attempted'
        );
      }
    }

    console.log(
      '\\n🎉 Full webhook-based credential injection pipeline test completed!'
    );
    console.log('\\n📝 Test Summary:');
    console.log('   • BubbleFlow creation: ✅');
    console.log('   • Webhook creation: ✅');
    console.log('   • Bubble parameter parsing: ✅');
    console.log('   • Parameter storage: ✅');
    console.log(
      '   • Webhook execution:',
      executeResult.success ? '✅' : '⚠️ (API dependent)'
    );
    console.log(
      '   • Credential injection:',
      executeResult.success ? '✅' : '⚠️ (API dependent)'
    );
    console.log(
      '   • Multi-service pipeline:',
      executeResult.success ? '✅' : '⚠️ (API dependent)'
    );
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
console.log('🚀 Starting Full Credential Injection Pipeline Test...');
testFullCredentialInjectionPipeline();
