import { z } from 'zod';
import { WorkflowBubble } from '../../types/workflow-bubble-class.js';
import { SlackBubble } from '../service-bubble/slack/index.js';
import { AIAgentBubble } from '../service-bubble/ai-agent.js';
import type { BubbleContext } from '../../types/bubble.js';
import {
  type CredentialOptions,
  CredentialType,
  AvailableModels,
} from '@bubblelab/shared-schemas';

// Parameter schema with user-friendly names and clear descriptions
const SlackNotifierParamsSchema = z.object({
  /**
   * The raw data or content to be formatted for Slack notification
   */
  contentToFormat: z
    .string()
    .describe('Raw content or data to format for Slack'),

  /**
   * The original user query or context that generated this content
   */
  originalUserQuery: z
    .string()
    .optional()
    .describe('Original user question or context'),

  /**
   * Target Slack channel name (without #) or channel ID
   */
  targetChannel: z
    .string()
    .describe('Slack channel name (without #) or channel ID'),

  /**
   * Optional custom message title/header for the notification
   */
  messageTitle: z
    .string()
    .optional()
    .describe('Custom title for the Slack message'),

  /**
   * Tone and style for the AI formatting (professional, casual, technical, etc.)
   */
  messageStyle: z
    .enum(['professional', 'casual', 'technical', 'concise', 'detailed'])
    .default('professional')
    .describe('Style and tone for message formatting'),

  /**
   * Whether to include emojis and rich formatting in the message
   */
  includeFormatting: z
    .boolean()
    .default(true)
    .describe('Include emojis and rich Slack formatting'),

  /**
   * Maximum message length (Slack has limits)
   */
  maxMessageLength: z
    .number()
    .default(3000)
    .describe('Maximum message length for Slack'),

  /**
   * AI model configuration for content formatting
   */
  aiModel: z
    .object({
      model: AvailableModels.default('google/gemini-2.5-flash'),
      temperature: z.number().min(0).max(1).default(0.3),
      maxTokens: z.number().default(50000),
    })
    .optional()
    .describe('AI model settings for content formatting'),

  /**
   * Injected credentials from the system
   */
  credentials: z
    .record(z.nativeEnum(CredentialType), z.string())
    .optional()
    .describe(
      'Object mapping credential types to values (injected at runtime)'
    ),
});

type SlackNotifierParamsInput = z.input<typeof SlackNotifierParamsSchema>;
type SlackNotifierParams = z.output<typeof SlackNotifierParamsSchema>;

// Result schema with notification delivery information
const SlackNotifierResultSchema = z.object({
  success: z.boolean(),
  error: z.string(),

  /**
   * Information about the sent Slack message
   */
  messageInfo: z
    .object({
      /**
       * Slack message timestamp (unique identifier)
       */
      messageTimestamp: z.string().optional(),

      /**
       * Channel ID where message was sent
       */
      channelId: z.string().optional(),

      /**
       * Channel name where message was sent
       */
      channelName: z.string().optional(),

      /**
       * The formatted message that was sent
       */
      formattedMessage: z.string().optional(),

      /**
       * Message length in characters
       */
      messageLength: z.number().optional(),
    })
    .optional(),

  /**
   * AI formatting process information
   */
  formattingInfo: z
    .object({
      /**
       * AI model used for formatting
       */
      modelUsed: z.string().optional(),

      /**
       * Whether content was truncated due to length limits
       */
      wasTruncated: z.boolean().default(false),

      /**
       * Original content length before formatting
       */
      originalLength: z.number().optional(),
    })
    .optional(),
});

type SlackNotifierResult = z.infer<typeof SlackNotifierResultSchema>;

/**
 * SlackNotifierWorkflowBubble - Your personal data analyst for Slack communications
 *
 * This workflow bubble acts like a seasoned data analyst who transforms raw information
 * into compelling, actionable Slack messages that your team will actually want to read:
 *
 * 1. **Analyzes content** - Spots patterns, key insights, and business implications
 * 2. **Tells the story** - Converts dry data into engaging narratives with context
 * 3. **Makes it actionable** - Provides recommendations and next steps
 * 4. **Delivers naturally** - Uses conversational, human-like communication style
 * 5. **Handles logistics** - Finds channels and manages message delivery
 *
 * Perfect for:
 * - Sharing analysis results that drive decisions
 * - Automated insights that feel personally crafted
 * - Business intelligence updates with personality
 * - Data discoveries that need immediate attention
 * - Reports that people actually read and act on
 */
export class SlackNotifierWorkflowBubble extends WorkflowBubble<
  SlackNotifierParams,
  SlackNotifierResult
