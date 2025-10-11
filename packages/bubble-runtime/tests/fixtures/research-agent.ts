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

interface OnPageAnalysis {
  titleTag: string;
  metaDescription: string;
  headings: { level: string; text: string }[];
  imageAltText: boolean;
}

interface TechnicalAnalysis {
  mobileFriendly: boolean;
  pageSpeed: number;
}

export interface Output {
  overallScore: number;
  onPageAnalysis: OnPageAnalysis;
  technicalAnalysis: TechnicalAnalysis;
  suggestions: string[];
}

// Define your custom input interface
export interface CustomWebhookPayload extends WebhookEvent {
  websiteUrl: string;
}

export class SeoReportFlow extends BubbleFlow<'webhook/http'> {
  async handle(payload: CustomWebhookPayload): Promise<Output> {
    const { websiteUrl } = payload;

    const seoSchema = {
      type: 'object',
      properties: {
        overallScore: {
          type: 'number',
          description: 'Overall SEO score from 0 to 100',
        },
        onPageAnalysis: {
          type: 'object',
          properties: {
            titleTag: {
              type: 'string',
              description: 'The title tag of the page',
            },
            metaDescription: {
              type: 'string',
              description: 'The meta description of the page',
            },
            headings: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  level: { type: 'string', description: 'e.g., H1, H2, H3' },
                  text: { type: 'string' },
                },
                required: ['level', 'text'],
              },
            },
            imageAltText: {
              type: 'boolean',
              description: 'Whether all important images have alt text',
            },
          },
          required: ['titleTag', 'metaDescription', 'headings', 'imageAltText'],
        },
        technicalAnalysis: {
          type: 'object',
          properties: {
            mobileFriendly: {
              type: 'boolean',
              description: 'Is the site mobile-friendly?',
            },
            pageSpeed: {
              type: 'number',
              description: 'Estimated page load speed in seconds',
            },
          },
          required: ['mobileFriendly', 'pageSpeed'],
        },
        suggestions: {
          type: 'array',
          items: { type: 'string' },
          description: 'Actionable suggestions for improvement',
        },
      },
      required: [
        'overallScore',
        'onPageAnalysis',
        'technicalAnalysis',
        'suggestions',
      ],
    };

    const aiAgent = new AIAgentBubble({
      message: `Provide a detailed SEO report for the website ${websiteUrl}. Analyze on-page elements like title, meta description, headings, and image alt text. Also, assess technical aspects like mobile-friendliness and page speed. Finally, provide a list of actionable suggestions for improvement.`,
      tools: [
        { name: 'web-search-tool' },
        { name: 'web-scrape-tool' },
        { name: 'web-crawl-tool' },
        { name: 'web-extract-tool' },
        { name: 'reddit-scrape-tool' },
      ],
      model: {
        model: 'google/gemini-2.5-flash',
        temperature: 0.7,
        maxTokens: 40000,
      },
    });

    const aiwithresearchagentAsTool = new AIAgentBubble({
      message: `Provide a detailed SEO report for the website ${websiteUrl}. Analyze on-page elements like title, meta description, headings, and image alt text. Also, assess technical aspects like mobile-friendliness and page speed. Finally, provide a list of actionable suggestions for improvement.`,
      tools: [{ name: 'research-agent-tool' }],
      model: {
        model: 'google/gemini-2.5-flash',
        temperature: 0.7,
        maxTokens: 40000,
      },
    });

    const researchAgent = new ResearchAgentTool({
      task: `Provide a detailed SEO report for the website ${websiteUrl}. Analyze on-page elements like title, meta description, headings, and image alt text. Also, assess technical aspects like mobile-friendliness and page speed. Finally, provide a list of actionable suggestions for improvement.`,
      expectedResultSchema: JSON.stringify(seoSchema),
    });

    const result = await researchAgent.action();

    if (!result.success || !result.data?.result) {
      throw new Error(
        `Research agent failed: ${result.error || 'No result data'}`
      );
    }

    return result.data.result as unknown as Output;
  }
}
