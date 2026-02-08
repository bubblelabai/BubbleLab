import { z } from '@hono/zod-openapi';
import {
  ParsedBubbleWithInfoSchema,
  ParsedBubbleSchema,
  BubbleParameterType,
  ParsedWorkflowSchema,
} from './bubble-definition-schema.js';
import { CredentialType } from './types.js';
import type { BubbleName } from './types.js';
import { flowRoleSchema } from './permission-schema.js';
// POST /bubble-flow - Create new BubbleFlow schema (with code)
export const createBubbleFlowSchema = z
  .object({
    name: z.string().min(1).max(100).openapi({
      description: 'Name of the BubbleFlow',
      example: 'My First BubbleFlow',
    }),
    description: z.string().optional().openapi({
      description: 'Optional description of what this BubbleFlow does',
      example: 'A flow that processes webhook data',
    }),
    prompt: z.string().optional().openapi({
      description: 'Optional prompt used to generate the flow',
      example:
        'Create a flow that processes webhook data and sends notifications',
    }),
    code: z.string().min(1).openapi({
      description: 'TypeScript code that defines the BubbleFlow class',
      example: 'export class MyFlow extends BubbleFlow { ... }',
    }),
    eventType: z.string().min(1).openapi({
      description: 'Event type this BubbleFlow responds to',
      example: 'webhook/http',
    }),
    webhookPath: z
      .string()
      .min(1)
      .max(50)
      .regex(/^[a-zA-Z0-9-_]+$/)
      .optional()
      .openapi({
        description: 'Custom webhook path (auto-generated if not provided)',
        example: 'my-webhook',
      }),
    webhookActive: z.boolean().default(false).optional().openapi({
      description: 'Whether the webhook should be active immediately',
      example: true,
    }),
    bubbleParameters: z
      .record(z.string(), ParsedBubbleWithInfoSchema)
      .optional()
      .openapi({
        description:
          'Optional pre-parsed bubble parameters with descriptions (from AI generation). If provided, will be used instead of re-parsing the code.',
      }),
    triggerCredentialId: z.number().nullable().optional().openapi({
      description:
        'ID of credential for trigger authentication (e.g., Slack OAuth)',
    }),
  })
  .openapi('CreateBubbleFlowRequest');

// POST /bubble-flow - Create empty BubbleFlow schema (for async generation)
export const createEmptyBubbleFlowSchema = z
  .object({
    name: z.string().min(1).max(100).openapi({
      description: 'Name of the BubbleFlow',
      example: 'My First BubbleFlow',
    }),
    description: z.string().optional().openapi({
      description: 'Optional description of what this BubbleFlow does',
      example: 'A flow that processes webhook data',
    }),
    prompt: z.string().openapi({
      description: 'Prompt used to generate the flow code asynchronously',
      example:
        'Create a flow that processes webhook data and sends notifications',
    }),
    eventType: z.string().min(1).openapi({
      description: 'Event type this BubbleFlow responds to',
      example: 'webhook/http',
    }),
    webhookPath: z
      .string()
      .min(1)
      .max(50)
      .regex(/^[a-zA-Z0-9-_]+$/)
      .optional()
      .openapi({
        description: 'Custom webhook path (auto-generated if not provided)',
        example: 'my-webhook',
      }),
    webhookActive: z.boolean().default(false).optional().openapi({
      description: 'Whether the webhook should be active immediately',
      example: true,
    }),
    triggerCredentialId: z.number().nullable().optional().openapi({
      description:
        'ID of credential for trigger authentication (e.g., Slack OAuth)',
    }),
  })
  .openapi('CreateEmptyBubbleFlowRequest');

// POST /:id/execute - Execute BubbleFlow schema
export const executeBubbleFlowSchema = z
  .record(z.string(), z.unknown())
  .openapi('ExecuteBubbleFlowRequest');

// PUT /bubble-flow/:id - Update BubbleFlow parameters schema
export const updateBubbleFlowParametersSchema = z
  .object({
    bubbleParameters: z.record(
      z.string(),
      z.union([ParsedBubbleWithInfoSchema, ParsedBubbleSchema])
    ),
  })
  .openapi('UpdateBubbleFlowParametersRequest');

