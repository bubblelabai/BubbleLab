import { z } from '@hono/zod-openapi';
import {
  ParsedBubbleWithInfoSchema,
  ParsedWorkflowSchema,
} from './bubble-definition-schema';
import { CredentialType } from './types';

export const ServiceUsageSchema = z
  .object({
    service: z.nativeEnum(CredentialType).openapi({
      description: 'Service identifier',
      example: CredentialType.OPENAI_CRED,
    }),
    subService: z.string().optional().openapi({
      description: 'Sub-service identifier',
      example: 'gpt-4',
    }),
    unit: z.string().openapi({
      description: 'Unit type for this service',
      example: 'per_1m_tokens',
    }),
    usage: z.number().openapi({
      description: 'Units used this month',
      example: 2250000,
    }),
    unitCost: z.number().openapi({
      description: 'Bubble Lab price per unit (with multiplier applied)',
      example: 2.1,
    }),
    totalCost: z.number().openapi({
      description: 'Total cost for this service (usage * unitCost)',
      example: 4.725,
    }),
  })
  .openapi('ServiceUsage');

export type ServiceUsage = z.infer<typeof ServiceUsageSchema>;

export const ExecutionSummarySchema = z
  .object({
    result: z.any().optional().openapi({
      description: 'Execution result',
      example: 'Execution completed successfully',
    }),
    totalDuration: z.number().openapi({
      description: 'Total execution duration in milliseconds',
      example: 1500,
    }),
    lineExecutionCount: z.number().optional().openapi({
      description: 'Number of lines executed',
      example: 25,
    }),
    bubbleExecutionCount: z.number().optional().openapi({
      description: 'Number of bubbles executed',
      example: 5,
    }),
    errorCount: z.number().optional().openapi({
      description: 'Number of errors encountered',
      example: 0,
    }),
    totalCost: z
      .number()
      .openapi({ description: 'Total cost of the execution' }),
    warningCount: z.number().optional().openapi({
      description: 'Number of warnings encountered',
      example: 1,
    }),
    errors: z
      .array(
        z.object({
          message: z.string().openapi({
            description: 'Error message',
            example: 'Failed to execute bubble',
          }),
          timestamp: z.number().openapi({
            description: 'Error timestamp (Unix timestamp)',
            example: 1703123457000,
          }),
          bubbleName: z.string().optional().openapi({
            description: 'Name of the bubble that caused the error',
            example: 'AIAgentBubble',
          }),
          variableId: z.number().optional().openapi({
            description: 'Variable ID associated with the error',
            example: 1,
          }),
          lineNumber: z.number().optional().openapi({
            description: 'Line number where the error occurred',
            example: 15,
          }),
          additionalData: z.any().optional().openapi({
            description: 'Additional error details',
          }),
        })
      )
      .optional()
      .openapi({
        description: 'Array of errors encountered during execution',
      }),
    warnings: z
      .array(
        z.object({
          message: z.string().openapi({
            description: 'Warning message',
            example: 'Deprecated API usage detected',
          }),
          timestamp: z.number().openapi({
            description: 'Warning timestamp (Unix timestamp)',
            example: 1703123457000,
          }),
          bubbleName: z.string().optional().openapi({
            description: 'Name of the bubble that caused the warning',
            example: 'HttpBubble',
          }),
          variableId: z.number().optional().openapi({
            description: 'Variable ID associated with the warning',
            example: 2,
          }),
          lineNumber: z.number().optional().openapi({
            description: 'Line number where the warning occurred',
            example: 20,
          }),
          additionalData: z.any().optional().openapi({
            description: 'Additional warning details',
          }),
        })
      )
      .optional()
      .openapi({
        description: 'Array of warnings encountered during execution',
      }),
    averageLineExecutionTime: z.number().optional().openapi({
      description: 'Average execution time per line in milliseconds',
      example: 60,
    }),
    slowestLines: z
      .array(
        z.object({
          lineNumber: z.number().openapi({
            description: 'Line number',
            example: 15,
          }),
          duration: z.number().openapi({
            description: 'Execution duration in milliseconds',
            example: 250,
          }),
          message: z.string().openapi({
            description: 'Description of what was executed on this line',
            example: 'API call to external service',
          }),
        })
      )
      .optional()
      .openapi({
        description: 'Array of the slowest executing lines',
      }),
    memoryPeakUsage: z.any().optional().openapi({
      description:
        'Peak memory usage during execution (NodeJS.MemoryUsage type)',
    }), // NodeJS.MemoryUsage type
    startTime: z.number().optional().openapi({
      description: 'Execution start timestamp (Unix timestamp)',
      example: 1703123456789,
    }),
    endTime: z.number().optional().openapi({
      description: 'Execution end timestamp (Unix timestamp)',
      example: 1703123458289,
    }),
    serviceUsage: z.array(ServiceUsageSchema).optional().openapi({
      description: 'Token usage during execution',
    }),
    serviceUsageByService: z
      .record(z.string(), ServiceUsageSchema)
      .optional()
      .openapi({
        description: 'Service usage breakdown by service',
      }),
  })
  .openapi('ExecutionSummary');

export type ExecutionSummary = z.infer<typeof ExecutionSummarySchema>;

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
  code: z
    .string()
    .optional()
    .openapi({
      description:
        'The code that was executed (snapshot of the code at execution time)',
    }),
});

// GET /bubble-flow/:id/executions - List BubbleFlow executions response
export const listBubbleFlowExecutionsResponseSchema = z
  .array(bubbleFlowExecutionSchema)
  .openapi('ListBubbleFlowExecutionsResponse');

export type ListBubbleFlowExecutionsResponse = z.infer<
  typeof listBubbleFlowExecutionsResponseSchema
>;

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
    summary: ExecutionSummarySchema.optional().openapi({
      description: 'Execution summary',
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
      syncInputsWithFlow: z.boolean().default(false).openapi({
        description: 'Whether to sync input values with the flow',
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
  defaultInputs: z
    .record(z.unknown())
    .optional()
    .openapi({
      description: 'User-filled input values for cron execution',
      example: {
        message: 'Hello World',
        channel: '#general',
      },
    }),
  activateCron: z.boolean().optional().openapi({
    description: 'Whether to activate/deactivate cron scheduling',
    example: true,
  }),
});

export const validateBubbleFlowCodeResponseSchema = z.object({
  eventType: z.string().min(1).openapi({
    description: 'Event type this BubbleFlow responds to',
    example: 'webhook/http',
  }),
  webhookPath: z.string().min(1).openapi({
    description: 'Custom webhook path (auto-generated if not provided)',
    example: 'my-webhook',
  }),
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
  workflow: ParsedWorkflowSchema.optional().openapi({
    description: 'Hierarchical workflow structure with control flow',
  }),
  requiredCredentials: z
    .record(z.string(), z.array(z.string()))
    .optional()
    .openapi({
      description: 'Required credentials for the bubbles in the code',
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
  cron: z.string().nullable().optional().openapi({
    description: 'Cron expression extracted from code',
    example: '0 0 * * *',
  }),
  cronActive: z.boolean().optional().openapi({
    description: 'Whether cron scheduling is currently active',
    example: false,
  }),
  defaultInputs: z
    .record(z.unknown())
    .optional()
    .openapi({
      description: 'User-filled input values for cron execution',
      example: {
        message: 'Hello World',
        channel: '#general',
      },
    }),
  success: z.boolean(),
  error: z.string(),
});
export type ValidateBubbleFlowResponse = z.infer<
  typeof validateBubbleFlowCodeResponseSchema
>;
export type BubbleFlowExecution = z.infer<typeof bubbleFlowExecutionSchema>;
