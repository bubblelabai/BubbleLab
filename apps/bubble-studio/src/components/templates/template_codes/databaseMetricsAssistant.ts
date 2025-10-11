// Template for Database Metrics Assistant (Postgres, Email)
// This template reads the database schema, answers user queries about metrics,
// and sends a beautifully formatted HTML report via email

export const templateCode = `import {
  BubbleFlow,
  DatabaseAnalyzerWorkflowBubble,
  PostgreSQLBubble,
  AIAgentBubble,
  ResendBubble,
  type WebhookEvent,
} from '@bubblelab/bubble-core';

export interface Output {
  message: string;
  emailId?: string;
  queryResult: {
    rows: number;
    summary: string;
  };
}

export interface CustomWebhookPayload extends WebhookEvent {
  email: string;
  query: string;
  reportTitle?: string;
}

export class DatabaseMetricsAssistantFlow extends BubbleFlow<'webhook/http'> {
  async handle(payload: CustomWebhookPayload): Promise<Output> {
    const { email, query, reportTitle = 'Database Metrics Report' } = payload;

    // 1. Analyze database schema to understand available tables
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

    // 2. Use AI to generate the SQL query based on user's question and schema
    const sqlGenerationPrompt = \`
      You are an expert SQL analyst. Based on the database schema and user query, generate a SQL query.

      Database Schema (table -> columns with types):
      \${dbSchema}

      User Query: "\${query}"

      Return a JSON object with this structure:
      {
        "sql": "The SQL query to run (SELECT only, read-only)",
        "explanation": "Brief explanation of what this query does",
        "expectedColumns": ["column1", "column2", ...],
        "chartType": "bar|line|table|number" // Suggest best visualization
      }

      Rules:
      - Use only SELECT statements (read-only)
      - Reference actual table and column names from the schema
      - Optimize for performance with proper JOINs and aggregations
      - For time-series queries, ensure proper date grouping
      - Return only valid JSON with no markdown formatting
    \`;

    const sqlGenerator = new AIAgentBubble({
      message: sqlGenerationPrompt,
      systemPrompt: 'You are an expert SQL analyst. Generate optimized, read-only SQL queries based on database schema and user intent. Return only valid JSON.',
      model: {
        model: 'google/gemini-2.5-flash',
        jsonMode: true,
      },
    });

    const sqlResult = await sqlGenerator.action();

    if (!sqlResult.success || !sqlResult.data?.response) {
      throw new Error(\`Failed to generate SQL query: \${sqlResult.error}\`);
    }

    let queryPlan;
    try {
      queryPlan = JSON.parse(sqlResult.data.response);
    } catch (error) {
      throw new Error('Failed to parse SQL generation response as JSON');
    }

    // 3. Execute the generated SQL query
    const postgresQuery = new PostgreSQLBubble({
      query: queryPlan.sql,
      ignoreSSL: true,
      allowedOperations: ['SELECT', 'WITH'],
      maxRows: 1000,
      timeout: 30000,
    });

    const queryResult = await postgresQuery.action();

    if (!queryResult.success) {
      throw new Error(\`Failed to execute query: \${queryResult.error}\`);
    }

    const rows = queryResult.data?.rows || [];
    const rowCount = rows.length;

    // 4. Generate insights from the query results using AI
    const insightsPrompt = \`
      You are a data analyst. Analyze these query results and provide insights.

      Original Query: "\${query}"
      SQL Executed: \${queryPlan.sql}
      Results (\${rowCount} rows):
      \${JSON.stringify(rows.slice(0, 100))}\${rowCount > 100 ? ' ... (showing first 100 rows)' : ''}

      Return a JSON object with this structure:
      {
        "summary": "2-3 sentence summary of key findings",
        "insights": [
          "Insight 1: What the data shows",
          "Insight 2: Notable trends or patterns",
          "Insight 3: Recommendations or observations"
        ],
        "metrics": [
          {"label": "Metric Name", "value": "Formatted Value", "trend": "up|down|stable"}
        ]
      }
    \`;

    const insightsAgent = new AIAgentBubble({
      message: insightsPrompt,
      systemPrompt: 'You are a data analyst. Provide clear, actionable insights from query results. Return only valid JSON.',
      model: {
        model: 'google/gemini-2.5-flash',
        jsonMode: true,
      },
    });

    const insightsResult = await insightsAgent.action();

    if (!insightsResult.success || !insightsResult.data?.response) {
      throw new Error(\`Failed to generate insights: \${insightsResult.error}\`);
    }

    let insights;
    try {
      insights = JSON.parse(insightsResult.data.response);
    } catch (error) {
      throw new Error('Failed to parse insights response as JSON');
    }

    // 5. Create beautiful HTML report
    const htmlReport = \`
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>\${reportTitle}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="700" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">

          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 30px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 32px; font-weight: 700;">📊 \${reportTitle}</h1>
              <p style="margin: 15px 0 0 0; color: #e0e7ff; font-size: 16px;">\${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
            </td>
          </tr>

          <!-- Query Context -->
          <tr>
            <td style="padding: 30px; background-color: #f8fafc; border-bottom: 1px solid #e2e8f0;">
              <div style="background-color: #ffffff; padding: 20px; border-radius: 8px; border-left: 4px solid #667eea;">
                <h3 style="margin: 0 0 10px 0; color: #1e293b; font-size: 16px; font-weight: 600;">📝 Your Query</h3>
                <p style="margin: 0; color: #475569; font-size: 15px; line-height: 1.6;">"\${query}"</p>
              </div>
            </td>
          </tr>

          <!-- Key Metrics -->
          \${insights.metrics && insights.metrics.length > 0 ? \`
          <tr>
            <td style="padding: 30px;">
              <h2 style="margin: 0 0 20px 0; color: #1e293b; font-size: 22px; font-weight: 600;">📈 Key Metrics</h2>
              <table width="100%" cellpadding="0" cellspacing="10">
                <tr>
                  \${insights.metrics.slice(0, 3).map((metric: any) => \`
                    <td style="background-color: #f8fafc; padding: 20px; border-radius: 8px; text-align: center; width: 33%;">
                      <div style="color: #64748b; font-size: 14px; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px;">\${metric.label}</div>
                      <div style="color: #1e293b; font-size: 28px; font-weight: 700; margin-bottom: 5px;">\${metric.value}</div>
                      <div style="color: \${metric.trend === 'up' ? '#10b981' : metric.trend === 'down' ? '#ef4444' : '#64748b'}; font-size: 12px;">
                        \${metric.trend === 'up' ? '▲' : metric.trend === 'down' ? '▼' : '●'} \${metric.trend}
                      </div>
                    </td>
                  \`).join('')}
                </tr>
              </table>
            </td>
          </tr>
          \` : ''}

          <!-- Summary -->
          <tr>
            <td style="padding: 30px; background-color: #f0f9ff; border-top: 1px solid #e0f2fe; border-bottom: 1px solid #e0f2fe;">
              <h2 style="margin: 0 0 15px 0; color: #0369a1; font-size: 20px; font-weight: 600;">💡 Summary</h2>
              <p style="margin: 0; color: #075985; font-size: 15px; line-height: 1.7;">\${insights.summary}</p>
            </td>
          </tr>

          <!-- Insights -->
          <tr>
            <td style="padding: 30px;">
              <h2 style="margin: 0 0 20px 0; color: #1e293b; font-size: 22px; font-weight: 600;">🔍 Key Insights</h2>
              \${insights.insights.map((insight: string, index: number) => \`
                <div style="margin-bottom: 15px; padding: 15px 20px; background-color: #f8fafc; border-radius: 8px; border-left: 4px solid #667eea;">
                  <p style="margin: 0; color: #475569; font-size: 15px; line-height: 1.6;">
                    <strong style="color: #667eea;">\${index + 1}.</strong> \${insight}
                  </p>
                </div>
              \`).join('')}
            </td>
          </tr>

          <!-- Data Table -->
          <tr>
            <td style="padding: 30px; background-color: #f8fafc;">
              <h2 style="margin: 0 0 20px 0; color: #1e293b; font-size: 22px; font-weight: 600;">📋 Data Results (\${rowCount} rows)</h2>
              <div style="overflow-x: auto;">
                <table width="100%" cellpadding="12" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; border: 1px solid #e2e8f0;">
                  <thead>
                    <tr style="background-color: #1e293b;">
                      \${rows.length > 0 ? Object.keys(rows[0]).map(col => \`
                        <th style="color: #ffffff; text-align: left; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; padding: 12px;">\${col}</th>
                      \`).join('') : ''}
                    </tr>
                  </thead>
                  <tbody>
                    \${rows.slice(0, 10).map((row: any, index: number) => \`
                      <tr style="border-top: 1px solid #e2e8f0; \${index % 2 === 0 ? 'background-color: #f8fafc;' : ''}">
                        \${Object.values(row).map(val => \`
                          <td style="color: #475569; font-size: 14px; padding: 12px;">\${val !== null && val !== undefined ? val : '-'}</td>
                        \`).join('')}
                      </tr>
                    \`).join('')}
                    \${rowCount > 10 ? \`
                      <tr style="border-top: 2px solid #e2e8f0;">
                        <td colspan="\${Object.keys(rows[0]).length}" style="color: #64748b; font-size: 13px; padding: 12px; text-align: center; font-style: italic;">
                          ... and \${rowCount - 10} more rows
                        </td>
                      </tr>
                    \` : ''}
                  </tbody>
                </table>
              </div>
            </td>
          </tr>

          <!-- SQL Query -->
          <tr>
            <td style="padding: 30px; background-color: #fafafa; border-top: 1px solid #e2e8f0;">
              <h3 style="margin: 0 0 15px 0; color: #64748b; font-size: 16px; font-weight: 600;">⚙️ SQL Query Executed</h3>
              <pre style="margin: 0; padding: 15px; background-color: #1e293b; color: #e2e8f0; border-radius: 6px; font-size: 13px; overflow-x: auto; line-height: 1.5;">\${queryPlan.sql}</pre>
              <p style="margin: 15px 0 0 0; color: #64748b; font-size: 14px; font-style: italic;">\${queryPlan.explanation}</p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 30px; background-color: #1e293b; text-align: center;">
              <p style="margin: 0; color: #94a3b8; font-size: 14px;">Automated Database Metrics Report</p>
              <p style="margin: 10px 0 0 0; color: #64748b; font-size: 12px;">
                Powered by <a href="https://bubblelab.ai" style="color: #667eea; text-decoration: none; font-weight: 600;">bubble lab</a> • Generated \${new Date().toLocaleTimeString()}
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    \`;

    // 6. Send email report
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

    return {
      message: \`Successfully generated and sent database metrics report to \${email}\`,
      emailId: emailResult.data.email_id,
      queryResult: {
        rows: rowCount,
        summary: insights.summary,
      },
    };
  }
}`;

