import { z } from 'zod';
import { WorkflowBubble } from '../../types/workflow-bubble-class.js';
import type { BubbleContext } from '../../types/bubble.js';
import { SlackBubble } from '../service-bubble/slack';
import { DatabaseAnalyzerWorkflowBubble } from './database-analyzer.workflow.js';
import { AIAgentBubble } from '../service-bubble/ai-agent.js';
import { SlackFormatterAgentBubble } from './slack-formatter-agent.js';
import { CredentialType, RECOMMENDED_MODELS } from '@bubblelab/shared-schemas';
import { AvailableModels } from '@bubblelab/shared-schemas';

// Define the parameters schema for the Slack Data Assistant workflow
const SlackDataAssistantParamsSchema = z.object({
  // Slack configuration
  slackChannel: z
    .string()
    .min(1)
    .describe('Slack channel ID where the bot will respond'),
  slackThreadTs: z
    .string()
    .optional()
    .describe('Thread timestamp if replying to a thread'),
  userQuestion: z.string().min(1).describe('The user question from Slack'),
  userName: z
    .string()
    .optional()
    .describe('Name of the user asking the question'),
  name: z
    .string()
    .default('Data Assistant')
    .describe(
      'Name of the AI assistant (e.g., "DataBot", "Analytics Assistant")'
    ),

  // Database configuration
  dataSourceType: z
    .enum(['postgresql', 'mysql', 'sqlite', 'mariadb', 'mssql'])
    .default('postgresql')
    .describe('Type of database to analyze'),
  databaseUrl: z
    .string()
    .optional()
    .describe('Database connection URL (if not using credentials)'),
  ignoreSSLErrors: z
    .boolean()
    .default(false)
    .describe('Ignore SSL certificate errors for database connection'),

  // AI configuration
  aiModel: AvailableModels.default('google/gemini-2.5-flash').describe(
    'AI model to use for query generation'
  ),
  temperature: z
    .number()
    .min(0)
    .max(2)
    .default(0.3)
    .describe('Temperature for AI responses (lower = more focused)'),

  // Response configuration
  verbosity: z
    .enum(['1', '2', '3', '4', '5'])
    .default('3')
    .describe('Response verbosity level (1=concise, 5=comprehensive)'),
  technicality: z
    .enum(['1', '2', '3', '4', '5'])
    .default('2')
    .describe('Technical complexity level (1=plain English, 5=expert)'),
  includeQuery: z
    .boolean()
    .default(true)
    .describe('Include the SQL query in the response'),
  includeExplanation: z
    .boolean()
    .default(true)
    .describe('Include query explanation in the response'),

  // Injected metadata from user credentials (database schema notes and rules)
  injectedMetadata: z
    .object({
      tables: z.record(z.string(), z.record(z.string(), z.string())).optional(),
      tableNotes: z.record(z.string(), z.string()).optional(),
      rules: z.array(z.string()).optional(),
    })
    .optional()
    .describe(
      'Additional database context injected from user credentials metadata'
    ),
  additionalContext: z
    .string()
    .optional()
    .describe('Additional context about how to answer the question'),
  maxQueries: z
    .number()
    .default(20)
    .describe('Maximum number of queries to run'),
  // Credentials
  credentials: z
    .record(z.nativeEnum(CredentialType), z.string())
    .optional()
    .describe('Credentials for various services'),
});

// Define the result schema
const SlackDataAssistantResultSchema = z.object({
  success: z.boolean().describe('Whether the workflow completed successfully'),
  error: z.string().describe('Error message if workflow failed'),
  query: z.string().optional().describe('Generated SQL query'),
  queryExplanation: z.string().optional().describe('Explanation of the query'),
  queryResults: z
    .array(z.record(z.unknown()))
    .optional()
    .describe('Results from the database query'),
  formattedResponse: z
    .string()
    .optional()
    .describe('Formatted response for Slack'),
  slackBlocks: z
    .array(z.unknown())
    .optional()
    .describe('Slack block kit formatted message'),
  slackMessageTs: z
    .string()
    .optional()
    .describe('Timestamp of sent Slack message'),
  isDataQuestion: z
    .boolean()
    .optional()
    .describe('Whether the question was data-related'),
  metadata: z
    .object({
      executionTime: z
        .number()
        .describe('Total execution time in milliseconds'),
      rowCount: z.number().optional().describe('Number of rows returned'),
      wordCount: z.number().optional().describe('Word count of response'),
    })
    .optional(),
});

