import { z } from 'zod';
import {
  BubbleFlow,
  AIAgentBubble,
  PostgreSQLBubble,
  type WebhookEvent,
} from '@bubblelab/bubble-core';

export interface ChatWithDatabaseOutput {
  /** The natural language answer to the user's question. */
  answer: string;
  /** The SQL query that was generated and executed. */
  sqlUsed: string;
  /** The raw data returned from the database. */
  rawData: Record<string, unknown>[];
}

export interface ChatWithDatabasePayload extends WebhookEvent {
  /** The natural language question you want to ask the database. */
  question: string;

  /**
   * The PostgreSQL connection string.
   * Format: postgresql://user:password@host:port/database
   */
  connectionString: string;

  /**
   * A description of the database schema (tables, columns, types).
   * This is critical for the AI to generate correct SQL.
   * Example: "Table users (id int, name text, email text); Table orders (id int, user_id int, amount decimal)"
   */
  schemaContext: string;
}

export class ChatWithDatabaseFlow extends BubbleFlow<'webhook/http'> {
  // Step 0: Validate Input (Transformation Step)
  private validateInput(
    question?: string,
    connectionString?: string,
    schemaContext?: string
  ): void {
    if (!question) throw new Error('Question is required');
    if (!connectionString) throw new Error('Connection string is required');
    if (!schemaContext) throw new Error('Schema context is required');
  }

  // Step 1: Generate SQL from natural language (Bubble Step)
  private async generateSQL(
    question: string,
    schemaContext: string
  ): Promise<string> {
    // We use the more capable gemini-3-pro-preview for complex reasoning tasks like SQL generation
    const agent = new AIAgentBubble({
      model: { model: 'google/gemini-3-pro-preview', temperature: 0 }, // Deterministic for code generation
      systemPrompt: `You are an expert PostgreSQL Data Analyst. 
Your goal is to translate natural language questions into valid PostgreSQL SQL queries based on the provided schema.
Rules:
1. Return ONLY the SQL query.
2. Do not include markdown formatting (no \`\`\`sql).
3. Do not include explanations.
4. Use the provided schema context strictly.
5. Ensure the query is read-only (SELECT).`,
      message: `Schema Context:
${schemaContext}

User Question:
${question}`,
    });

    const result = await agent.action();

    if (!result.success) {
      throw new Error(`Failed to generate SQL: ${result.error}`);
    }

    return result.data.response;
  }

  // Step 2: Clean the generated SQL (Transformation Step)
  private cleanSQL(rawSql: string): string {
    let sql = rawSql.trim();
    // Remove markdown code blocks if the AI added them despite instructions
    if (sql.startsWith('```sql')) {
      sql = sql.replace(/^```sql/, '').replace(/```$/, '');
    } else if (sql.startsWith('```')) {
      sql = sql.replace(/^```/, '').replace(/```$/, '');
    }
    return sql.trim();
  }

  // Step 3: Execute the SQL query (Bubble Step)
  private async executeQuery(
    sql: string,
    connectionString: string
  ): Promise<Record<string, unknown>[]> {
    // Executes the generated SQL query against the user's PostgreSQL database.
    // We pass the connection string dynamically via the credentials parameter.
    const pgBubble = new PostgreSQLBubble({
      query: sql,
      ignoreSSL: true, // Often required for cloud-hosted databases
      allowedOperations: ['SELECT', 'WITH', 'SHOW', 'DESCRIBE'], // Restrict to read-only operations for safety
      credentials: {
        connectionString: connectionString,
      } as Record<string, string>,
    });

    const result = await pgBubble.action();

    if (!result.success) {
      throw new Error(`Database query failed: ${result.error}`);
    }

    return result.data.rows;
  }

  // Step 4: Summarize the results (Bubble Step)
  private async summarizeResults(
    question: string,
    sql: string,
    data: Record<string, unknown>[]
  ): Promise<string> {
    // If no data returned, return a simple message without calling AI
    if (!data || data.length === 0) {
      return 'I ran the query but found no results matching your criteria.';
    }

    // Use a faster model for summarization
    const agent = new AIAgentBubble({
      model: { model: 'google/gemini-2.5-flash' },
      systemPrompt:
        "You are a helpful assistant. Summarize the database results to answer the user's original question in a clear, natural language format.",
      message: `User Question: ${question}

SQL Query Used: ${sql}

Data Results:
${JSON.stringify(data, null, 2)}`,
    });

    const result = await agent.action();

    if (!result.success) {
      throw new Error(`Failed to summarize results: ${result.error}`);
    }

    return result.data.response;
  }

  async handle(
    payload: ChatWithDatabasePayload
  ): Promise<ChatWithDatabaseOutput> {
    // Destructure with default values (though these are required inputs)
    const { question, connectionString, schemaContext } = payload;

    // 0. Validate inputs
    this.validateInput(question, connectionString, schemaContext);

    // 1. Generate SQL
    const rawSql = await this.generateSQL(question!, schemaContext!);

    // 2. Clean SQL
    const sql = this.cleanSQL(rawSql);

    // 3. Execute Query
    const rows = await this.executeQuery(sql, connectionString!);

    // 4. Summarize Results
    const answer = await this.summarizeResults(question!, sql, rows);

    return {
      answer,
      sqlUsed: sql,
      rawData: rows,
    };
  }
}