export const metadata = {
  inputsSchema: JSON.stringify({
    type: 'object',
    properties: {
      email: {
        type: 'string',
        format: 'email',
        description: 'Email address to send the metrics report to',
      },
      query: {
        type: 'string',
        description:
          'Natural language query about your database metrics (e.g., "Show me signups from the last 7 days", "What are the top users by activity?")',
      },
      reportTitle: {
        type: 'string',
        description: 'Title for the metrics report',
        default: 'Database Metrics Report',
      },
    },
    required: ['email', 'query'],
  }),
  requiredCredentials: {
    postgresql: ['read'],
    resend: ['send'],
  },
  // Pre-validated bubble parameters for instant visualization
  preValidatedBubbles: {
    1: {
      variableId: 1,
      variableName: 'schemaAnalyzer',
      bubbleName: 'DatabaseAnalyzerWorkflowBubble',
      className: 'DatabaseAnalyzerWorkflowBubble',
      nodeType: 'workflow',
      hasAwait: true,
      hasActionCall: true,
      location: { startLine: 1, startCol: 1, endLine: 1, endCol: 1 },
      parameters: [
        { name: 'dataSourceType', value: 'postgresql', type: 'string' },
        { name: 'ignoreSSLErrors', value: true, type: 'boolean' },
        { name: 'includeMetadata', value: true, type: 'boolean' },
      ],
    },
    2: {
      variableId: 2,
      variableName: 'sqlGenerator',
      bubbleName: 'AIAgentBubble',
      className: 'AIAgentBubble',
      nodeType: 'service',
      hasAwait: true,
      hasActionCall: true,
      location: { startLine: 1, startCol: 1, endLine: 1, endCol: 1 },
      parameters: [
        {
          name: 'message',
          value:
            'Generate SQL query based on database schema and user query (JSON format)',
          type: 'string',
        },
        {
          name: 'systemPrompt',
          value:
            'Expert SQL analyst generating optimized read-only queries. Return valid JSON only.',
          type: 'string',
        },
        {
          name: 'model',
          value: { model: 'google/gemini-2.5-flash', jsonMode: true },
          type: 'object',
        },
      ],
    },
    3: {
      variableId: 3,
      variableName: 'postgresQuery',
      bubbleName: 'PostgreSQLBubble',
      className: 'PostgreSQLBubble',
      nodeType: 'service',
      hasAwait: true,
      hasActionCall: true,
      location: { startLine: 1, startCol: 1, endLine: 1, endCol: 1 },
      parameters: [
        { name: 'query', value: '${queryPlan.sql}', type: 'string' },
        { name: 'ignoreSSL', value: true, type: 'boolean' },
        { name: 'allowedOperations', value: ['SELECT', 'WITH'], type: 'array' },
        { name: 'maxRows', value: 1000, type: 'number' },
      ],
    },
    4: {
      variableId: 4,
      variableName: 'insightsAgent',
      bubbleName: 'AIAgentBubble',
      className: 'AIAgentBubble',
      nodeType: 'service',
      hasAwait: true,
      hasActionCall: true,
      location: { startLine: 1, startCol: 1, endLine: 1, endCol: 1 },
      parameters: [
        {
          name: 'message',
          value:
            'Analyze query results and provide summary, insights, and metrics (JSON format)',
          type: 'string',
        },
        {
          name: 'systemPrompt',
          value:
            'Data analyst providing clear, actionable insights. Return valid JSON only.',
          type: 'string',
        },
        {
          name: 'model',
          value: { model: 'google/gemini-2.5-flash', jsonMode: true },
          type: 'object',
        },
      ],
    },
    5: {
      variableId: 5,
      variableName: 'emailSender',
      bubbleName: 'ResendBubble',
      className: 'ResendBubble',
      nodeType: 'service',
      hasAwait: true,
      hasActionCall: true,
      location: { startLine: 1, startCol: 1, endLine: 1, endCol: 1 },
      parameters: [
        { name: 'operation', value: 'send_email', type: 'string' },
        { name: 'to', value: ['${email}'], type: 'array' },
        {
          name: 'subject',
          value: '📊 ${reportTitle} - ${date}',
          type: 'string',
        },
      ],
    },
  },
};
