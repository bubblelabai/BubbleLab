import {
  // Base classes
  BubbleFlow,

  // Service Bubbles
  AIAgentBubble,
  PostgreSQLBubble,
  SlackBubble,

  // Event Types
  type WebhookEvent,
  type CronEvent,
} from '@bubblelab/bubble-core';

export interface Output {
  message: string;
}

export interface CustomCronPayload extends CronEvent {
  /**
   * Slack channel name or ID where execution reports should be sent.
   * Find it by right-clicking the channel → "View channel details" → Copy the "Channel ID" (starts with 'C')
   * @canBeFile false
   */
  slackChannel: string;
}

export class ExecutionMonitorCron extends BubbleFlow<'schedule/cron'> {
  // Runs every 30 minutes to check for new BubbleFlow executions
  readonly cronSchedule = '*/30 * * * *';

  // Fetches execution records from the database for the last 30 minutes, excluding BubbleLab team members
  private async fetchExecutions(thirtyMinutesAgo: string) {
    const pgBubble = new PostgreSQLBubble({
      query: `
          SELECT 
            execution_id,
            flow_name,
            status,
            started_at,
            first_name,
            email,
            code,
            error,
            payload
          FROM public.bubble_flow_executions_with_user
          WHERE started_at >= $1 AND NOT (email LIKE '%@bubblelab.ai')
          ORDER BY email, started_at DESC;
        `,
      parameters: [thirtyMinutesAgo],
      allowedOperations: ['SELECT'],
    });

    const result = await pgBubble.action();

    if (!result.success) {
      throw new Error(`PostgreSQL query failed: ${result.error}`);
    }

    return result.data.rows;
  }

  // Groups executions by user email, creating a map where each key is a user email and value is an array of their executions
  private groupExecutionsByUser(executions: Record<string, unknown>[]) {
    const userGroups = new Map<string, Record<string, unknown>[]>();

    for (const execution of executions) {
      const email = execution.email as string;
      if (!userGroups.has(email)) {
        userGroups.set(email, []);
      }
      userGroups.get(email)!.push(execution);
    }

    return userGroups;
  }

  // Analyzes a single user's executions using AI to create a formatted Slack message with flow summaries and failure diagnostics
  // Uses flash-lite model for cost efficiency since this is a simple formatting task
  private async analyzeUserExecutions(
    email: string,
    executions: Record<string, unknown>[]
  ) {
    const formatterAgent = new AIAgentBubble({
      model: {
        model: 'google/gemini-2.5-flash-lite',
        temperature: 0.7,
      },
      systemPrompt: `You are a helpful assistant that formats execution reports for Slack.
  
  Create a nicely formatted section for this user's BubbleFlow executions.
  
  Instructions:
  - Group executions by flow name
  - For each execution, list: flow name, status, and start time
  - Analyze the code and provide a 2-sentence summary of what the flow does
  - If there's a failure, explain why it likely failed and provide a 2-sentence fix suggestion
  - Use Slack markdown: *bold*, _italic_, \`code\`, \`\`\`code blocks\`\`\`, and > quotes
  - Make it clean, scannable, and easy to read`,
      message: `
  User: ${email}
  
  Executions:
  ${JSON.stringify(executions, null, 2)}
        `,
    });

    const result = await formatterAgent.action();

    if (!result.success) {
      throw new Error(
        `Failed to analyze executions for ${email}: ${result.error}`
      );
    }

    return result.data.response;
  }

  // Sends the formatted execution report to Slack, combining all user analyses into a single message
  private async sendSlackReport(
    slackChannel: string,
    userReports: string[],
    totalExecutions: number,
    timeRange: string
  ) {
    const header = `🚀 *BubbleFlow Execution Report*\n_${timeRange}_\n*Total Executions:* ${totalExecutions}\n`;
    const combinedMessage = `${header}\n${userReports.join('\n\n━━━━━━━━━━━━━━━━━━━━\n\n')}`;

    const slackBubble = new SlackBubble({
      operation: 'send_message',
      channel: slackChannel,
      text: combinedMessage,
    });

    const slackResult = await slackBubble.action();

    if (!slackResult.success) {
      throw new Error(`Failed to send Slack message: ${slackResult.error}`);
    }

    return `Successfully sent notification for ${totalExecutions} new executions to ${slackChannel}.`;
  }

  async handle(payload: CustomCronPayload): Promise<Output> {
    const { slackChannel } = payload;

    const thirtyMinutesAgo = new Date(
      Date.now() - 30 * 60 * 1000
    ).toISOString();
    const timeRange = `Last 30 minutes (since ${new Date(thirtyMinutesAgo).toLocaleString()})`;

    // Step 1: Fetch executions from database
    const executions = await this.fetchExecutions(thirtyMinutesAgo);

    if (executions.length === 0) {
      return {
        message: 'No new executions found in the last 30 minutes.',
      };
    }

    // Step 2: Group executions by user
    const userGroups = this.groupExecutionsByUser(executions);

    // Step 3: Process each user's executions in parallel
    const userReportPromises = [...userGroups.entries()].map(
      ([email, userExecutions]) =>
        this.analyzeUserExecutions(email, userExecutions)
    );

    const userReports = await Promise.all(userReportPromises);

    // Step 4: Send combined report to Slack
    const resultMessage = await this.sendSlackReport(
      slackChannel,
      userReports,
      executions.length,
      timeRange
    );

    return { message: resultMessage };
  }
}
