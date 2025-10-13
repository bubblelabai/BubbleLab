import { AIAgentBubble, PostgreSQLBubble, SlackBubble } from '../../index.js';

describe('AIAgentBubble Integration Tests', () => {
  // Test full data analysis pipeline: database query -> AI analysis -> Slack notification
  describe('Full data analysis pipeline integration', () => {
    test('should query database, analyze data with AI, and send results to Slack', async () => {
      // Skip if no real Google API key is available
      if (
        !process.env.GOOGLE_API_KEY ||
        process.env.GOOGLE_API_KEY.startsWith('test-') ||
        process.env.GOOGLE_API_KEY.length < 10
      ) {
        console.log('⚠️  Skipping Gemini integration test - no real API key');
        return;
      }

      // Skip if no Slack token is available
      if (
        !process.env.SLACK_TOKEN ||
        process.env.SLACK_TOKEN.startsWith('xoxb-test-')
      ) {
        console.log('⚠️  Skipping Slack integration - no real Slack token');
        return;
      }

      // Skip if no database URL is available
      if (!process.env.BUBBLE_CONNECTING_STRING_URL) {
        console.log(
          '⚠️  Skipping database integration - no BUBBLE_CONNECTING_STRING_URL'
        );
        return;
      }

      // User query
      const userQuery =
        'How many subscriptions have we acquired in the last 30 days?';

      // Query the database for the full scheam
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
        credentials: {
          DATABASE_CRED: process.env.BUBBLE_CONNECTING_STRING_URL,
        },
      }).action();

      console.log('PostgreSQL schema result:', postgresqlSchemaResult.data);

      // Make gemini-2.5-pro agent to come up with a query to answer the user query
      const sql_query = (
        await new AIAgentBubble({
          message: userQuery,
          systemPrompt: `You are a helpful assistant that can answer questions about the database. You are to write a query to answer the user query. You are to use the postgresql schema to write the query. Give only the query, no other text. Here is the postgresql schema: ${postgresqlSchemaResult.data?.cleanedJSONString}`,
          credentials: {
            GOOGLE_GEMINI_CRED: process.env.GOOGLE_API_KEY,
          },
        }).action()
      ).data?.response;
      console.log('Google gemini response', sql_query);

      //        response: '```sql\n' +
      // 'SELECT count(*)\n' +
      // 'FROM users\n' +
      // 'WHERE\n' +
      // "  created_at >= NOW() - INTERVAL '30 day';\n" +
      // '```',

      // Find everything between ```sql\n and ``` or ```postgresql\n and ```
      const sqlMatch = sql_query?.match(
        /```(?:sql|postgresql)\n([\s\S]*?)\n```/
      );
      const clean_query = sqlMatch ? sqlMatch[1].trim() : null;

      if (!clean_query) {
        throw new Error('No query found');
      }

      console.log(clean_query);

      // Execute the query
      const result = await new PostgreSQLBubble({
        query: clean_query,
        ignoreSSL: true,
        credentials: {
          DATABASE_CRED: process.env.BUBBLE_CONNECTING_STRING_URL,
        },
      }).action();

      if (!result.success) {
        throw new Error(result.error);
      }

      // Print the result
      console.log('Query result:', result.data);

      // Step 3: Find the "staging-bot" channel
      const channelsResult = await new SlackBubble({
        operation: 'list_channels',
        credentials: {
          SLACK_CRED: process.env.SLACK_TOKEN,
        },
      }).action();

      if (!channelsResult.success) {
        throw new Error(`Failed to list channels: ${channelsResult.error}`);
      }

      const stagingBotChannel = channelsResult.data?.channels?.find(
        (channel) => channel.name === 'staging-bot'
      );

      if (!stagingBotChannel) {
        throw new Error('staging-bot channel not found');
      }

      console.log('Found staging-bot channel:', stagingBotChannel.id);

      // Step 4: Create another AI agent to format the user query to user-friendly analysis
      const formattedAnalysis = (
        await new AIAgentBubble({
          message: `Original user query: "${userQuery}"
          
Database query result: ${JSON.stringify(result.data, null, 2)}

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
          credentials: {
            GOOGLE_GEMINI_CRED: process.env.GOOGLE_API_KEY,
          },
        }).action()
      ).data?.response;

      console.log('Formatted analysis:', formattedAnalysis);

      if (!formattedAnalysis) {
        throw new Error('Failed to generate formatted analysis');
      }

      // Step 5: Send the formatted message to the staging-bot channel
      const slackResult = await new SlackBubble({
        operation: 'send_message',
        token: process.env.SLACK_TOKEN!,
        channel: stagingBotChannel.id,
        text: `📊 **Data Analysis Result**\n\n${formattedAnalysis}`,
        credentials: {
          SLACK_CRED: process.env.SLACK_TOKEN,
        },
      }).action();

      if (!slackResult.success) {
        throw new Error(`Failed to send Slack message: ${slackResult.error}`);
      }

      console.log('✅ Successfully sent analysis to staging-bot channel');
      console.log('Slack message timestamp:', slackResult.data?.ts);

      // Verify the test completed all steps
      expect(result.success).toBe(true);
      expect(channelsResult.success).toBe(true);
      expect(stagingBotChannel).toBeDefined();
      expect(formattedAnalysis).toBeDefined();
      expect(slackResult.success).toBe(true);
    }, 300000);
  });
});
describe('AI Agent with tool hooks', () => {
  test('should execute a tool with hooks', async () => {
    const result = await new AIAgentBubble({
      systemPrompt:
        'You are a helpful assistant that can answer questions about the slack.',
      message: 'follow system prompt',
      beforeToolCall: async (context) => {
        if (context.toolName === 'get-bubble-details-tool') {
          console.log('Modifying tool input............');
          context.toolInput = {
            bubbleName: 'hello-world',
          };
        }
        return {
          messages: context.messages,
          toolInput: context.toolInput as Record<string, any>,
        };
      },
      afterToolCall: async (context) => {
        //Replace the tool call with custom output
        context.messages = context.messages.map((m) => {
          if (m.getType() === 'tool') {
            m.content = 'Slack is not a recommended platform';
          }
          return m;
        });
        return context.messages;
      },
      tools: [
        { name: 'list-bubbles-tool' },
        { name: 'get-bubble-details-tool' },
      ],
      credentials: {
        GOOGLE_GEMINI_CRED: process.env.GOOGLE_API_KEY,
      },
    }).action();
    expect(result.success).toBe(true);
    expect(result.data?.response).toBeDefined();
    expect(result.data?.response).toContain('Slack');
  });
});