// PATCH /bubble-flow/:id/name - Update BubbleFlow name schema
export const updateBubbleFlowNameSchema = z
  .object({
    name: z.string().min(1).max(100).openapi({
      description: 'New name for the BubbleFlow',
      example: 'My Updated Flow',
    }),
  })
  .openapi('UpdateBubbleFlowNameRequest');

// ============================================================================
// RESPONSE SCHEMAS (Output Types)
// ============================================================================

// POST /bubble-flow - Create BubbleFlow response (with code)
export const createBubbleFlowResponseSchema = z
  .object({
    id: z.number().openapi({
      description: 'ID of the created BubbleFlow',
      example: 123,
    }),
    message: z.string().openapi({
      description: 'Success message',
      example: 'BubbleFlow created successfully',
    }),
    inputSchema: z
      .record(z.string(), z.unknown())
      .optional()
      .openapi({
        description: 'Input schema',
        example: {
          name: 'string',
          age: 'number',
        },
      }),
    bubbleParameters: z.record(z.string(), ParsedBubbleWithInfoSchema).openapi({
      description: 'Parsed bubble parameters from the BubbleFlow code',
    }),
    workflow: ParsedWorkflowSchema.optional().openapi({
      description: 'Hierarchical workflow structure with control flow',
    }),
    requiredCredentials: z
      .record(z.string(), z.array(z.nativeEnum(CredentialType)))
      .optional()
      .openapi({
        description:
          'Mapping of bubble names to their required credential types. Uses CREDENTIAL_WILDCARD ("*") for bubbles accepting any credential.',
        example: {
          'database-connection': [CredentialType.DATABASE_CRED],
          'slack-notification': [CredentialType.SLACK_CRED],
          'ai-analysis': [CredentialType.GOOGLE_GEMINI_CRED],
          'http-request': [CredentialType.CREDENTIAL_WILDCARD],
        },
      }),
    optionalCredentials: z
      .record(z.string(), z.array(z.nativeEnum(CredentialType)))
      .optional()
      .openapi({
        description:
          'Mapping of bubble names to their optional credential types (from capability optionalCredentials). Shown in UI but do not block execution.',
      }),
    eventType: z.string().min(1).openapi({
      description: 'Event type this BubbleFlow responds to',
      example: 'webhook/http',
    }),
    triggerCredentialId: z.number().nullable().optional().openapi({
      description:
        'ID of credential for trigger authentication (e.g., Slack OAuth)',
    }),
    webhook: z
      .object({
        id: z.number().openapi({ description: 'Webhook ID', example: 456 }),
        url: z.string().openapi({
          description: 'Full webhook URL',
          example: 'http://localhost:3001/webhook/user123/my-webhook',
        }),
        path: z.string().openapi({
          description: 'Webhook path',
          example: 'my-webhook',
        }),
        active: z.boolean().openapi({
          description: 'Whether webhook is active',
          example: true,
        }),
      })
      .optional()
      .openapi({
        description: 'Webhook information (if webhook was created)',
      }),
  })
  .openapi('CreateBubbleFlowResponse');

// POST /bubble-flow - Create empty BubbleFlow response (for async generation)
export const createEmptyBubbleFlowResponseSchema = z
  .object({
    id: z.number().openapi({
      description:
        'ID of the created BubbleFlow (code will be generated asynchronously)',
      example: 123,
    }),
    message: z.string().openapi({
      description: 'Success message',
      example:
        'BubbleFlow created successfully. Code generation in progress...',
    }),
    webhook: z
      .object({
        id: z.number().openapi({ description: 'Webhook ID', example: 456 }),
        url: z.string().openapi({
          description: 'Full webhook URL',
          example: 'http://localhost:3001/webhook/user123/my-webhook',
        }),
        path: z.string().openapi({
          description: 'Webhook path',
          example: 'my-webhook',
        }),
        active: z.boolean().openapi({
          description: 'Whether webhook is active',
          example: false,
        }),
      })
      .optional()
      .openapi({
        description: 'Webhook information (if webhook was created)',
      }),
  })
  .openapi('CreateEmptyBubbleFlowResponse');

