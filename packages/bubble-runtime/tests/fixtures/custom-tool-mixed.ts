import { z } from 'zod';
import {
  BubbleFlow,
  GoogleDriveBubble,
  AIAgentBubble,
  SlackBubble,
  GoogleCalendarBubble,
  type SlackMentionEvent,
} from '@bubblelab/bubble-core';

export interface Output {
  /** The final response sent to Slack. */
  response: string;
  /** The Slack channel where the response was posted. */
  channelId: string;
  /** The timestamp of the thread where the response was posted. */
  threadTs: string;
}

/**
 * A Slack bot that answers questions by referencing a specific Google Doc as its knowledge base.
 * When mentioned in a channel, it retrieves the document content, maintains conversation context
 * from the thread, and provides an AI-generated response using Gemini 2.5 Flash.
 */
export class SlackKnowledgeBot extends BubbleFlow<'slack/bot_mentioned'> {
  async handle(payload: SlackMentionEvent): Promise<Output> {
    const { text, channel, thread_ts, slack_event } = payload;

    // Use the thread_ts if it exists (meaning we are already in a thread),
    // otherwise use the event's ts to start a new thread.
    const activeThreadTs =
      thread_ts ||
      (slack_event as unknown as { event: { ts: string } }).event?.ts;

    // Downloads the knowledge base content from the specified Google Doc.
    const docContent = await this.getKnowledgeBaseContent(
      '11YWBOYFRDe3C6qj5Qei2QxUJrbVEPIsC-BQC2vT6wjk'
    );

    // Retrieves the conversation history from the Slack thread to provide context.
    const history = await this.getThreadHistory(channel, activeThreadTs);

    // Processes the user's query against the document content and history using AI.
    const aiResponse = await this.generateAIResponse(text, docContent, history);

    // Sends the generated response back to the Slack channel as a threaded reply.
    await this.sendSlackReply(channel, activeThreadTs, aiResponse);

    return {
      response: aiResponse,
      channelId: channel,
      threadTs: activeThreadTs,
    };
  }

  /**
   * Downloads the content of the specified Google Doc as plain text to use as the knowledge base.
   */
  private async getKnowledgeBaseContent(fileId: string): Promise<string> {
    // Downloads the Google Doc and exports it as plain text. The fileId is hardcoded
    // as per the user's selection of the "Test Document". This content serves as
    // the primary source of truth for the AI agent's responses.
    const drive = new GoogleDriveBubble({
      operation: 'download_file',
      file_id: fileId,
      export_format: 'text/plain',
    });

    const result = await drive.action();

    if (!result.success || !result.data?.content) {
      throw new Error(
        `Failed to retrieve knowledge base: ${result.error || 'No content found'}`
      );
    }

    return result.data.content;
  }

  /**
   * Fetches the message history of the current Slack thread to provide context to the AI.
   * Condition: Only runs if a thread timestamp is available.
   */
  private async getThreadHistory(
    channel: string,
    threadTs?: string
  ): Promise<{ role: 'user' | 'assistant'; content: string }[]> {
    if (!threadTs) return [];

    // Retrieves all messages in the specified thread. This allows the bot to understand
    // the context of the ongoing conversation, ensuring that its responses are
    // relevant to previous exchanges within the same thread.
    const slack = new SlackBubble({
      operation: 'get_thread_replies',
      channel: channel,
      ts: threadTs,
      limit: 20,
    });

    const result = await slack.action();

    if (!result.success || !result.data?.messages) {
      return [];
    }

    // Map Slack messages to AI conversation history format.
    // We exclude the very last message because it's the current mention being processed.
    const messages = result.data.messages;
    const historyMessages = messages.slice(0, -1);

    return historyMessages.map((msg) => ({
      role: msg.bot_id ? 'assistant' : 'user',
      content: msg.text || '',
    }));
  }

