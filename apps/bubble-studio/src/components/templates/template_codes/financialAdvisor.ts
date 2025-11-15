// Template for Financial Advisor
// This file contains the template code and metadata for the stock analysis workflow

export const templateCode = `import {
  // Base classes
  BubbleFlow,
  BaseBubble,
  ServiceBubble,
  WorkflowBubble,
  ToolBubble,
  
  // Service Bubbles
  HelloWorldBubble,
  AIAgentBubble,
  PostgreSQLBubble,
  SlackBubble,
  ResendBubble,
  StorageBubble,
  GoogleDriveBubble,
  GmailBubble,
  SlackFormatterAgentBubble,
  
  // Template Workflows
  SlackDataAssistantWorkflow,
  PDFFormOperationsWorkflow,

  // Specialized Tool Bubbles
  ResearchAgentTool,
  RedditScrapeTool,
    
  // Types and utilities
  BubbleFactory,
  type BubbleClassWithMetadata,
  type BubbleContext,
  type BubbleOperationResult,
  type BubbleTriggerEvent,
  type WebhookEvent,
} from '@bubblelab/bubble-core';

export interface Output {
  status: string;
  analysis: string;
  emailSent: boolean;
  error?: string;
}

// Define your custom input interface
export interface CustomWebhookPayload extends WebhookEvent {
  ticker: string;
  recipientEmail: string;
}

export class StockAnalysisFlow extends BubbleFlow<'webhook/http'> {
  async handle(payload: CustomWebhookPayload): Promise<Output> {
    const { ticker, recipientEmail } = payload;

    if (!ticker || !recipientEmail) {
      return {
        status: 'error',
        analysis: '',
        emailSent: false,
        error: 'Missing required fields: ticker and recipientEmail',
      };
    }

    try {
      const researchSchema = JSON.stringify({
        type: 'object',
        properties: {
          headlines: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                title: { type: 'string' },
                link: { type: 'string' },
                source: { type: 'string' },
              },
              required: ['title', 'link', 'source'],
            },
          },
          keyEvents: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                event: { type: 'string' },
                date: { type: 'string' },
                impact: { type: 'string' },
              },
              required: ['event', 'date', 'impact'],
            },
          },
        },
        required: ['headlines', 'keyEvents'],
      });

      // Researches recent news, headlines, and key events for the specified stock ticker
      // from Yahoo Finance and other financial sources. This gathers current information
      // that could impact the stock's price, including earnings announcements, product
      // launches, market events, and industry news. Parameters: task (describes the research
      // goal focusing on price-influencing information), expectedResultSchema (JSON schema
      // defining the structure for headlines and keyEvents arrays). This provides the raw
      // financial data that will be analyzed in the next step to generate investment insights.
      const researchAgent = new ResearchAgentTool({
        task: \`Scrape Yahoo Finance for the latest news headlines and key events for the stock ticker: \${ticker}. Focus on information that could influence the stock's price.\`,
        expectedResultSchema: researchSchema,
      });

      const researchResult = await researchAgent.action();

      if (!researchResult.success || !researchResult.data?.result) {
        return {
          status: 'error',
          analysis: '',
          emailSent: false,
          error: \`Research agent failed: \${researchResult.error}\`,
        };
      }

      const researchData = researchResult.data.result as any;

      const analysisPrompt = \`
        Based on the following financial data for the stock ticker "\${ticker}", please generate a 3-paragraph analysis.

        **Recent News Headlines:**
        \${researchData.headlines
          .map((h: any) => \`- \${h.title} (Source: \${h.source})\`)
          .join('\\n')}

        **Key Events:**
        \${researchData.keyEvents
          .map((e: any) => \`- \${e.event} on \${e.date} (Impact: \${e.impact})\`)
          .join('\\n')}

        **Analysis Structure:**
        1.  **Market Sentiment:** Analyze the overall feeling or tone of the news. Is it positive, negative, or neutral? What does this suggest about the market's current perception of the stock?
        2.  **Potential Risks:** Identify any potential risks or challenges highlighted in the news or events. What could negatively impact the stock price?
        3.  **Potential Opportunities:** Identify any potential opportunities or positive catalysts. What could drive the stock price up?

        Please provide a concise, well-structured analysis in plain text format.
      \`;

      // Analyzes the financial research data to generate a comprehensive 3-paragraph
      // stock analysis covering market sentiment, potential risks, and opportunities.
      // This AI agent synthesizes news headlines and key events into actionable
      // investment insights. Parameters: message (includes research data and analysis
      // structure requirements), systemPrompt (defines the agent as a financial analyst),
      // model (gemini-2.5-pro for high-quality financial analysis). This transforms raw
      // financial news into structured investment guidance that helps users make informed
      // decisions about the stock.
      const analysisAgent = new AIAgentBubble({
        message: analysisPrompt,
        systemPrompt: 'You are a financial analyst AI. Your task is to provide clear, concise, and unbiased analysis of financial data in plain text format.',
        model: { model: 'google/gemini-2.5-pro' },
      });

      const analysisResult = await analysisAgent.action();

      if (!analysisResult.success || !analysisResult.data?.response) {
        return {
          status: 'error',
          analysis: '',
          emailSent: false,
          error: \`Analysis agent failed: \${analysisResult.error}\`,
        };
      }

      const analysis = analysisResult.data.response;

      // Only send email if all previous steps succeeded
      // Delivers the AI-generated stock analysis directly to the recipient's email inbox.
      // This makes the investment insights immediately accessible for decision-making.
      // Parameters: operation ('send_email'), to (recipient email address), subject
      // (includes stock ticker for easy identification), text (the plain text analysis
      // content). This final step completes the workflow by delivering professional
      // financial analysis in a convenient, readable format.
      const emailSender = new ResendBubble({
        operation: 'send_email',
        to: [recipientEmail],
        subject: \`Stock Analysis for \${ticker}\`,
        text: analysis, // Use text instead of html
      });

      const emailResult = await emailSender.action();

      if (!emailResult.success) {
        return {
          status: 'error',
          analysis: analysis,
          emailSent: false,
          error: \`Failed to send email: \${emailResult.error}\`,
        };
      }

      // Success case - email was sent
      return {
        status: \`Successfully sent analysis for \${ticker} to \${recipientEmail}\`,
        analysis,
        emailSent: true,
      };

    } catch (error) {
      // Catch any unexpected errors
      return {
        status: 'error',
        analysis: '',
        emailSent: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }
}`;

