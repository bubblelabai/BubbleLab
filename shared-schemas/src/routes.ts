/**
 * @bubblelab/shared-schemas - API Schema Definitions
 *
 * This file contains all Zod schemas and TypeScript types for the NodeX API.
 *
 * IMPORTANT: All new API schemas should be written in this shared package to ensure
 * type safety and consistency between frontend and backend applications.
 *
 * ## Schema Organization
 *
 * ### Request Schemas (Input Validation)
 * - createBubbleFlowSchema - POST /bubble-flow
 * - executeBubbleFlowSchema - POST /:id/execute
 * - createCredentialSchema - POST /credentials
 * - updateBubbleFlowParametersSchema - PUT /bubble-flow/:id
 *
 * ### Response Schemas (Output Types)
 * - createBubbleFlowResponseSchema - POST /bubble-flow response
 * - executeBubbleFlowResponseSchema - POST /:id/execute response
 * - credentialResponseSchema - GET /credentials response
 * - createCredentialResponseSchema - POST /credentials response
 * - bubbleFlowDetailsResponseSchema - GET /bubble-flow/:id response
 * - listBubbleFlowsResponseSchema - GET /bubble-flow response
 * - webhookResponseSchema - POST /webhook/{userId}/{path} response
 * - errorResponseSchema - Error responses
 * - successMessageResponseSchema - Success responses
 *
 * ### TypeScript Types
 * All schemas have corresponding TypeScript types exported for use in both
 * frontend and backend applications.
 *
 * ## Usage Examples
 *
 * ### Backend (Validation)
 * ```typescript
 * import { createBubbleFlowSchema } from '@bubblelab/shared-schemas';
 *
 * // Validate request body
 * const validatedData = createBubbleFlowSchema.parse(requestBody);
 * ```
 *
 * ### Frontend (Type Safety)
 * ```typescript
 * import type { CreateBubbleFlowRequest, CreateBubbleFlowResponse } from '@bubblelab/shared-schemas';
 *
 * const createBubbleFlow = async (data: CreateBubbleFlowRequest): Promise<CreateBubbleFlowResponse> => {
 *   // API call with full type safety
 * };
 * ```
 *
 * ## Adding New Schemas
 *
 * 1. Define the Zod schema with proper OpenAPI metadata
 * 2. Export the schema for validation
 * 3. Export the TypeScript type using `z.infer<typeof schemaName>`
 * 4. Update this documentation
 * 5. Rebuild the package: `pnpm build:core`
 */

import { z } from 'zod';
import { databaseMetadataSchema } from './database-definition-schema';
import { CredentialType } from './types';
import {
  BubbleParameterType,
  ParsedBubbleWithInfoSchema,
} from './bubble-definition-schema';

// ============================================================================
// BUBBLEFLOW PARSING TYPES (Backend/Frontend Shared)
// ============================================================================

// ============================================================================
// REQUEST SCHEMAS (Input Validation)
// ============================================================================

// POST /bubble-flow - Create new BubbleFlow schema
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
  })
  .openapi('CreateBubbleFlowRequest');

// POST /:id/execute - Execute BubbleFlow schema
export const executeBubbleFlowSchema = z
  .record(z.string(), z.unknown())
  .openapi('ExecuteBubbleFlowRequest');

// POST /credentials - Create credential schema
export const createCredentialSchema = z
  .object({
    credentialType: z.nativeEnum(CredentialType).openapi({
      description: 'Type of credential to store',
      example: CredentialType.OPENAI_CRED,
    }),
    value: z.string().min(1).openapi({
      description: 'The credential value (will be encrypted)',
      example: 'sk-1234567890abcdef',
    }),
    name: z.string().optional().openapi({
      description: 'Optional user-friendly name for the credential',
      example: 'My OpenAI Key',
    }),
    skipValidation: z.boolean().optional().openapi({
      description:
        'Skip credential validation before storing (for testing/admin use)',
      example: false,
    }),
    credentialConfigurations: z
      .record(z.string(), z.unknown())
      .optional()
      .openapi({
        description:
          'Optional configurations for credential validation (e.g., ignoreSSL for PostgreSQL)',
        example: { ignoreSSL: true },
      }),
    metadata: databaseMetadataSchema.optional().openapi({
      description:
        'Optional metadata for the credential (e.g., database schema for DATABASE_CRED)',
      example: {
        tables: {
          users: {
            id: 'integer',
            email: 'character varying',
            created_at: 'timestamp with time zone',
          },
        },
        rules: [
          {
            id: 'rule-1',
            text: 'No direct DELETE on users table',
            enabled: true,
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-01T00:00:00Z',
          },
        ],
      },
    }),
  })
  .openapi('CreateCredentialRequest');