// Used credential schema for credential visibility in shared workflows
export const usedCredentialSchema = z
  .object({
    id: z.number().openapi({
      description: 'Credential ID',
      example: 123,
    }),
    name: z.string().openapi({
      description: 'Credential name',
      example: 'My OpenAI Key',
    }),
    type: z.nativeEnum(CredentialType).openapi({
      description: 'Credential type',
      example: CredentialType.OPENAI_CRED,
    }),
    ownerId: z.string().openapi({
      description: 'User ID of the credential owner',
      example: 'user_abc',
    }),
    isMine: z.boolean().openapi({
      description: 'Whether this credential belongs to the current user',
      example: true,
    }),
  })
  .openapi('UsedCredential');

export type UsedCredential = z.infer<typeof usedCredentialSchema>;

// GET /bubble-flow/:id - Get BubbleFlow details response
export const bubbleFlowDetailsResponseSchema = z
  .object({
    id: z.number().openapi({ description: 'BubbleFlow ID' }),
    name: z.string().openapi({ description: 'BubbleFlow name' }),
    description: z.string().optional().openapi({ description: 'Description' }),
    prompt: z
      .string()
      .optional()
      .openapi({ description: 'Original prompt used to generate the flow' }),
    eventType: z.string().openapi({ description: 'Event type' }),
    code: z.string().openapi({ description: 'TypeScript source code' }),
    generationError: z
      .string()
      .nullable()
      .optional()
      .openapi({ description: 'Error message if code generation failed' }),
    inputSchema: z
      .record(z.string(), z.unknown())
      .optional()
      .openapi({ description: 'Input schema' }),
    cron: z
      .string()
      .nullable()
      .optional()
      .openapi({ description: 'Cron expression' }),
    cronActive: z
      .boolean()
      .optional()
      .openapi({ description: 'Whether cron scheduling is active' }),
    defaultInputs: z
      .record(z.string(), z.unknown())
      .optional()
      .openapi({ description: 'Default inputs for cron scheduling' }),
    isActive: z
      .boolean()
      .openapi({ description: 'Whether the BubbleFlow is active' }),
    organizationId: z.number().optional().openapi({
      description: 'Organization ID this flow belongs to',
      example: 123,
    }),
    requiredCredentials: z
      .record(z.string(), z.array(z.nativeEnum(CredentialType)))
      .openapi({ description: 'Required credentials by bubble' }),
    optionalCredentials: z
      .record(z.string(), z.array(z.nativeEnum(CredentialType)))
      .optional()
      .openapi({
        description:
          'Optional credentials by bubble (from capability optionalCredentials)',
      }),
    usedCredentials: z.array(usedCredentialSchema).optional().openapi({
      description:
        'Credentials used in this flow with metadata (for shared workflow visibility)',
    }),
    displayedBubbleParameters: z
      .record(
        z.string(),
        z.object({
          variableName: z.string(),
          bubbleName: z.string(),
          className: z.string(),
          parameters: z.array(
            z.object({
              name: z.string(),
              value: z.unknown(),
              type: z.nativeEnum(BubbleParameterType),
            })
          ),
          hasAwait: z.boolean(),
          hasActionCall: z.boolean(),
        })
      )
      .optional()
      .openapi({
        description: 'Displayed bubble parameters for visualization',
      }),
    bubbleParameters: z.record(z.string(), ParsedBubbleWithInfoSchema).openapi({
      description: 'Bubble parameters',
    }),
    workflow: ParsedWorkflowSchema.optional().openapi({
      description: 'Hierarchical workflow structure with control flow',
    }),
    metadata: z.record(z.string(), z.unknown()).optional().openapi({
      description:
        'Flow metadata including conversation messages from generation',
    }),
    permission: z
      .enum(['owner', 'editor', 'runner', 'viewer'])
      .optional()
      .openapi({
        description: 'Current user permission level for this flow',
        example: 'owner',
      }),
    triggerCredentialId: z.number().nullable().optional().openapi({
      description: 'Credential ID for trigger authentication',
    }),
    triggerCredential: usedCredentialSchema.nullable().optional().openapi({
      description:
        'Trigger credential metadata with owner info (for shared workflow visibility)',
    }),
    createdAt: z.string().openapi({ description: 'Creation timestamp' }),
    updatedAt: z.string().openapi({ description: 'Update timestamp' }),
    webhook_url: z
      .string()
      .openapi({ description: 'Webhook URL for this bubble flow' }),
  })
  .openapi('BubbleFlowDetailsResponse');

