import { z } from 'zod';
import {
  BubbleFlow,
  AIAgentBubble,
  type WebhookEvent,
} from '@bubblelab/bubble-core';

export interface Output {
  /** The natural language response from the AI agent based on the database data. */
  answer: string;
  /** The SQL queries executed by the agent (if available/exposed, otherwise just the answer). */
  processed: boolean;
}

export interface ChatWithDatabasePayload extends WebhookEvent {
  /** The question you want to ask your database. */
  question: string;

  /**
   * The PostgreSQL connection string.
   * Format: postgresql://user:password@host:port/database
   * You can find this in your database provider's dashboard (e.g., Supabase, Neon, AWS RDS).
   */
  connectionString: string;

  /**
   * Optional description of your database schema.
   * Providing table names and column descriptions helps the AI generate accurate queries.
   * Example: "Users table has id, name, email. Orders table has id, user_id, amount."
   */
  schemaContext?: string;
}

export class ChatWithDatabaseFlow extends BubbleFlow<'webhook/http'> {
  // Atomic function: Process the question using AI Agent with SQL Tool
  private async processChat(
    question: string,
    connectionString: string,
    schemaContext?: string
  ): Promise<string> {
    // Construct the system prompt with schema context if available
    let systemPrompt = `You are a helpful database assistant. You have access to a SQL query tool.
Your goal is to answer the user's question by querying the database.
1. Always use read-only queries (SELECT).
2. Provide the final answer in natural language based on the query results.
3. If the query returns no results, state that clearly.
4. Do not expose sensitive data (like passwords) in your final answer.`;

    if (schemaContext) {
      systemPrompt += `\n\nHere is the database schema context:\n${schemaContext}`;
    } else {
      systemPrompt += `\n\nYou do not have the schema context. You may need to query 'information_schema' tables first to understand the table structure before answering the user's question.`;
    }

    // The AI Agent uses the sql-query-tool to interact with the database.
    // We pass the connectionString in the credentials object so the tool can connect.
    // Using google/gemini-3-pro-preview for better reasoning and SQL generation capabilities.
    const agent = new AIAgentBubble({
      model: { model: 'google/gemini-3-pro-preview' },
      systemPrompt: systemPrompt,
      message: question,
      tools: [
        {
          name: 'sql-query-tool',
          credentials: { connectionString } as any,
        },
      ],
    });

    const result = await agent.action();

    if (!result.success) {
      throw new Error(`AI Agent failed: ${result.error}`);
    }

    return result.data.response;
  }

  // Atomic function: Format the output
  private formatOutput(answer: string): Output {
    return {
      answer,
      processed: true,
    };
  }

  async handle(payload: ChatWithDatabasePayload): Promise<Output> {
    // Destructure with default values (though most are required here)
    const { question, connectionString, schemaContext } = payload;

    // Validate required inputs
    if (!question) throw new Error("Input 'question' is required.");
    if (!connectionString)
      throw new Error("Input 'connectionString' is required.");

    // Step 1: Process chat with AI and Database
    const answer = await this.processChat(
      question,
      connectionString,
      schemaContext
    );

    // Step 2: Format output
    return this.formatOutput(answer);
  }
}
