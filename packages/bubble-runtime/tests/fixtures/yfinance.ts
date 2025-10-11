import {
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
  message: string;
}

// Define your custom input interface
export interface YahooFinanceScraperPayload extends WebhookEvent {
  ticker: string;
  email: string;
}

interface ResearchResult {
  headlines: string[];
  keyEvents: string[];
}

interface AnalysisResult {
  marketSentiment: string;
  risks: string;
  opportunities: string;
}

export class YahooFinanceAnalysisFlow extends BubbleFlow<'webhook/http'> {
  async handle(payload: YahooFinanceScraperPayload): Promise<Output> {
    const { ticker, email } = payload;

    if (!ticker || !email) {
      throw new Error('Ticker and email are required in the payload.');
    }

    const researchSchema = JSON.stringify({
      type: 'object',
      properties: {
        headlines: {
          type: 'array',
          items: { type: 'string' },
          description: 'Recent news headlines related to the stock ticker.',
        },
        keyEvents: {
          type: 'array',
          items: { type: 'string' },
          description:
            'Key upcoming or recent events likely to affect the stock price.',
        },
      },
      required: ['headlines', 'keyEvents'],
    });

    const researchAgent = new ResearchAgentTool({
      task: `Go to Yahoo Finance for the ticker symbol "${ticker}". Scrape the latest news headlines and identify key upcoming events that could impact the stock's price.`,
      expectedResultSchema: researchSchema,
    });

    const researchResult = await researchAgent.action();

    if (!researchResult.success || !researchResult.data) {
      throw new Error(
        `Research agent failed to retrieve data: ${researchResult.error}`
      );
    }

    const scrapedData = researchResult.data as unknown as ResearchResult;

    const analysisPrompt = `
        Based on the following financial data for ticker ${ticker}:
        
        Recent Headlines:
        - ${scrapedData.headlines.join('\n- ')}
        
        Key Events:
        - ${scrapedData.keyEvents.join('\n- ')}
        
        Please provide a comprehensive 3-paragraph financial analysis. Your response must be in a clean JSON format with three keys: "marketSentiment", "risks", and "opportunities".
        1.  **marketSentiment:** Analyze the general market sentiment based on the news.
        2.  **risks:** Identify the primary risks highlighted by the events and headlines.
        3.  **opportunities:** Outline potential opportunities that can be identified from the data.
      `;

    const analysisAgent = new AIAgentBubble({
      message: analysisPrompt,
      systemPrompt:
        'You are a professional financial analyst. Your task is to provide a clear, insightful, and concise analysis based *only* on the data provided. Do not speculate or use external knowledge. Your output must be in JSON format.',
      model: {
        model: 'google/gemini-2.5-pro',
        jsonMode: true,
      },
      tools: [],
    });

    const analysisResult = await analysisAgent.action();

    if (!analysisResult.success || !analysisResult.data?.response) {
      throw new Error(
        `Analysis agent failed to generate a report: ${analysisResult.error}`
      );
    }

    const analysis = JSON.parse(analysisResult.data.response) as AnalysisResult;

    const emailHtml = `
        <html>
          <body>
            <h1>Financial Analysis for ${ticker.toUpperCase()}</h1>
            <h2>Market Sentiment</h2>
            <p>${analysis.marketSentiment}</p>
            <h2>Risks</h2>
            <p>${analysis.risks}</p>
            <h2>Opportunities</h2>
            <p>${analysis.opportunities}</p>
            <br>
            <p><em>Disclaimer: This is an automated analysis and should not be considered financial advice.</em></p>
          </body>
        </html>
      `;

    const emailSender = new ResendBubble({
      operation: 'send_email',
      to: [email],
      subject: `Your Automated Financial Analysis for ${ticker.toUpperCase()}`,
      html: emailHtml,
    });

    const emailResult = await emailSender.action();

    if (!emailResult.success) {
      throw new Error(`Failed to send email summary: ${emailResult.error}`);
    }

    return {
      message: `Successfully generated and sent analysis for ${ticker} to ${email}.`,
    };
  }
}