type SlackDataAssistantParams = z.input<typeof SlackDataAssistantParamsSchema>;
type SlackDataAssistantResult = z.output<typeof SlackDataAssistantResultSchema>;

export class SlackDataAssistantWorkflow extends WorkflowBubble<
  SlackDataAssistantParams,
  SlackDataAssistantResult
> {
  static readonly type = 'workflow' as const;
  static readonly service = 'slack-data-assistant';
  static readonly bubbleName = 'slack-data-assistant';
  static readonly schema = SlackDataAssistantParamsSchema;
  static readonly resultSchema = SlackDataAssistantResultSchema;
  static readonly shortDescription =
    'AI-powered Slack bot that answers data questions by querying databases';
  static readonly longDescription = `
    A comprehensive workflow that creates an intelligent Slack bot capable of:
    - Receiving questions from Slack mentions
    - Analyzing database schema
    - Generating appropriate SQL queries using AI
    - Executing queries safely (read-only)
    - Formatting results in a user-friendly way
    - Responding in Slack with rich block formatting
    
    Perfect for:
    - Business intelligence chat-bots
    - Data analytics assistants
    - Database query automation
    - Self-service data access
  `;
  static readonly alias = 'slack-data-bot';

  constructor(params: SlackDataAssistantParams, context?: BubbleContext) {
    super(params, context);
  }

  /**
   * Extract first name from a full name string
   */
  private extractFirstName(fullName: string): string {
    if (!fullName) return '';
    return fullName.trim().split(/\s+/)[0];
  }

  /**
   * Clean bot name by removing common suffixes and formatting
   */
  private cleanBotName(botName: string): string {
    if (!botName) return 'Bot';

    // Remove common bot suffixes (case insensitive)
    const cleaned = botName.replace(/\s*(bot|Bot|BOT)$/g, '').trim();

    // If we removed everything, fallback to original or 'Bot'
    if (!cleaned) return botName || 'Bot';

    // Take first word if multiple words
    return this.extractFirstName(cleaned);
  }

  /**
   * Clean username by converting formats like "john.doe" to "John"
   */
  private cleanUsername(username: string): string {
    if (!username) return '';

    // Handle dot notation (john.doe -> John)
    const parts = username.split(/[._-]/);
    const firstName = parts[0];

    // Capitalize first letter
    return firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase();
  }

  /**
   * Generate a readable name from a Slack user ID when API calls fail
   * Converts "U07UTL8MA9Y" to "User07" etc.
   */
  private generateReadableNameFromUserId(userId: string): string {
    if (!userId) return 'User';

    // Extract meaningful part from user ID (U07UTL8MA9Y -> 07UTL8MA9Y)
    const idPart = userId.replace(/^U/, '');

    // Take first few characters to make it readable but not too long
    const shortId = idPart.substring(0, 4);

    return `User${shortId}`;
  }

  protected async performAction(): Promise<SlackDataAssistantResult> {
    const startTime = Date.now();
    let additionalError = '';

    try {
      // Step 1: Fetch thread history if this is a threaded conversation
      let threadContext = '';
      if (this.params.slackThreadTs) {
        try {
          // Use the new get_thread_replies operation to get all messages in the thread
          const threadReplies = new SlackBubble(
            {
              operation: 'get_thread_replies',
              channel: this.params.slackChannel,
              ts: this.params.slackThreadTs,
              limit: 100, // Get up to 100 messages in the thread
              credentials: this.params.credentials,
            },
            this.context,
            'threadReplies'
          );

          const threadResult = await threadReplies.action();

          if (threadResult.success && threadResult.data?.messages) {
            const allMessages = threadResult.data.messages;

            // Sort messages chronologically (should already be sorted, but be safe)
            allMessages.sort(
              (a, b) => parseFloat(a.ts ?? '0') - parseFloat(b.ts ?? '0')
            );

            // Build thread context with user lookups if needed
            if (allMessages.length > 1) {
              // More than just the current message
              threadContext = '\n\nPrevious messages in this thread:\n';

              // Cache for user lookups to avoid repeated API calls
              const userCache = new Map<string, string>();

              for (const msg of allMessages) {
                let senderName = 'Bot';

                if (msg.user) {
                  // Check cache first
                  if (userCache.has(msg.user)) {
                    senderName = userCache.get(msg.user)!;
                  } else {
                    // Try to get user info and extract first name, but handle missing scope gracefully
                    try {
                      const userInfo = new SlackBubble(
                        {
                          operation: 'get_user_info',
                          user: msg.user,
                          credentials: this.params.credentials,
                        },
                        this.context,
                        'userInfo'
                      );

                      const userResult = await userInfo.action();
                      if (userResult.success && userResult.data?.user) {
                        const user = userResult.data.user;

                        // Priority order for extracting first name
                        let firstName = '';

                        if (user.profile?.first_name) {
                          firstName = user.profile.first_name;
                        } else if (user.profile?.display_name) {
                          firstName = this.extractFirstName(
                            user.profile.display_name
                          );
                        } else if (user.profile?.real_name) {
                          firstName = this.extractFirstName(
                            user.profile.real_name
                          );
                        } else if (user.real_name) {
                          firstName = this.extractFirstName(user.real_name);
                        } else if (user.name) {
                          firstName = this.cleanUsername(user.name);
                        }

                        senderName = firstName || this.cleanUsername(msg.user);
                      } else {
                        // API call failed (likely missing_scope), generate readable name from user ID
                        senderName = this.generateReadableNameFromUserId(
                          msg.user
                        );
                      }
                    } catch {
                      // API call failed, generate readable name from user ID
                      senderName = this.generateReadableNameFromUserId(
                        msg.user
                      );
                    }

                    // Cache the result
                    userCache.set(msg.user, senderName);
                  }
                } else if (msg.bot_id || msg.bot_profile) {
                  // This is a bot message - extract clean bot name
                  const botName =
                    (msg.bot_profile as { name?: string })?.name ||
                    (msg.username as string);
                  senderName = this.cleanBotName(botName);
                }

                const text = msg.text || '';
                // Skip the current message being processed, but include all other messages
                if (text !== this.params.userQuestion && text.trim() !== '') {
                  threadContext += `- ${senderName}: ${text}\n`;
                }
              }
            }
          } else {
            additionalError += `Warning: Failed to get context from thread: ${threadResult.error || 'Unknown error'}. This means I am unable to answer the question with the context of the thread.`;
          }
        } catch {
          // Continue without thread context if fetching fails
        }
      }

      // Step 2: Analyze database schema
      const schemaAnalyzer = new DatabaseAnalyzerWorkflowBubble(
        {
          dataSourceType: 'postgresql',
          ignoreSSLErrors: this.params.ignoreSSLErrors,
          includeMetadata: true,
          injectedMetadata: this.params.injectedMetadata,
          credentials: this.params.credentials,
        },
        this.context
      );
      const schemaResult = await schemaAnalyzer.action();
      if (!schemaResult.success || !schemaResult.data?.databaseSchema) {
        throw new Error(
          `Failed to analyze database schema: ${schemaResult.error || 'Unknown error'}, Please contact Nodex support if this persists.`
        );
      }

      // Step 3: Use AI agent with SQL query tool to analyze data
      const dataAnalysisPrompt = `You are a data analyst helping a colleague answer this question: "${this.params.userQuestion}"

Here is the context of the thread, take it into account when answering the question:
${threadContext}

Database schema:
${schemaResult.data.databaseSchema.cleanedJSON}

Additional context:
${this.params.additionalContext}

You have access to these tools:
1. SQL query tool - execute read-only queries to explore and analyze data

Use these tools to:
1. Explore the data to understand what's available
2. Run targeted queries to answer the specific question  
4. Gather additional context if needed
5. You can run multiple queries to build a complete picture
6. IMPORTANT: You are only allowed up to ${(this.params.maxQueries ?? 5) / 2} queries. Do not make make queries that would return more than 20 rows. You should aggregate the data - no returning entire tables.

For each query, provide reasoning about why you're running it and what you hope to learn.
After running your queries, provide a comprehensive answer to the user's question based on all the data you've gathered.`;

      const dataAnalyst = new AIAgentBubble(
        {
          message: dataAnalysisPrompt,
          model: {
            model: this.params.aiModel ?? RECOMMENDED_MODELS.FAST,
            temperature: this.params.temperature,
          },
          systemPrompt:
            'You are a helpful data analyst who uses SQL queries to answer questions and creates visualizations to make data insights clear. Use charts when they help explain trends, comparisons, or patterns in the data.',
          tools: [
            {
              name: 'sql-query-tool',
              credentials: this.params.credentials,
            },
          ],
          maxIterations: this.params.maxQueries,
          credentials: this.params.credentials,
        },
        this.context
      );

      const analysisResponse = await dataAnalyst.action();
      if (!analysisResponse.success || !analysisResponse.data?.response) {
        throw new Error(
          `Hey, I'm having trouble analyzing data: ${analysisResponse.error || 'Unknown error'}, Please contact Nodex support if this persists.`
        );
      }

      // Extract all SQL query tool calls and aggregate results
      const toolCalls = analysisResponse.data.toolCalls || [];
      const sqlToolCalls = toolCalls.filter(
        (call) => call.tool === 'sql-query-tool'
      );

      // Aggregate all query results
      const aggregatedResults = this.aggregateQueryResults(sqlToolCalls);
      const totalRows = aggregatedResults.reduce(
        (sum: number, result: any) => sum + (result.rowCount || 0),
        0
      );

      // Step 4: Prepare aggregated data for formatting
      const hasDataResults = sqlToolCalls.length > 0;
      const allQueryResults = aggregatedResults.flatMap(
        (result) => result.rows || []
      );
      const totalRowCount = totalRows;

      // Step 5: Format comprehensive response with all analysis
      let messageContent = `Question: ${this.params.userQuestion}\n\n`;
      messageContent += `You have already analyzed the data and journaled your findings:\n${analysisResponse.data.response}\n\n`;

      if (hasDataResults) {
        messageContent += `Data Summary:\n`;
        messageContent += `• Executed ${sqlToolCalls.length} SQL queries\n`;
        messageContent += `• Analyzed ${totalRowCount} total rows\n`;

        // Add sample results if available
        if (allQueryResults.length > 0) {
          const sampleResults = allQueryResults.slice(0, 5);
          messageContent += `\n📊 Sample Data (first 5 rows):\n${JSON.stringify(sampleResults, null, 2)}\n`;
        }

        // Add queries if requested
        if (this.params.includeQuery) {
          messageContent += `\n🔍 SQL Queries Executed:\n`;
          sqlToolCalls.forEach((call, index) => {
            const queryInput = call.input as {
              reasoning?: string;
              query: string;
            };
            messageContent += `${index + 1}. ${queryInput.reasoning || 'Data analysis query'}\n`;
            messageContent += `\`\`\`sql\n${queryInput.query}\n\`\`\`\n`;
          });
        }
      } else {
        messageContent += `Note: This question didn't require database queries - the answer was based on general knowledge.\n`;
      }

      // Step 6: Format with Slack formatter agent
      const contextWithName = `You are ${this.params.name}, a data scientist who excels at answering questions about data.${this.params.additionalContext ? ` ${this.params.additionalContext}` : ''}`;

      const slackFormatter = new SlackFormatterAgentBubble(
        {
          message: messageContent,
          verbosity: this.params.verbosity,
          technicality: this.params.technicality,
          includeBlockKit: true,
          includeQuery: this.params.includeQuery,
          includeExplanation: this.params.includeExplanation,
          additionalContext: contextWithName,
          model: {
            model: 'google/gemini-2.5-flash',
            temperature: 0.7,
            maxTokens: 50000,
          },
          credentials: this.params.credentials,
        },
        this.context
      );

      const formatterResult = await slackFormatter.action();

      if (!formatterResult.success) {
        throw new Error(
          `Hey, I'm having trouble formatting the response for Slack: ${formatterResult.error || 'Unknown error'}, Please contact Nodex support if this persists.`
        );
      }

      // Step 7: Send to Slack
      const blocksToSend = formatterResult.data?.blocks
        ? [
            ...formatterResult.data.blocks,
            ...(additionalError
              ? [
                  {
                    type: 'divider' as const,
                  },
                  {
                    type: 'section' as const,
                    text: {
                      type: 'mrkdwn' as const,
                      text: `⚠️ *Warning*\n\`\`\`${additionalError}\`\`\``,
                    },
                  },
                ]
              : []),
          ]
        : additionalError
          ? [
              {
                type: 'section' as const,
                text: {
                  type: 'mrkdwn' as const,
                  text: `⚠️ *Warning*\n\`\`\`${additionalError}\`\`\``,
                },
              },
            ]
          : undefined;

      const slackSender = new SlackBubble(
        {
          operation: 'send_message',
          channel: this.params.slackChannel,
          text: formatterResult.data?.response || messageContent,
          blocks: blocksToSend,
          thread_ts: this.params.slackThreadTs,
          credentials: this.params.credentials,
        },
        this.context,
        'slackSender'
      );

      const slackResult = await slackSender.action();
      if (!slackResult.success) {
        throw new Error(
          `Hey, I'm having trouble sending the message to Slack: ${slackResult.error || 'Unknown error'}, Please contact Nodex support if this persists.`
        );
      }

      // Calculate execution time
      const executionTime = Date.now() - startTime;

      return {
        success: true,
        error: '',
        query: sqlToolCalls
          .map((call) => (call.input as { query: string }).query)
          .join('; '),
        queryExplanation: `Executed ${sqlToolCalls.length} queries for comprehensive analysis`,
        queryResults: allQueryResults,
        formattedResponse: formatterResult.data?.response,
        slackBlocks: formatterResult.data?.blocks,
        slackMessageTs: slackResult.data?.message?.ts,
        isDataQuestion: hasDataResults,
        metadata: {
          executionTime,
          rowCount: totalRowCount,
          wordCount: formatterResult.data?.metadata.wordCount || 0,
        },
      };
    } catch (error) {
      // Try to send error message to Slack
      try {
        const errorSender = new SlackBubble(
          {
            operation: 'send_message',
            channel: this.params.slackChannel,
            text:
              error instanceof Error ? error.message : 'Unknown error occurred',
            thread_ts: this.params.slackThreadTs,
            credentials: this.params.credentials,
          },
          this.context,
          'errorSender'
        );

        await errorSender.action();
      } catch {
        // Ignore Slack send errors
      }

      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
        metadata: {
          executionTime: Date.now() - startTime,
        },
      };
    }
  }

  private aggregateQueryResults(
    sqlToolCalls: Array<{ tool: string; input?: unknown; output?: unknown }>
  ): Array<{
    rowCount: number;
    rows?: Record<string, unknown>[];
    summary?: string;
  }> {
    return sqlToolCalls.map((call) => {
      const output = call.output as
        | { rowCount?: number; rows?: Record<string, unknown>[] }
        | undefined;
      return {
        rowCount: output?.rowCount || 0,
        rows: output?.rows || [],
        summary: `Query returned ${output?.rowCount || 0} rows`,
      };
    });
  }
}
