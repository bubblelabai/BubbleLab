// Template for Chat With Your Database (Postgres, Email)
// This template reads the database schema, answers user queries about metrics,
// and sends a beautifully formatted HTML report via email

export const templateCode = `import {
  // Base classes
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

  async handle(payload: CustomCronPayload): Promise<Output> {
    const { email, query, reportTitle = 'Daily Flows Report' } = payload;

    // Examines the PostgreSQL database structure with metadata included to discover
    // all available tables and columns, providing the AI agent with context needed
    // to generate accurate SQL queries.
    const schemaAnalyzer = new DatabaseAnalyzerWorkflowBubble({
      dataSourceType: 'postgresql',
      ignoreSSLErrors: true,
      includeMetadata: true,
    });

    const schemaResult = await schemaAnalyzer.action();

    if (!schemaResult.success || !schemaResult.data?.databaseSchema?.cleanedJSON) {
      throw new Error(\`Failed to analyze database schema: \${schemaResult.error}\`);
    }

    const dbSchema = schemaResult.data.databaseSchema.cleanedJSON;


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


    // Performs intelligent data analysis using gemini-2.5-pro with jsonMode and the
    // sql-query-tool, iteratively exploring the database to identify trends, calculate
    // metrics, and generate a comprehensive HTML report with actionable insights.
    const dataAnalyst = new AIAgentBubble({
      message: dataAnalystPrompt,
      systemPrompt: 'You are a comprehensive data analyst. Use tools iteratively to explore data, analyze trends, and generate automated reports. Return only valid JSON.',
      model: {
        model: 'google/gemini-2.5-pro',
        jsonMode: true,
      },
      tools: [{ name: 'sql-query-tool' }],
      maxIterations: 20, // Allow more iterations for thorough analysis
    });

    const analystResult = await dataAnalyst.action();

    if (!analystResult.success || !analystResult.data?.response) {
      throw new Error(\`Failed to perform data analysis: \${analystResult.error}\`);
    }

    let analysis;
    try {
      analysis = JSON.parse(analystResult.data.response);
    } catch (error) {
      throw new Error('Failed to parse data analyst response as JSON');
    }

    // Extract SQL queries from tool calls for display in the report
    const sqlQueries = analystResult.data.toolCalls
      .filter(call => call.tool === 'sql-query-tool' && call.input)
      .map(call => {
        const queryInput = call.input as any;
        return queryInput.query || queryInput.sql || JSON.stringify(queryInput);
      })
      .filter(query => query && query.trim() !== '');

    // If we have SQL queries, add them to the analysis and update the HTML report
    if (sqlQueries.length > 0) {
      analysis.sqlQueries = sqlQueries;
      
      // Update the HTML report to include SQL queries section
      const sqlQueriesHtml = \`
        <div style="margin-top: 30px; border-top: 1px solid #e0e0e0; padding-top: 20px;">
          <h3 style="color: #333; margin-bottom: 15px;">🔍 SQL Queries Used</h3>
          \${sqlQueries.map((query, index) => \`
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
      
      // Insert the SQL queries section before the footer in the HTML report
      if (analysis.htmlReport && analysis.htmlReport.includes('<footer')) {
        analysis.htmlReport = analysis.htmlReport.replace('<footer', sqlQueriesHtml + '<footer');
      } else if (analysis.htmlReport) {
        analysis.htmlReport += sqlQueriesHtml;
      }
    }

    // Delivers the AI-generated database analysis report as a beautifully formatted
    // HTML email to the recipient, making insights immediately accessible in their inbox.
    const emailSender = new ResendBubble({
      operation: 'send_email',
      to: [email],
      subject: \`📊 \${reportTitle} - \${new Date().toLocaleDateString()}\`,
      html: analysis.htmlReport,
    });

    const emailResult = await emailSender.action();

    if (!emailResult.success || !emailResult.data?.email_id) {
      throw new Error(\`Failed to send email: \${emailResult.error || 'Unknown error'}\`);
    }

    return {
      message: \`Successfully generated and sent daily flows report to \${email}\`,
      emailId: emailResult.data.email_id,
      queryResult: {
        rows: analysis.rowsAnalyzed,
        summary: analysis.summary,
      },
    };
  }
}`;