  /**
   * Uses Gemini 2.5 Flash to generate a response based on the document content and conversation history.
   * The AI agent has access to SQL query tool and calendar lookup tool, enabling it to run database queries
   * and check team calendars when needed to answer questions.
   */
  private async generateAIResponse(
    query: string,
    context: string,
    history: { role: 'user' | 'assistant'; content: string }[]
  ): Promise<string> {
    // Configures the AI agent with the document content as its primary knowledge source.
    // Using google/gemini-2.5-flash-lite for fast, efficient responses as requested.
    // The system prompt instructs the AI to be flexible, prioritizing the doc but using general knowledge.
    // The conversationHistory parameter is used to maintain context across multi-turn interactions.
    // The tools array enables the agent to query a PostgreSQL database when relevant information
    // might be stored in the database - the agent will automatically decide when to use SQL queries.
    // The customTools array adds a calendar lookup tool that allows the bot to check team calendars
    // for availability, upcoming events, and meeting schedules across the entire team.
    const agent = new AIAgentBubble({
      message: query,
      conversationHistory: history,
      systemPrompt: `You are a helpful Slack bot. Use the following document content as your primary knowledge base to answer the user's question. 
      
      DOCUMENT CONTENT:
      ${context}
      
      INSTRUCTIONS:
      - Prioritize the information in the document.
      - If the answer isn't in the document, you may use your general knowledge to be helpful, but clearly state if the information is not from the provided source.
      - You have access to a SQL database. If the question requires database information, use the sql-query-tool to query it.
      - You have access to the team's Google Calendar. If the question is about schedules, availability, or upcoming meetings, use the calculate-tax tool.
      - Keep your responses concise and suitable for a Slack message.
      - Maintain a professional and friendly tone.`,
      model: {
        model: 'google/gemini-3-flash-preview',
        temperature: 0.7,
      },
      tools: [
        {
          name: 'sql-query-tool',
        },
      ],
      customTools: [
        {
          name: 'calendar-lookup-tool',
          description:
            'Look up calendar events for the entire team. You can search by date range, event title, or attendees. Returns event details including time, location, attendees, and meeting links.',
          schema: {
            time_min: z
              .string()
              .optional()
              .describe(
                'Start date/time in RFC3339 format (e.g., 2026-01-19T00:00:00-08:00). If not provided, defaults to now.'
              ),
            time_max: z
              .string()
              .optional()
              .describe(
                'End date/time in RFC3339 format (e.g., 2026-01-26T23:59:59-08:00). If not provided, defaults to 7 days from now.'
              ),
            search_query: z
              .string()
              .optional()
              .describe(
                'Free text search to filter events by title, description, or location.'
              ),
            max_results: z
              .number()
              .optional()
              .default(20)
              .describe('Maximum number of events to return. Defaults to 20.'),
          },
          func: async (params: {
            time_min?: string;
            time_max?: string;
            search_query?: string;
            max_results?: number;
          }) => {
            const gcal = new GoogleCalendarBubble({
              operation: 'list_events',
              calendar_id: 'primary',
              time_min: params.time_min,
              time_max: params.time_max,
              q: params.search_query,
              single_events: true,
              order_by: 'startTime',
              max_results: params.max_results || 20,
            });

            const result = await gcal.action();

            if (!result.success) {
              return {
                error: result.error || 'Failed to retrieve calendar events',
                events: [],
              };
            }

            const events = result.data?.events || [];

            // Format events into a user-friendly structure
            const formattedEvents = events.map((event) => ({
              title: event.summary || 'Untitled Event',
              start: event.start?.dateTime || event.start?.date || 'Unknown',
              end: event.end?.dateTime || event.end?.date || 'Unknown',
              location: event.location || 'No location',
              attendees:
                event.attendees?.map((a) => a.email).join(', ') ||
                'No attendees',
              meetLink:
                event.hangoutLink || event.conferenceData
                  ? 'Has conference link'
                  : 'No meeting link',
              description: event.description || 'No description',
            }));

            return {
              success: true,
              count: formattedEvents.length,
              events: formattedEvents,
            };
          },
        },
      ],
    });

    const result = await agent.action();

    if (!result.success || !result.data?.response) {
      throw new Error(
        `AI Agent failed: ${result.error || 'No response generated'}`
      );
    }

    return result.data.response;
  }

  /**
   * Posts the generated AI response back to the Slack channel, ensuring it appears in the correct thread.
   */
  private async sendSlackReply(
    channel: string,
    threadTs: string,
    text: string
  ): Promise<void> {
    // Sends the final answer back to Slack. By providing the thread_ts, we ensure
    // the bot's response is nested within the conversation thread, keeping the
    // channel organized and the context clear for all users.
    const slack = new SlackBubble({
      operation: 'send_message',
      channel: channel,
      text: text,
      thread_ts: threadTs,
    });

    const result = await slack.action();

    if (!result.success) {
      throw new Error(`Failed to send Slack message: ${result.error}`);
    }
  }
}