// Individual BubbleFlow list item schema
export const bubbleFlowListItemSchema = z.object({
  id: z.number().openapi({ description: 'BubbleFlow ID' }),
  name: z.string().openapi({ description: 'BubbleFlow name' }),
  description: z.string().optional().openapi({ description: 'Description' }),
  eventType: z.string().openapi({ description: 'Event type' }),
  isActive: z
    .boolean()
    .openapi({ description: 'Whether the BubbleFlow is active' }),
  cronActive: z
    .boolean()
    .openapi({ description: 'Whether cron scheduling is active' }),
  cronSchedule: z.string().optional().openapi({ description: 'Cron schedule' }),
  webhookExecutionCount: z
    .number()
    .openapi({ description: 'Webhook execution count' }),
  webhookFailureCount: z
    .number()
    .openapi({ description: 'Webhook failure count' }),
  executionCount: z
    .number()
    .openapi({ description: 'Total number of executions in history' }),
  bubbles: z
    .array(
      z.object({
        bubbleName: z
          .string()
          .openapi({ description: 'Bubble name' }) as z.ZodType<BubbleName>,
        className: z.string().openapi({ description: 'Bubble class name' }),
      })
    )
    .optional()
    .openapi({ description: 'List of bubbles used in this flow' }),
  permission: flowRoleSchema.optional().openapi({
    description: 'User permission level for this flow',
    example: 'owner',
  }),
  organizationId: z.number().optional().openapi({
    description: 'Organization ID this flow belongs to',
    example: 123,
  }),
  ownerId: z.string().openapi({
    description: 'User ID of the flow owner',
    example: 'user_abc123',
  }),
  triggerCredentialId: z.number().nullable().optional().openapi({
    description: 'Credential ID for trigger authentication',
  }),
  createdAt: z.string().openapi({ description: 'Creation timestamp' }),
  updatedAt: z.string().openapi({ description: 'Update timestamp' }),
});

// GET /bubble-flow - List BubbleFlows response with user info
export const bubbleFlowListResponseSchema = z.object({
  bubbleFlows: z.array(bubbleFlowListItemSchema).default([]),
  userMonthlyUsage: z
    .object({
      count: z.number().openapi({ description: 'Current monthly usage count' }),
    })
    .openapi({ description: 'User monthly usage information' }),
});
// POST /bubble-flow/:id/activate - Activate workflow
export const activateBubbleFlowResponseSchema = z
  .object({
    success: z.boolean().openapi({
      description: 'Whether the activation was successful',
      example: true,
    }),
    webhookUrl: z.string().openapi({
      description: 'Webhook URL for the activated workflow',
      example: 'https://api.nodex.dev/webhook/user123/workflow-123',
    }),
    message: z.string().openapi({
      description: 'Success message',
      example: 'Workflow activated successfully! Your Slack bot is now ready.',
    }),
  })
  .openapi('ActivateBubbleFlowResponse');

export type ActivateBubbleFlowResponse = z.infer<
  typeof activateBubbleFlowResponseSchema
>;
// Keep interface for backwards compatibility
export type CreateBubbleFlowResponse = z.infer<
  typeof createBubbleFlowResponseSchema
>;
export type CreateBubbleFlowRequest = z.infer<typeof createBubbleFlowSchema>;
export type CreateEmptyBubbleFlowRequest = z.infer<
  typeof createEmptyBubbleFlowSchema
>;
export type CreateEmptyBubbleFlowResponse = z.infer<
  typeof createEmptyBubbleFlowResponseSchema
>;
export type ExecuteBubbleFlowRequest = z.infer<typeof executeBubbleFlowSchema>;

export type UpdateBubbleFlowParametersRequest = z.infer<
  typeof updateBubbleFlowParametersSchema
>;
export type UpdateBubbleFlowParametersResponse = z.infer<
  typeof updateBubbleFlowParametersSchema
>;
export type UpdateBubbleFlowNameRequest = z.infer<
  typeof updateBubbleFlowNameSchema
>;
export type BubbleFlowDetailsResponse = z.infer<
  typeof bubbleFlowDetailsResponseSchema
>;
// Response types (derived from response schemas)
export type BubbleFlowListResponse = z.infer<
  typeof bubbleFlowListResponseSchema
>;
export type BubbleFlowListItem = z.infer<typeof bubbleFlowListItemSchema>;
