import { z } from 'zod';
import { ToolBubble } from '../../types/tool-bubble-class.js';
import type { BubbleContext } from '../../types/bubble.js';
import {
  CredentialType,
  TRIGGER_EVENT_CONFIGS,
  getTriggerEventConfig,
  type BubbleTriggerEventRegistry,
} from '@bubblelab/shared-schemas';

/**
 * Map trigger types to their TypeScript payload interface names
 */
const TRIGGER_PAYLOAD_TYPE_MAP: Record<
  keyof BubbleTriggerEventRegistry,
  string
> = {
  'slack/bot_mentioned': 'SlackMentionEvent',
  'slack/message_received': 'SlackMessageReceivedEvent',
  'airtable/record_created': 'AirtableRecordCreatedEvent',
  'airtable/record_updated': 'AirtableRecordUpdatedEvent',
  'airtable/record_deleted': 'AirtableRecordDeletedEvent',
  'schedule/cron': 'CronEvent',
  'webhook/http': 'WebhookEvent',
};

// Define the parameters schema
const GetTriggerDetailToolParamsSchema = z.object({
  triggerType: z
    .string()
    .optional()
    .describe(
      "The trigger type to get details about (e.g., 'slack/bot_mentioned', 'webhook/http'). If not provided, returns a list of all available triggers."
    ),
  credentials: z
    .record(z.nativeEnum(CredentialType), z.string())
    .optional()
    .describe(
      'Object mapping credential types to values (injected at runtime)'
    ),
});

// Type definitions
type GetTriggerDetailToolParamsInput = z.input<
  typeof GetTriggerDetailToolParamsSchema
>;
type GetTriggerDetailToolParams = z.output<
  typeof GetTriggerDetailToolParamsSchema
>;

// Result schema for validation
const GetTriggerDetailToolResultSchema = z.object({
  triggerType: z.string().optional().describe('The requested trigger type'),
  serviceName: z
    .string()
    .optional()
    .describe('Service name for logo lookup (e.g., Slack, Cron)'),
  friendlyName: z.string().optional().describe('Human-friendly trigger name'),
  description: z
    .string()
    .optional()
    .describe('Description of what this trigger does'),
  setupGuide: z
    .string()
    .optional()
    .describe('Markdown setup guide for configuring this trigger'),
  payloadSchema: z
    .string()
    .optional()
    .describe('JSON Schema string for the payload'),
  payloadTypeInterface: z
    .string()
    .optional()
    .describe(
      'TypeScript interface name to use for the payload (e.g., SlackMentionEvent)'
    ),
  availableTriggers: z
    .array(
      z.object({
        type: z.string(),
        friendlyName: z.string(),
        description: z.string(),
      })
    )
    .optional()
    .describe(
      'List of all available triggers (when no specific trigger requested)'
    ),
  success: z.boolean().describe('Whether the operation was successful'),
  error: z.string().describe('Error message if operation failed'),
});

type GetTriggerDetailToolResult = z.output<
  typeof GetTriggerDetailToolResultSchema
>;

export class GetTriggerDetailTool extends ToolBubble<
  GetTriggerDetailToolParams,
  GetTriggerDetailToolResult
> {
  static readonly type = 'tool' as const;
  static readonly bubbleName = 'get-trigger-detail-tool';
  static readonly schema = GetTriggerDetailToolParamsSchema;
  static readonly resultSchema = GetTriggerDetailToolResultSchema;
  static readonly shortDescription =
    'Provides detailed information about BubbleFlow trigger types including setup guides and payload schemas';
  static readonly longDescription = `
    A tool that retrieves comprehensive information about BubbleFlow trigger types.

    Returns detailed information including:
    - Service name and friendly display name
    - Description of what the trigger does
    - Setup guide with step-by-step configuration instructions
    - Payload schema (JSON Schema format)
    - TypeScript interface name for proper typing

    Use cases:
    - Understanding how to configure a specific trigger (Slack, Cron, Webhook)
    - Getting the correct payload interface to extend in your BubbleFlow
    - Learning about available trigger types
    - Generating properly typed BubbleFlow code

    If no triggerType is specified, returns a list of all available triggers.
  `;
  static readonly alias = 'trigger';

  constructor(
    params: GetTriggerDetailToolParamsInput,
    context?: BubbleContext
  ) {
    super(params, context);
  }

  async performAction(
    context?: BubbleContext
  ): Promise<GetTriggerDetailToolResult> {
    void context; // Context available but not currently used

    const { triggerType } = this.params;

    // If no trigger type specified, return list of all available triggers
    if (!triggerType) {
      const availableTriggers = Object.entries(TRIGGER_EVENT_CONFIGS).map(
        ([type, config]) => ({
          type,
          friendlyName: config.friendlyName,
          description: config.description,
        })
      );

      return {
        availableTriggers,
        success: true,
        error: '',
      };
    }

    // Validate trigger type
    if (!(triggerType in TRIGGER_EVENT_CONFIGS)) {
      const validTypes = Object.keys(TRIGGER_EVENT_CONFIGS).join(', ');
      return {
        success: false,
        error: `Invalid trigger type '${triggerType}'. Valid types are: ${validTypes}`,
      };
    }

    // Get the trigger configuration
    const config = getTriggerEventConfig(
      triggerType as keyof BubbleTriggerEventRegistry
    );

    // Get the TypeScript payload interface name
    const payloadTypeInterface =
      TRIGGER_PAYLOAD_TYPE_MAP[triggerType as keyof BubbleTriggerEventRegistry];

    return {
      triggerType,
      serviceName: config.serviceName,
      friendlyName: config.friendlyName,
      description: config.description,
      setupGuide: config.setupGuide,
      payloadSchema: JSON.stringify(config.payloadSchema, null, 2),
      payloadTypeInterface,
      success: true,
      error: '',
    };
  }
}