// PUT /credentials/:id - Update credential schema
export const updateCredentialSchema = z
  .object({
    value: z.string().optional().openapi({
      description:
        'The credential value (will be encrypted). Leave empty to keep current value.',
      example: 'sk-1234567890abcdef',
    }),
    name: z.string().optional().openapi({
      description: 'Optional user-friendly name for the credential',
      example: 'My OpenAI Key',
    }),
    skipValidation: z.boolean().optional().openapi({
      description:
        'Skip credential validation before storing (for testing/admin use)',
      example: false,
    }),
    credentialConfigurations: z
      .record(z.string(), z.unknown())
      .optional()
      .openapi({
        description:
          'Optional configurations for credential validation (e.g., ignoreSSL for PostgreSQL)',
        example: { ignoreSSL: true },
      }),
    metadata: databaseMetadataSchema.optional().openapi({
      description:
        'Optional metadata for the credential (e.g., database schema for DATABASE_CRED)',
      example: {
        tables: {
          users: {
            id: 'integer',
            email: 'character varying',
            created_at: 'timestamp with time zone',
          },
        },
      },
    }),
  })
  .openapi('UpdateCredentialRequest');

// PUT /bubble-flow/:id - Update BubbleFlow parameters schema
export const updateBubbleFlowParametersSchema = z
  .object({
    bubbleParameters: z.record(
      z.string(),
      z.object({
        variableName: z.string(),
        variableId: z.number().optional(),
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
    ),
  })
  .openapi('UpdateBubbleFlowParametersRequest');

// ============================================================================
// RESPONSE SCHEMAS (Output Types)
// ============================================================================

// POST /bubble-flow - Create BubbleFlow response
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
    bubbleParameters: z
      .record(
        z.string(),
        z.object({
          variableName: z.string(),
          variableId: z.number().optional(),
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
      .openapi({
        description: 'Parsed bubble parameters from the BubbleFlow code',
        example: {
          postgres: {
            variableName: 'postgres',
            bubbleName: 'postgresql',
            className: 'PostgreSQLBubble',
            parameters: [
              {
                name: 'connectionString',
                value: 'process.env.DATABASE_URL!',
                type: BubbleParameterType.ENV,
              },
            ],
            hasAwait: false,
            hasActionCall: false,
          },
        },
      }),
    requiredCredentials: z
      .record(z.string(), z.array(z.nativeEnum(CredentialType)))
      .optional()
      .openapi({
        description:
          'Mapping of bubble names to their required credential types',
        example: {
          'database-connection': [CredentialType.DATABASE_CRED],
          'slack-notification': [CredentialType.SLACK_CRED],
          'ai-analysis': [CredentialType.GOOGLE_GEMINI_CRED],
        },
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

// Keep interface for backwards compatibility
export type CreateBubbleFlowResponse = z.infer<
  typeof createBubbleFlowResponseSchema
>;

// POST /:id/execute - Execute BubbleFlow response
export const executeBubbleFlowResponseSchema = z
  .object({
    executionId: z.number().openapi({
      description: 'ID of the execution record',
      example: 789,
    }),
    success: z.boolean().openapi({
      description: 'Whether the execution was successful',
      example: true,
    }),
    data: z
      .any()
      .optional()
      .openapi({
        description: 'Data returned by the BubbleFlow (if successful)',
        example: { result: 'processed successfully', count: 42 },
      }),
    error: z.string().optional().openapi({
      description: 'Error message (if execution failed)',
      example: 'Validation error in BubbleFlow',
    }),
  })
  .openapi('ExecuteBubbleFlowResponse');

export type ExecuteBubbleFlowResponse = z.infer<
  typeof executeBubbleFlowResponseSchema
>;

// ExecutionResult interface for internal use (matches the API response)
export type ExecutionResult = ExecuteBubbleFlowResponse;

// GET /credentials - List credentials response
export const credentialResponseSchema = z
  .object({
    id: z.number().openapi({ description: 'Credential ID' }),
    credentialType: z.string().openapi({ description: 'Type of credential' }),
    name: z.string().optional().openapi({ description: 'Credential name' }),
    metadata: databaseMetadataSchema
      .optional()
      .openapi({ description: 'Credential metadata' }),
    createdAt: z.string().openapi({ description: 'Creation timestamp' }),

    // OAuth-specific fields
    isOauth: z
      .boolean()
      .optional()
      .openapi({ description: 'Whether this is an OAuth credential' }),
    oauthProvider: z
      .string()
      .optional()
      .openapi({ description: 'OAuth provider name' }),
    oauthExpiresAt: z
      .string()
      .optional()
      .openapi({ description: 'OAuth token expiration timestamp' }),
    oauthScopes: z
      .array(z.string())
      .optional()
      .openapi({ description: 'OAuth scopes granted' }),
    oauthStatus: z
      .enum(['active', 'expired', 'needs_refresh'])
      .optional()
      .openapi({ description: 'OAuth token status' }),
  })
  .openapi('CredentialResponse');

// POST /credentials - Create credential response
export const createCredentialResponseSchema = z
  .object({
    id: z.number().openapi({ description: 'Credential ID' }),
    message: z.string().openapi({ description: 'Success message' }),
  })
  .openapi('CreateCredentialResponse');

// PUT /credentials/:id - Update credential response
export const updateCredentialResponseSchema = z
  .object({
    id: z.number().openapi({ description: 'Credential ID' }),
    message: z.string().openapi({ description: 'Success message' }),
  })
  .openapi('UpdateCredentialResponse');

// General success message response (used by DELETE /credentials/:id, DELETE /bubble-flow/:id, PUT /bubble-flow/:id)
export const successMessageResponseSchema = z
  .object({
    message: z.string().openapi({ description: 'Success message' }),
  })
  .openapi('SuccessMessageResponse');

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
    inputSchema: z
      .record(z.string(), z.unknown())
      .optional()
      .openapi({ description: 'Input schema' }),
    isActive: z
      .boolean()
      .openapi({ description: 'Whether the BubbleFlow is active' }),
    requiredCredentials: z
      .record(z.string(), z.array(z.nativeEnum(CredentialType)))
      .openapi({ description: 'Required credentials by bubble' }),
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
    createdAt: z.string().openapi({ description: 'Creation timestamp' }),
    updatedAt: z.string().openapi({ description: 'Update timestamp' }),
    webhook_url: z
      .string()
      .openapi({ description: 'Webhook URL for this bubble flow' }),
  })
  .openapi('BubbleFlowDetailsResponse');

// Webhook execution response (used internally)
export const webhookExecutionResponseSchema = z
  .object({
    executionId: z.number().openapi({ description: 'Execution ID' }),
    success: z.boolean().openapi({ description: 'Execution success' }),
    data: z.unknown().optional().openapi({ description: 'Result data' }),
    error: z.string().optional().openapi({ description: 'Error message' }),
    webhook: z
      .object({
        userId: z.string().openapi({ description: 'User ID' }),
        path: z.string().openapi({ description: 'Webhook path' }),
        triggeredAt: z.string().openapi({ description: 'Trigger timestamp' }),
        method: z.string().openapi({ description: 'HTTP method' }),
      })
      .openapi({ description: 'Webhook info' }),
  })
  .openapi('WebhookExecutionResponse');

// POST /webhook/{userId}/{path} - Webhook response
export const webhookResponseSchema = z
  .object({
    // Slack verification fields
    challenge: z
      .string()
      .optional()
      .openapi({ description: 'Slack URL verification challenge' }),
    // Execution fields
    executionId: z.number().optional().openapi({ description: 'Execution ID' }),
    success: z
      .boolean()
      .optional()
      .openapi({ description: 'Execution success' }),
    data: z
      .record(z.string(), z.unknown())
      .or(z.undefined())
      .optional()
      .openapi({ description: 'Result data' }),
    error: z.string().optional().openapi({ description: 'Error message' }),
    webhook: z
      .object({
        userId: z.string().openapi({ description: 'User ID' }),
        path: z.string().openapi({ description: 'Webhook path' }),
        triggeredAt: z.string().openapi({ description: 'Trigger timestamp' }),
        method: z.string().openapi({ description: 'HTTP method' }),
      })
      .optional()
      .openapi({ description: 'Webhook info' }),
  })
  .openapi('WebhookResponse');

// Individual BubbleFlow list item schema
export const bubbleFlowListItemSchema = z.object({
  id: z.number().openapi({ description: 'BubbleFlow ID' }),
  name: z.string().openapi({ description: 'BubbleFlow name' }),
  description: z.string().optional().openapi({ description: 'Description' }),
  eventType: z.string().openapi({ description: 'Event type' }),
  isActive: z
    .boolean()
    .openapi({ description: 'Whether the BubbleFlow is active' }),
  webhookExecutionCount: z
    .number()
    .openapi({ description: 'Webhook execution count' }),
  webhookFailureCount: z
    .number()
    .openapi({ description: 'Webhook failure count' }),
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

// Validation schemas
export const validateBubbleFlowCodeSchema = z.object({
  code: z.string().min(1).openapi({
    description: 'TypeScript BubbleFlow code to validate',
    example:
      'export class TestFlow extends BubbleFlow<"webhook/http"> { async handle() { return {}; } }',
  }),
  options: z
    .object({
      includeDetails: z.boolean().default(true).openapi({
        description: 'Include detailed bubble analysis',
      }),
      strictMode: z.boolean().default(true).openapi({
        description: 'Enable strict TypeScript validation',
      }),
    })
    .optional()
    .openapi({
      description: 'Validation options',
    }),
  flowId: z.number().positive().optional().openapi({
    description:
      'Optional BubbleFlow ID to update with validation results if user owns the flow',
    example: 123,
  }),
  credentials: z
    .record(z.string(), z.record(z.string(), z.number()))
    .optional()
    .openapi({
      description:
        'Optional credentials mapping: bubble name -> credential type -> credential ID',
      example: {
        'slack-sender': {
          SLACK_CRED: 123,
        },
        'ai-agent': {
          OPENAI_CRED: 456,
        },
      },
    }),
});

export const validateBubbleFlowCodeResponseSchema = z.object({
  valid: z.boolean().openapi({
    description: 'Whether the code is valid',
  }),
  errors: z.array(z.string()).optional().openapi({
    description: 'List of validation errors if any',
  }),
  bubbleCount: z.number().optional().openapi({
    description: 'Number of bubbles found in the code',
  }),
  inputSchema: z.record(z.string(), z.unknown()).openapi({
    description: 'Input schema',
    example: {
      name: 'string',
      age: 'number',
    },
  }),
  bubbles: z.record(z.string(), ParsedBubbleWithInfoSchema).optional().openapi({
    description: 'Record mapping bubble IDs to their detailed information',
  }),
  metadata: z
    .object({
      validatedAt: z.string().openapi({
        description: 'Timestamp when validation was performed',
      }),
      codeLength: z.number().openapi({
        description: 'Length of the code in characters',
      }),
      strictMode: z.boolean().openapi({
        description: 'Whether strict mode was used',
      }),
      flowUpdated: z.boolean().optional().openapi({
        description:
          'Whether the BubbleFlow was updated with validation results',
      }),
    })
    .openapi({
      description: 'Validation metadata',
    }),
  success: z.boolean(),
  error: z.string(),
});

// BubbleFlow generation schemas
export const generateBubbleFlowCodeSchema = z.object({
  prompt: z.string().min(1).openapi({
    description: 'Natural language description of the desired BubbleFlow',
    example:
      'Create a flow that queries my database and sends results to Slack',
  }),
});

export const generateBubbleFlowCodeResponseSchema = z.object({
  generatedCode: z.string().openapi({
    description: 'The generated BubbleFlow TypeScript code',
  }),
  isValid: z.boolean().openapi({
    description: 'Whether the generated code is valid',
  }),
  success: z.boolean(),
  error: z.string(),
  bubbleParameters: z.record(z.string(), ParsedBubbleWithInfoSchema).openapi({
    description: 'Parsed bubble parameters from the generated code',
  }),
  requiredCredentials: z.record(z.string(), z.array(z.string())).openapi({
    description: 'Required credentials for the bubbles in the generated code',
  }),
});

export type GenerateBubbleFlowCodeResponse = z.infer<
  typeof generateBubbleFlowCodeResponseSchema
>;
export type ValidateBubbleFlowResponse = z.infer<
  typeof validateBubbleFlowCodeResponseSchema
>;

export interface WebhookExecutionResponse {
  executionId: number;
  success: boolean;
  data?: unknown;
  error?: string;
  webhook: {
    userId: string;
    path: string;
    triggeredAt: string;
    method: string;
  };
}

// General error response (used by all routes)
export const errorResponseSchema = z
  .object({
    error: z.string().openapi({
      description: 'Error message',
      example: 'Validation failed',
    }),
    details: z.string().optional().openapi({
      description: 'Additional error details',
      example: 'Invalid field: name is required',
    }),
  })
  .openapi('ErrorResponse');

export type ErrorResponse = z.infer<typeof errorResponseSchema>;

export interface HealthCheckResponse {
  message: string;
  timestamp: string;
}

// ============================================================================
// TYPESCRIPT TYPES (Derived from Schemas)
// ============================================================================

// BubbleFlow execution history item schema
export const bubbleFlowExecutionSchema = z.object({
  id: z.number().openapi({ description: 'Execution ID' }),
  status: z
    .enum(['running', 'success', 'error'])
    .openapi({ description: 'Execution status' }),
  payload: z
    .record(z.string(), z.any())
    .openapi({ description: 'Execution payload' }),
  result: z.any().optional().openapi({ description: 'Execution result data' }),
  error: z
    .string()
    .optional()
    .openapi({ description: 'Error message if failed' }),
  startedAt: z.string().openapi({ description: 'Execution start timestamp' }),
  webhook_url: z.string().openapi({ description: 'Webhook URL' }),
  completedAt: z
    .string()
    .optional()
    .openapi({ description: 'Execution completion timestamp' }),
});

// GET /bubble-flow/:id/executions - List BubbleFlow executions response
export const listBubbleFlowExecutionsResponseSchema = z
  .array(bubbleFlowExecutionSchema)
  .openapi('ListBubbleFlowExecutionsResponse');

export type ListBubbleFlowExecutionsResponse = z.infer<
  typeof listBubbleFlowExecutionsResponseSchema
>;

// ============================================================================
// WEBHOOK SCHEMAS
// ============================================================================

// Slack URL verification schema
export const slackUrlVerificationSchema = z.object({
  token: z.string(),
  challenge: z.string(),
  type: z.literal('url_verification'),
});

export const slackUrlVerificationResponseSchema = z
  .object({
    challenge: z
      .string()
      .openapi({ description: 'Slack URL verification challenge' }),
  })
  .openapi('SlackUrlVerificationResponse');

export type SlackUrlVerificationResponse = z.infer<
  typeof slackUrlVerificationResponseSchema
>;

// POST /bubbleflow-template/data-analyst - Generate template from description
export const generateBubbleFlowTemplateSchema = z
  .object({
    name: z.string().min(1).max(100).openapi({
      description: 'Name for the workflow',
      example: 'Sam Dix Data Scientist Bot',
    }),
    description: z.string().min(10).max(500).openapi({
      description: 'Description of what the workflow should do',
      example:
        'A Slack bot that helps analyze user engagement data and provides insights',
    }),
    roles: z.string().min(10).max(1000).openapi({
      description:
        "Detailed description of the bot's roles and responsibilities",
      example:
        'Be prepared to answer any question on user engagement and come up with proactive insights...',
    }),
    useCase: z.literal('slack-data-scientist').openapi({
      description: 'The specific use case template to generate',
      example: 'slack-data-scientist',
    }),
    // Optional configuration parameters
    verbosity: z.enum(['1', '2', '3', '4', '5']).optional().openapi({
      description: 'Response verbosity level (1=concise, 5=comprehensive)',
      example: '3',
    }),
    technicality: z.enum(['1', '2', '3', '4', '5']).optional().openapi({
      description: 'Technical complexity level (1=plain English, 5=expert)',
      example: '2',
    }),
    includeQuery: z.boolean().optional().openapi({
      description: 'Include the SQL query in the response',
      example: true,
    }),
    includeExplanation: z.boolean().optional().openapi({
      description: 'Include query explanation in the response',
      example: true,
    }),
    maxQueries: z.number().optional().openapi({
      description: 'Maximum number of queries to run',
      example: 10,
    }),
  })
  .openapi('GenerateBubbleFlowTemplateRequest');

// POST /bubbleflow-template/document-generation - Generate document processing template
export const generateDocumentGenerationTemplateSchema = z
  .object({
    name: z.string().min(1).max(100).openapi({
      description: 'Name for the document processing workflow',
      example: 'Expense Report Generator',
    }),
    description: z
      .string()
      .max(500)
      .default('Document processing workflow')
      .openapi({
        description:
          'Description of what the document processing workflow should do (optional)',
        example:
          'Process receipts and invoices to generate structured expense reports',
      }),
    outputDescription: z.string().min(1).max(1000).openapi({
      description:
        'Detailed description of the desired output format and data extraction',
      example:
        'Extract expense tracking data with vendor name, transaction date, amount, category, and description',
    }),
    // Optional configuration parameters
    outputFormat: z.enum(['html', 'csv', 'json']).optional().openapi({
      description: 'Default output format for generated documents',
      example: 'html',
    }),
    conversionOptions: z
      .object({
        preserveStructure: z.boolean().optional().openapi({
          description: 'Preserve document structure during parsing',
          example: true,
        }),
        includeVisualDescriptions: z.boolean().optional().openapi({
          description: 'Include descriptions of visual elements',
          example: true,
        }),
        extractNumericalData: z.boolean().optional().openapi({
          description: 'Extract and process numerical data',
          example: true,
        }),
        combinePages: z.boolean().optional().openapi({
          description: 'Combine multiple pages into single output',
          example: true,
        }),
      })
      .optional(),
    imageOptions: z
      .object({
        format: z.enum(['png', 'jpg', 'jpeg']).optional().openapi({
          description: 'Image format for document conversion',
          example: 'png',
        }),
        quality: z.number().min(0.1).max(1.0).optional().openapi({
          description: 'Image quality (0.1 to 1.0)',
          example: 0.9,
        }),
        dpi: z.number().min(72).max(300).optional().openapi({
          description: 'Image DPI for conversion',
          example: 200,
        }),
      })
      .optional(),
    aiOptions: z
      .object({
        model: z.string().optional().openapi({
          description: 'AI model to use for processing',
          example: 'google/gemini-2.5-flash',
        }),
        temperature: z.number().min(0).max(2).optional().openapi({
          description: 'AI model temperature (0 to 2)',
          example: 0.2,
        }),
        maxTokens: z.number().min(1000).max(200000).optional().openapi({
          description: 'Maximum tokens for AI processing',
          example: 90000,
        }),
        jsonMode: z.boolean().optional().openapi({
          description: 'Enable JSON mode for structured output',
          example: false,
        }),
      })
      .optional(),
    metadata: z
      .record(z.string(), z.unknown())
      .optional()
      .openapi({
        description:
          'Additional metadata for the workflow (e.g., outputDescription)',
        example: { outputDescription: 'Extract expense data from receipts' },
      }),
  })
  .openapi('GenerateDocumentGenerationTemplateRequest');

// Response for template generation (extends the regular create response)
export const bubbleFlowTemplateResponseSchema = z
  .object({
    id: z.number().openapi({
      description: 'ID of the created BubbleFlow template',
      example: 123,
    }),
    name: z.string().openapi({
      description: 'Name of the BubbleFlow',
      example: 'Sam Dix Data Scientist Bot',
    }),
    description: z.string().openapi({
      description: 'Description of the BubbleFlow',
      example: 'A Slack bot that helps analyze user engagement data',
    }),
    eventType: z.string().openapi({
      description: 'Event type this BubbleFlow responds to',
      example: 'slack/bot_mentioned',
    }),
    displayedBubbleParameters: z.record(
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
    ),
    bubbleParameters: z
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
      .openapi({
        description: 'Parsed bubble parameters from the BubbleFlow code',
      }),
    requiredCredentials: z
      .record(z.string(), z.array(z.nativeEnum(CredentialType)))
      .optional()
      .openapi({
        description:
          'Mapping of bubble names to their required credential types',
        example: {
          'database-connection': [CredentialType.DATABASE_CRED],
          'slack-notification': [CredentialType.SLACK_CRED],
          'ai-analysis': [CredentialType.GOOGLE_GEMINI_CRED],
        },
      }),
    createdAt: z.string().openapi({
      description: 'ISO timestamp when the template was created',
      example: '2025-01-15T10:30:00.000Z',
    }),
    updatedAt: z.string().openapi({
      description: 'ISO timestamp when the template was last updated',
      example: '2025-01-15T10:30:00.000Z',
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
  .openapi('BubbleFlowTemplateResponse');

// Export TypeScript types

// POST /bubble-flow/:id/test - Test workflow
export const testBubbleFlowSchema = z
  .object({
    message: z.string().min(1).openapi({
      description: 'Test message to send to the workflow',
      example: 'What is our user engagement rate this month?',
    }),
  })
  .openapi('TestBubbleFlowRequest');

export const testBubbleFlowResponseSchema = z
  .object({
    success: z.boolean().openapi({
      description: 'Whether the test execution was successful',
      example: true,
    }),
    response: z.string().openapi({
      description: 'Response from the workflow',
      example: 'Based on your query, I found 1,247 active users...',
    }),
    executionTime: z.number().openapi({
      description: 'Execution time in milliseconds',
      example: 1500,
    }),
    error: z.string().optional().openapi({
      description: 'Error message if test failed',
      example: 'Database connection failed',
    }),
  })
  .openapi('TestBubbleFlowResponse');

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

// Request types (derived from request schemas)
export type TestBubbleFlowRequest = z.infer<typeof testBubbleFlowSchema>;
export type TestBubbleFlowResponse = z.infer<
  typeof testBubbleFlowResponseSchema
>;
export type ActivateBubbleFlowResponse = z.infer<
  typeof activateBubbleFlowResponseSchema
>;
export type CreateBubbleFlowRequest = z.infer<typeof createBubbleFlowSchema>;
export type ExecuteBubbleFlowRequest = z.infer<typeof executeBubbleFlowSchema>;
export type CreateCredentialRequest = z.infer<typeof createCredentialSchema>;
export type UpdateCredentialRequest = z.infer<typeof updateCredentialSchema>;
export type UpdateBubbleFlowParametersRequest = z.infer<
  typeof updateBubbleFlowParametersSchema
>;
export type GenerateBubbleFlowTemplateRequest = z.infer<
  typeof generateBubbleFlowTemplateSchema
>;
export type GenerateDocumentGenerationTemplateRequest = z.infer<
  typeof generateDocumentGenerationTemplateSchema
>;
export type BubbleFlowTemplateResponse = z.infer<
  typeof bubbleFlowTemplateResponseSchema
>;
export type BubbleFlowDetailsResponse = z.infer<
  typeof bubbleFlowDetailsResponseSchema
>;
// Response types (derived from response schemas)
export type BubbleFlowListResponse = z.infer<
  typeof bubbleFlowListResponseSchema
>;
export type BubbleFlowListItem = z.infer<typeof bubbleFlowListItemSchema>;
export type BubbleFlowExecution = z.infer<typeof bubbleFlowExecutionSchema>;
export type CredentialResponse = z.infer<typeof credentialResponseSchema>;
export type CreateCredentialResponse = z.infer<
  typeof createCredentialResponseSchema
>;
export type UpdateCredentialResponse = z.infer<
  typeof updateCredentialResponseSchema
>;

// ============================================================================
// SUBSCRIPTION SCHEMAS
// ============================================================================

// GET /subscription/status - Get user's subscription status
export const subscriptionStatusResponseSchema = z
  .object({
    userId: z.string().openapi({
      description: 'User ID from Clerk',
      example: 'user_30Gbwrzto1VZvAHcGUm5NLQhpkp',
    }),
    plan: z.string().openapi({
      description: 'Current subscription plan',
      example: 'pro_plus',
    }),
    planDisplayName: z.string().openapi({
      description: 'Human-readable plan name',
      example: 'Pro Plus',
    }),
    features: z.array(z.string()).openapi({
      description: 'List of features available to the user',
      example: ['unlimited_usage', 'priority_support'],
    }),
    usage: z.object({
      current: z.number().openapi({
        description: 'Current monthly usage count',
        example: 42,
      }),
      limit: z.number().openapi({
        description: 'Monthly usage limit',
        example: 100,
      }),
      percentage: z.number().openapi({
        description: 'Usage percentage',
        example: 42,
      }),
      resetDate: z.string().openapi({
        description: 'ISO date when usage resets',
        example: '2025-02-01T00:00:00.000Z',
      }),
    }),
    isActive: z.boolean().openapi({
      description: 'Whether the subscription is active',
      example: true,
    }),
  })
  .openapi('SubscriptionStatusResponse');

export type SubscriptionStatusResponse = z.infer<
  typeof subscriptionStatusResponseSchema
>;

// ============================================================================
// JOIN WAITLIST SCHEMAS
// ============================================================================

// POST /join-waitlist - Join waitlist request schema
export const joinWaitlistSchema = z
  .object({
    name: z.string().min(1, 'Name is required').openapi({
      description: 'Full name of the user',
      example: 'John Doe',
    }),
    email: z.string().email('Valid email is required').openapi({
      description: 'Email address of the user',
      example: 'john.doe@example.com',
    }),
    database: z.string().min(1, 'Database selection is required').openapi({
      description: 'Database type the user wants to use',
      example: 'postgres',
    }),
    otherDatabase: z.string().optional().openapi({
      description: 'Other database type if "other" was selected',
      example: 'Redis',
    }),
  })
  .openapi('JoinWaitlistRequest');

// POST /join-waitlist - Join waitlist response schema
export const joinWaitlistResponseSchema = z
  .object({
    success: z.boolean().openapi({
      description: 'Whether the request was successful',
      example: true,
    }),
    message: z.string().openapi({
      description: 'Success message',
      example:
        'Successfully joined the waitlist! Check your email for next steps.',
    }),
  })
  .openapi('JoinWaitlistResponse');

// Export TypeScript types
export type JoinWaitlistRequest = z.infer<typeof joinWaitlistSchema>;
export type JoinWaitlistResponse = z.infer<typeof joinWaitlistResponseSchema>;

// ========================= OAuth Schemas =========================

// OAuth initiation request schema
export const oauthInitiateRequestSchema = z
  .object({
    credentialType: z.nativeEnum(CredentialType).openapi({
      description: 'The type of credential to create',
      example: CredentialType.GOOGLE_DRIVE_CRED,
    }),
    name: z.string().optional().openapi({
      description: 'Optional name for the credential',
      example: 'My Google Drive',
    }),
    scopes: z
      .array(z.string())
      .optional()
      .openapi({
        description:
          'Optional OAuth scopes to request (defaults based on credential type)',
        example: ['https://www.googleapis.com/auth/drive.readonly'],
      }),
  })
  .openapi('OAuthInitiateRequest');

// OAuth initiation response schema
export const oauthInitiateResponseSchema = z
  .object({
    authUrl: z.string().url().openapi({
      description: 'OAuth authorization URL to redirect user to',
      example: 'https://accounts.google.com/oauth2/auth?client_id=...',
    }),
    state: z.string().openapi({
      description: 'CSRF protection state parameter',
      example: 'abc123-def456-ghi789',
    }),
  })
  .openapi('OAuthInitiateResponse');

// OAuth callback request schema (for POST callback with credential details)
export const oauthCallbackRequestSchema = z
  .object({
    code: z.string().openapi({
      description: 'OAuth authorization code from provider',
      example: 'abc123def456',
    }),
    state: z.string().openapi({
      description: 'CSRF protection state parameter',
      example: 'abc123-def456-ghi789',
    }),
    name: z.string().openapi({
      description: 'Name for the credential',
      example: 'My Google Drive',
    }),
    description: z.string().optional().openapi({
      description: 'Optional description for the credential',
    }),
  })
  .openapi('OAuthCallbackRequest');

// OAuth token refresh response schema
export const oauthTokenRefreshResponseSchema = z
  .object({
    message: z.string().openapi({
      description: 'Success message',
      example: 'Token refreshed successfully',
    }),
  })
  .openapi('OAuthTokenRefreshResponse');

// OAuth revoke response schema
export const oauthRevokeResponseSchema = z
  .object({
    message: z.string().openapi({
      description: 'Success message',
      example: 'Credential revoked successfully',
    }),
  })
  .openapi('OAuthRevokeResponse');

// Export OAuth TypeScript types
export type OAuthInitiateRequest = z.infer<typeof oauthInitiateRequestSchema>;
export type OAuthInitiateResponse = z.infer<typeof oauthInitiateResponseSchema>;
export type OAuthCallbackRequest = z.infer<typeof oauthCallbackRequestSchema>;
export type OAuthTokenRefreshResponse = z.infer<
  typeof oauthTokenRefreshResponseSchema
>;
export type OAuthRevokeResponse = z.infer<typeof oauthRevokeResponseSchema>;