> {
  static readonly bubbleName = 'slack-notifier';
  static readonly schema = SlackNotifierParamsSchema;
  static readonly resultSchema = SlackNotifierResultSchema;
  static readonly shortDescription =
    'Data analyst-powered Slack notifications that tell compelling stories';
  static readonly longDescription =
    'Transforms raw data and insights into engaging, conversational Slack messages that colleagues actually want to read. Uses AI with a data analyst personality to spot patterns, provide context, and make information actionable. Perfect for sharing analysis results, automated reports, and business intelligence updates with natural, human-like communication.';
  static readonly alias = 'notify-slack';
  static readonly type = 'workflow' as const;

  constructor(
    params: SlackNotifierParamsInput,
    context?: BubbleContext,
    instanceId?: string
  ) {
    super(params, context, instanceId);
  }

  protected async performAction(): Promise<SlackNotifierResult> {
    const {
      contentToFormat,
      originalUserQuery,
      targetChannel,
      messageTitle,
      messageStyle,
      includeFormatting,
      maxMessageLength,
      aiModel,
      credentials,
    } = this.params;

    try {
      console.log(
        `[SlackNotifier] Starting notification workflow for channel: ${targetChannel}`
      );

      // Step 1: Find the target Slack channel
      console.log('[SlackNotifier] Finding target Slack channel...');
      const channelResult = await this.findSlackChannel(
        targetChannel,
        credentials
      );

      if (!channelResult.success) {
        return {
          success: false,
          error: channelResult.error,
        };
      }

      // Step 2: Format the content using AI
      console.log('[SlackNotifier] Formatting content with AI...');
      const formattingResult = await this.formatContentWithAI(
        contentToFormat,
        originalUserQuery,
        messageTitle,
        messageStyle,
        includeFormatting,
        maxMessageLength,
        aiModel,
        credentials
      );

      if (!formattingResult.success) {
        return {
          success: false,
          error: formattingResult.error,
        };
      }

      // Step 3: Send the formatted message to Slack
      console.log('[SlackNotifier] Sending message to Slack...');
      const sendResult = await this.sendToSlack(
        channelResult.channelId!,
        formattingResult.formattedMessage!,
        credentials
      );

      if (!sendResult.success) {
        return {
          success: false,
          error: sendResult.error,
        };
      }

      console.log(
        '[SlackNotifier] Notification workflow completed successfully'
      );

      return {
        success: true,
        error: '',
        messageInfo: {
          messageTimestamp: sendResult.messageTimestamp,
          channelId: channelResult.channelId,
          channelName: channelResult.channelName,
          formattedMessage: formattingResult.formattedMessage,
          messageLength: formattingResult.formattedMessage?.length || 0,
        },
        formattingInfo: {
          modelUsed: aiModel?.model || 'google/gemini-2.5-flash',
          wasTruncated: formattingResult.wasTruncated ?? false,
          originalLength: contentToFormat.length,
        },
      };
    } catch (error) {
      console.error('[SlackNotifier] Workflow execution failed:', error);

      return {
        success: false,
        error: `Slack notification workflow failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Find the target Slack channel by name or ID
   */
  private async findSlackChannel(
    targetChannel: string,
    credentials?: CredentialOptions
  ) {
    try {
      const slackChannelFinderBubble = new SlackBubble(
        {
          operation: 'list_channels',
          ...(credentials && { credentials }),
        },
        this.context,
        'slackChannelFinderBubble'
      );

      const channelsResult = await slackChannelFinderBubble.action();

      if (!channelsResult.success) {
        return {
          success: false,
          error: `Failed to list Slack channels: ${channelsResult.error}`,
        };
      }

      const channels = channelsResult.data?.channels as
        | Array<{ id: string; name: string }>
        | undefined;

      if (!channels) {
        return {
          success: false,
          error: 'No channels data received from Slack',
        };
      }

      // Try to find channel by name first, then by ID
      let targetChannelObj = channels.find(
        (channel) => channel.name === targetChannel
      );

      if (!targetChannelObj) {
        targetChannelObj = channels.find(
          (channel) => channel.id === targetChannel
        );
      }

      if (!targetChannelObj) {
        const availableChannels = channels.map((c) => c.name).join(', ');
        return {
          success: false,
          error: `Channel '${targetChannel}' not found. Available channels: ${availableChannels}`,
        };
      }

      return {
        success: true,
        channelId: targetChannelObj.id,
        channelName: targetChannelObj.name,
        error: '',
      };
    } catch (error) {
      return {
        success: false,
        error: `Channel discovery failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Format content using AI for better Slack presentation
   */
  private async formatContentWithAI(
    content: string,
    userQuery?: string,
    title?: string,
    style: string = 'professional',
    includeFormatting: boolean = true,
    maxLength: number = 3000,
    aiModel?: SlackNotifierParams['aiModel'],
    credentials?: CredentialOptions
  ) {
    try {
      // Build the formatting prompt based on style and requirements
      const formatPrompt = this.buildFormattingPrompt(
        content,
        userQuery,
        title,
        style,
        includeFormatting,
        maxLength
      );

      const aiAgentBubble = new AIAgentBubble(
        {
          message: formatPrompt,
          systemPrompt: `You're a seasoned data analyst who loves turning complex information into clear, actionable insights for your team. You have a knack for:

• **Spotting the story in data** - You don't just present numbers, you explain what they mean and why they matter
• **Making complex simple** - You break down technical findings into business language that anyone can understand
• **Being genuinely helpful** - You anticipate questions and provide context that helps people make informed decisions
• **Communicating with personality** - You're professional but approachable, using a conversational tone that feels human

When formatting for Slack:
${includeFormatting ? '• Use Slack formatting thoughtfully (**, *, `code`, bullet points) to highlight key insights' : '• Keep formatting clean and readable with plain text'}
• Stay under ${maxLength} characters but make every word count
• Match the ${style} tone while keeping your helpful analyst personality
• ${title ? `Lead with "${title}" but make it feel natural` : 'Start with a compelling headline that captures attention'}
• Tell the story: What happened? Why does it matter? What should we do about it?
• Add your analytical perspective - don't just report, interpret and advise
• End naturally without formal signatures or closings - this is Slack, not email

Remember: Your goal is to help your colleagues understand and act on information, not just consume it.`,
          ...(aiModel && { model: { ...aiModel } }),
          ...(credentials && { credentials }),
        },
        this.context
      );

      const aiResult = await aiAgentBubble.action();

      if (!aiResult.success) {
        return {
          success: false,
          error: `AI formatting failed: ${aiResult.error}`,
        };
      }

      const formattedMessage = aiResult.data?.response as string;

      if (!formattedMessage) {
        return {
          success: false,
          error: 'AI formatting produced no output',
        };
      }

      // Check if message was truncated
      const wasTruncated = formattedMessage.length >= maxLength;

      return {
        success: true,
        formattedMessage: formattedMessage.substring(0, maxLength),
        wasTruncated,
        error: '',
      };
    } catch (error) {
      return {
        success: false,
        error: `Content formatting failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Send the formatted message to Slack
   */
  private async sendToSlack(
    channelId: string,
    message: string,
    credentials?: CredentialOptions
  ) {
    try {
      const slackNotifierBubble = new SlackBubble(
        {
          operation: 'send_message',
          channel: channelId,
          text: message,
          ...(credentials && { credentials }),
        },
        this.context,
        'slackNotifierBubble'
      );

      const sendResult = await slackNotifierBubble.action();

      if (!sendResult.success) {
        return {
          success: false,
          error: `Failed to send Slack message: ${sendResult.error}`,
        };
      }

      return {
        success: true,
        messageTimestamp: sendResult.data?.ts as string,
        error: '',
      };
    } catch (error) {
      return {
        success: false,
        error: `Slack message sending failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Build the AI formatting prompt based on parameters
   */
  private buildFormattingPrompt(
    content: string,
    userQuery?: string,
    title?: string,
    style: string = 'professional',
    includeFormatting: boolean = true,
    maxLength: number = 3000
  ): string {
    const contextSection = userQuery
      ? `**Context**: Someone asked "${userQuery}" and here's what we found.\n\n`
      : '';
    const titleSection = title ? `**Focus**: ${title}\n\n` : '';

    return `${contextSection}${titleSection}**Here's the data/information to work with:**

${content}

---

Time to work your analyst magic! Transform this into a compelling ${style} Slack message that your colleagues will actually want to read and act on.

Your mission:
• **Tell the story** - What's the key insight? What pattern or trend jumps out?
• **Make it human** - Use conversational language that feels natural, not robotic
• **Add your perspective** - What does this mean for the business? Why should they care?
• **Be actionable** - What should someone do with this information?
• **Stay focused** - Under ${maxLength} characters, but make every word matter
${includeFormatting ? '• **Format smart** - Use Slack formatting (**, *, `code`, bullets) to highlight what matters most' : '• **Keep it clean** - Plain text that flows naturally'}
${title ? `• **Lead strong** - Open with "${title}" but make it feel conversational` : '• **Hook them** - Start with a headline that makes people want to keep reading'}

Think of this as briefing a colleague over coffee - insightful, helpful, and genuinely engaging.

Just give me the message, ready to send!`;
  }
}
