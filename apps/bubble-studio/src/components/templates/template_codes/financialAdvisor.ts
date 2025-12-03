// Template for Financial Advisor
// This file contains the template code and metadata for the stock analysis workflow

export const templateCode = `import {
  BubbleFlow,
  AIAgentBubble,
  ResendBubble,
  ResearchAgentTool,
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
  // Researches recent news headlines and key events for the stock ticker from Yahoo Finance.
  private async researchStockData(ticker: string): Promise<{
    headlines: Array<{ title: string; link: string; source: string }>;
    keyEvents: Array<{ event: string; date: string; impact: string }>;
  }> {
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

    // Scrapes Yahoo Finance for latest news headlines and key events for the stock ticker.
    // Returns structured data with headlines and keyEvents arrays.
    const researchAgent = new ResearchAgentTool({
      task: \`Scrape Yahoo Finance for the latest news headlines and key events for the stock ticker: \${ticker}. Focus on information that could influence the stock's price.\`,
      expectedResultSchema: researchSchema,
    });

    const researchResult = await researchAgent.action();

    if (!researchResult.success || !researchResult.data?.result) {
      throw new Error(\`Research agent failed: \${researchResult.error || 'No result data'}\`);
    }

    return researchResult.data.result as {
      headlines: Array<{ title: string; link: string; source: string }>;
      keyEvents: Array<{ event: string; date: string; impact: string }>;
    };
  }

  // Generates a 3-paragraph stock analysis covering market sentiment, risks, and opportunities.
  private async generateAnalysis(
    ticker: string,
    researchData: {
      headlines: Array<{ title: string; link: string; source: string }>;
      keyEvents: Array<{ event: string; date: string; impact: string }>;
    }
  ): Promise<string> {
    const analysisPrompt = \`
      Based on the following financial data for the stock ticker "\${ticker}", please generate a 3-paragraph analysis.

      **Recent News Headlines:**
      \${researchData.headlines
        .map((h) => \`- \${h.title} (Source: \${h.source})\`)
        .join('\\n')}

      **Key Events:**
      \${researchData.keyEvents
        .map((e) => \`- \${e.event} on \${e.date} (Impact: \${e.impact})\`)
        .join('\\n')}

      **Analysis Structure:**
      1.  **Market Sentiment:** Analyze the overall feeling or tone of the news. Is it positive, negative, or neutral? What does this suggest about the market's current perception of the stock?
      2.  **Potential Risks:** Identify any potential risks or challenges highlighted in the news or events. What could negatively impact the stock price?
      3.  **Potential Opportunities:** Identify any potential opportunities or positive catalysts. What could drive the stock price up?

      Please provide a concise, well-structured analysis in plain text format.
    \`;

    // Generates stock analysis from research data using gemini-2.5-pro.
    // Returns plain text analysis covering market sentiment, risks, and opportunities.
    const analysisAgent = new AIAgentBubble({
      message: analysisPrompt,
      systemPrompt: 'You are a financial analyst AI. Your task is to provide clear, concise, and unbiased analysis of financial data in plain text format.',
      model: { model: 'google/gemini-2.5-pro' },
    });

    const analysisResult = await analysisAgent.action();

    if (!analysisResult.success || !analysisResult.data?.response) {
      throw new Error(\`Analysis agent failed: \${analysisResult.error || 'No response'}\`);
    }

    return analysisResult.data.response;
  }

  // Sends the stock analysis as a plain text email to the recipient.
  private async sendAnalysisEmail(
    ticker: string,
    recipientEmail: string,
    analysis: string
  ): Promise<void> {
    // Sends stock analysis via email using Resend. The 'from' parameter is automatically
    // set to Bubble Lab's default sender unless you have your own Resend account configured.
    const emailSender = new ResendBubble({
      operation: 'send_email',
      to: [recipientEmail],
      subject: \`Stock Analysis for \${ticker}\`,
      text: analysis,
    });

    const emailResult = await emailSender.action();

    if (!emailResult.success) {
      throw new Error(\`Failed to send email: \${emailResult.error || 'Unknown error'}\`);
    }
  }

  // Main workflow orchestration
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

    const researchData = await this.researchStockData(ticker);
    const analysis = await this.generateAnalysis(ticker, researchData);
    await this.sendAnalysisEmail(ticker, recipientEmail, analysis);

    return {
      status: \`Successfully sent analysis for \${ticker} to \${recipientEmail}\`,
      analysis,
      emailSent: true,
    };
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
