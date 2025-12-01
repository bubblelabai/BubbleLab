// Template for Chat With Your Database (Postgres, Email)
// This template reads the database schema, answers user queries about metrics,
// and sends a beautifully formatted HTML report via email

export const templateCode = `import {
  BubbleFlow,
  DatabaseAnalyzerWorkflowBubble,
  AIAgentBubble,
  ResendBubble,
  type CronEvent,
} from '@bubblelab/bubble-core';

export interface Output {
  message: string;
  emailId?: string;
  queryResult: {
    rows: number;
    summary: string;
  };
}

export interface CustomCronPayload extends CronEvent {
  email: string;
  query: string;
  reportTitle?: string;
}

export class ChatWithYourDatabaseFlow extends BubbleFlow<'schedule/cron'> {
  readonly cronSchedule = '0 15 * * *';

  // Analyzes the PostgreSQL database schema to discover all available tables and columns.
  private async analyzeDatabaseSchema(): Promise<string> {
    // Examines the database metadata to discover all 
    // tables and columns. 
    const schemaAnalyzer = new DatabaseAnalyzerWorkflowBubble({
      dataSourceType: 'postgresql',
      ignoreSSLErrors: true,
      includeMetadata: true,
    });

    const schemaResult = await schemaAnalyzer.action();

    if (!schemaResult.success || !schemaResult.data?.databaseSchema?.cleanedJSON) {
      throw new Error(\`Failed to analyze database schema: \${schemaResult.error || 'No schema data'}\`);
    }

    return schemaResult.data.databaseSchema.cleanedJSON;
  }

  // Analyzes database data using AI agent with sql-query-tool and generates HTML report.
  private async performDataAnalysis(
    query: string,
    dbSchema: string
  ): Promise<{
    queryExecuted: string;
    rowsAnalyzed: number;
    summary: string;
    insights: string[];
    metrics: Array<{ label: string; value: string; trend: string }>;
    htmlReport: string;
    sqlQueries?: string[];
  }> {
    const dataAnalystPrompt = \`
      You are an expert data analyst. Based on the database schema and user query, provide comprehensive insights by exploring the database as needed.

      Database Schema (table -> columns with types):
      \${dbSchema}

      User Query: "\${query}"

      You can use the sql-query-tool to explore the database, run multiple queries if needed, and perform thorough analysis.

      Ultimately, return a JSON object with this structure:
      {
        "queryExecuted": "Description of main queries run",
        "rowsAnalyzed": number of rows analyzed,
        "summary": "2-3 sentence comprehensive summary of key findings",
        "insights": [
          "Insight 1: What the data shows with specifics",
          "Insight 2: Notable trends or patterns with data",
          "Insight 3: Recommendations or observations based on data"
        ],
        "metrics": [
          {"label": "Metric Name", "value": "Formatted Value", "trend": "up|down|stable"}
        ],
        "htmlReport": "Complete HTML string for the email report"
      }

      Analyze trends, metrics, and provide actionable insights. Generate dynamic HTML that includes:
      - Header with title and date
      - Query description
      - Key metrics cards
      - Summary section
      - Key insights list
      - Data table preview (limit to 10 rows, show total count)
      - Footer
      - Styling similar to the previous template but made dynamic based on your analysis

      Return only valid JSON with no markdown formatting.
    \`;

    // Analyzes database data using sql-query-tool with jsonMode enabled.
    // Returns structured JSON with insights, metrics, and HTML report.
    const dataAnalyst = new AIAgentBubble({
      message: dataAnalystPrompt,
      systemPrompt: 'You are a comprehensive data analyst. Use tools iteratively to explore data, analyze trends, and generate automated reports. Return only valid JSON.',
      model: {
        model: 'google/gemini-2.5-pro',
        jsonMode: true,
      },
      tools: [{ name: 'sql-query-tool' }],
      maxIterations: 20,
    });

    const analystResult = await dataAnalyst.action();

    if (!analystResult.success || !analystResult.data?.response) {
      throw new Error(\`Failed to perform data analysis: \${analystResult.error || 'No response'}\`);
    }

    let analysis;
    try {
      analysis = JSON.parse(analystResult.data.response);
    } catch (error) {
      throw new Error('Failed to parse data analyst response as JSON');
    }

    // Extract SQL queries from tool calls for display in the report
    const sqlQueries = analystResult.data.toolCalls
      ?.filter((call: any) => call.tool === 'sql-query-tool' && call.input)
      .map((call: any) => {
        const queryInput = call.input as any;
        return queryInput.query || queryInput.sql || JSON.stringify(queryInput);
      })
      .filter((query: string) => query && query.trim() !== '') || [];

    // If we have SQL queries, add them to the analysis and update the HTML report
    if (sqlQueries.length > 0) {
      analysis.sqlQueries = sqlQueries;

      const sqlQueriesHtml = \`
        <div style="margin-top: 30px; border-top: 1px solid #e0e0e0; padding-top: 20px;">
          <h3 style="color: #333; margin-bottom: 15px;">🔍 SQL Queries Used</h3>
          \${sqlQueries.map((query: string, index: number) => \`
            <div style="margin-bottom: 15px;">
              <h4 style="color: #666; margin-bottom: 5px; font-size: 14px;">Query \${index + 1}:</h4>
              <pre style="
                background-color: #f4f4f4;
                border: 1px solid #ddd;
                border-radius: 4px;
                padding: 12px;
                overflow-x: auto;
                font-family: 'Courier New', monospace;
                font-size: 13px;
                line-height: 1.4;
                color: #333;
                margin: 0;
              "><code>\${query}</code></pre>
            </div>
          \`).join('')}
        </div>
      \`;

      if (analysis.htmlReport && analysis.htmlReport.includes('<footer')) {
        analysis.htmlReport = analysis.htmlReport.replace('<footer', sqlQueriesHtml + '<footer');
      } else if (analysis.htmlReport) {
        analysis.htmlReport += sqlQueriesHtml;
      }
    }

    return analysis;
  }

  // Sends the AI-generated database analysis report as a formatted HTML email.
  private async sendAnalysisReport(
    email: string,
    reportTitle: string,
    htmlReport: string
  ): Promise<string> {
    // Sends the database analysis report via email using Resend. The 'from' parameter
    // is automatically set to Bubble Lab's default sender unless you have your own
    // Resend account with a verified domain configured.
    const emailSender = new ResendBubble({
      operation: 'send_email',
      to: [email],
      subject: \`📊 \${reportTitle} - \${new Date().toLocaleDateString()}\`,
      html: htmlReport,
    });

    const emailResult = await emailSender.action();

    if (!emailResult.success || !emailResult.data?.email_id) {
      throw new Error(\`Failed to send email: \${emailResult.error || 'Unknown error'}\`);
    }

    return emailResult.data.email_id;
  }

  // Main workflow orchestration
  async handle(payload: CustomCronPayload): Promise<Output> {
    const { email, query, reportTitle = 'Daily Flows Report' } = payload;

    const dbSchema = await this.analyzeDatabaseSchema();
    const analysis = await this.performDataAnalysis(query, dbSchema);
    const emailId = await this.sendAnalysisReport(email, reportTitle, analysis.htmlReport);

    return {
      message: \`Successfully generated and sent daily flows report to \${email}\`,
      emailId,
      queryResult: {
        rows: analysis.rowsAnalyzed,
        summary: analysis.summary,
      },
    };
  }
}`;