export const metadata = {
  inputsSchema: JSON.stringify({
    type: 'object',
    properties: {
      ticker: {
        type: 'string',
        description: 'Stock ticker symbol to analyze (e.g., AAPL, GOOGL, TSLA)',
      },
      recipientEmail: {
        type: 'string',
        description: 'Email address to send the stock analysis to',
      },
    },
    required: ['ticker', 'recipientEmail'],
  }),
  requiredCredentials: {
    resend: ['send'],
    'research-agent': ['read'],
  },
  // Pre-validated bubble parameters for instant visualization (no server validation needed)
  // Keys correspond to variableIds to ensure stable ordering/selection
  preValidatedBubbles: {
    1: {
      variableId: 1,
      variableName: 'researchAgent',
      bubbleName: 'ResearchAgentTool',
      className: 'ResearchAgentTool',
      nodeType: 'tool',
      hasAwait: true,
      hasActionCall: true,
      location: { startLine: 1, startCol: 1, endLine: 1, endCol: 1 },
      parameters: [
        {
          name: 'task',
          value:
            'Scrape Yahoo Finance for latest news and events for ${ticker}',
          type: 'string',
        },
        {
          name: 'expectedResultSchema',
          value: 'JSON schema for headlines and keyEvents',
          type: 'string',
        },
      ],
    },
    2: {
      variableId: 2,
      variableName: 'analysisAgent',
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
            'Analyze financial data and generate 3-paragraph stock analysis',
          type: 'string',
        },
        {
          name: 'systemPrompt',
          value: 'Financial analyst AI providing clear, unbiased analysis',
          type: 'string',
        },
        {
          name: 'model',
          value: { model: 'google/gemini-2.5-pro' },
          type: 'object',
        },
      ],
    },
    3: {
      variableId: 3,
      variableName: 'emailSender',
      bubbleName: 'ResendBubble',
      className: 'ResendBubble',
      nodeType: 'service',
      hasAwait: true,
      hasActionCall: true,
      location: { startLine: 1, startCol: 1, endLine: 1, endCol: 1 },
      parameters: [
        { name: 'operation', value: 'send_email', type: 'string' },
        { name: 'to', value: ['${recipientEmail}'], type: 'array' },
        {
          name: 'subject',
          value: 'Stock Analysis for ${ticker}',
          type: 'string',
        },
        { name: 'text', value: 'Generated analysis content', type: 'string' },
      ],
    },
  },
};
