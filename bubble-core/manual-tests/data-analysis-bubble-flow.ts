import {
  BubbleFlow,
  AIAgentBubble,
  PostgreSQLBubble,
  SlackBubble,
} from '../src/index.js';
import type { BubbleTriggerEventRegistry } from '../src/index.js';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from the project root
dotenv.config({ path: path.join(process.cwd(), '../../.env') });

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
      const userQuery =
        (payload.body?.query as string) ||
        'How many subscriptions have we acquired in the last 30 days?';

      console.log('🔍 Starting data analysis for query:', userQuery);

      // Step 1: Query the database for the full schema
      console.log('📊 Step 1: Fetching database schema...');
      const postgresqlSchemaResult = await new PostgreSQLBubble({
        query: `
          SELECT 
            t.table_name,
            c.column_name,
            c.data_type,
            c.is_nullable,
            -- Only show enum values for USER-DEFINED types
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
        `,
        ignoreSSL: true,
      }).action();

      if (!postgresqlSchemaResult.success) {
        throw new Error(
          `Failed to fetch database schema: ${postgresqlSchemaResult.error}`
        );
      }

      // Step 2: Use AI to generate SQL query based on schema and user question
      console.log('🤖 Step 2: Generating SQL query with AI...');
      const sqlQueryResult = await new AIAgentBubble({
        message: userQuery,
        systemPrompt: `You are a helpful assistant that can answer questions about the database. You are to write a query to answer the user query. You are to use the postgresql schema to write the query. Give only the query, no other text. Here is the postgresql schema: ${postgresqlSchemaResult.data?.cleanedJSONString}`,
        model: {
          model: 'google/gemini-2.5-flash',
          temperature: 0.1,
          maxTokens: 500,
        },
      }).action();

      if (!sqlQueryResult.success) {
        throw new Error(
          `Failed to generate SQL query: ${sqlQueryResult.error}`
        );
      }

      const sql_query = sqlQueryResult.data?.response;
      console.log('🔍 Generated SQL query:', sql_query);

      // Extract SQL from markdown code blocks
      const sqlMatch = sql_query?.match(
        /```(?:sql|postgresql)\n([\s\S]*?)\n```/
      );
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
        throw new Error(`Query execution failed: ${queryResult.error}`);
      }

      console.log('📈 Query result:', queryResult.data);

      // Step 4: Find the staging-bot channel
      console.log('📱 Step 4: Finding Slack channel...');
      const channelsResult = await new SlackBubble({
        operation: 'list_channels',
        token: process.env.SLACK_TOKEN!,
      }).action();

      if (!channelsResult.success) {
        throw new Error(`Failed to list channels: ${channelsResult.error}`);
      }

      const stagingBotChannel = channelsResult.data?.channels?.find(
        (channel: { name: string }) => channel.name === 'staging-bot'
      );

      if (!stagingBotChannel) {
        throw new Error('staging-bot channel not found');
      }

      console.log('✅ Found staging-bot channel:', stagingBotChannel.id);

      // Step 5: Create user-friendly analysis
      console.log('📝 Step 5: Generating analysis...');
      const analysisResult = await new AIAgentBubble({
        message: `Original user query: "${userQuery}"
        
Database query result: ${JSON.stringify(queryResult.data, null, 2)}

Please provide a user-friendly analysis of this data that directly answers the user's question.`,
        systemPrompt: `You are a data analyst assistant. Your job is to:
1. Take the database query result and provide a clear, user-friendly analysis
2. Answer the original user question directly
3. Use natural language that business stakeholders can understand
4. Include relevant numbers and insights
5. Keep it concise but informative
6. Format it nicely for Slack (use simple markdown if helpful)`,
        model: {
          model: 'google/gemini-2.5-flash',
          temperature: 0.3,
          maxTokens: 1000,
        },
      }).action();

      if (!analysisResult.success) {
        throw new Error(`Failed to generate analysis: ${analysisResult.error}`);
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
        channel: stagingBotChannel.id,
        text: `📊 **Data Analysis Result**\n\n${formattedAnalysis}`,
      }).action();

      if (!slackResult.success) {
        throw new Error(`Failed to send Slack message: ${slackResult.error}`);
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
        userQuery: (payload.body?.query as string) || 'unknown',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}

// Manual test function
export async function testDataAnalysisBubbleFlow() {
  console.log('🧪 Testing DataAnalysisBubbleFlow...\n');

  // Check environment variables
  const requiredVars = [
    'GOOGLE_API_KEY',
    'SLACK_TOKEN',
    'BUBBLE_CONNECTING_STRING_URL',
  ];
  const missingVars = requiredVars.filter((varName) => !process.env[varName]);

  if (missingVars.length > 0) {
    console.log(`⚠️  Missing environment variables: ${missingVars.join(', ')}`);
    console.log('Please check your .env file in the project root');
    return;
  }

  const flow = new DataAnalysisBubbleFlow(
    'webhook/http',
    'data-analysis-bubble-flow'
  );

  const result = await flow.handle({
    type: 'webhook/http',
    timestamp: new Date().toISOString(),
    path: '/test',
    body: {
      query: 'How many users do we have in total?',
    },
  });

  console.log('\n🎉 Test Result:');
  console.log('Success:', result.success);
  if (result.success) {
    console.log('User Query:', result.userQuery);
    console.log('Generated SQL:', result.sqlQuery);
    console.log('Slack Message ID:', result.slackMessageId);
    console.log('Analysis:', result.analysis?.substring(0, 200) + '...');
  } else {
    console.log('Error:', result.error);
  }
}

// Run manual test if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testDataAnalysisBubbleFlow().catch(console.error);
}
