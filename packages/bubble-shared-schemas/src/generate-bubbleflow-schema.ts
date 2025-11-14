import { ParsedBubbleWithInfoSchema } from './bubble-definition-schema';
import { z } from '@hono/zod-openapi';
import { BubbleParameterType } from './bubble-definition-schema';
import { CredentialType } from './types';
import { ServiceUsageSchema } from './bubbleflow-execution-schema';

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

/**
 * Schema for the result of BubbleFlow generation
 * Used by the BubbleFlowGeneratorWorkflow
 */
export const GenerationResultSchema = z.object({
  generatedCode: z
    .string()
    .describe('The generated BubbleFlow TypeScript code'),
  isValid: z.boolean().describe('Whether the generated code is valid'),
  success: z.boolean(),
  error: z.string(),
  flowId: z.number().optional().openapi({
    description: 'ID of the generated BubbleFlow',
    example: 123,
  }),
  toolCalls: z
    .array(z.unknown())
    .describe('The tool calls made by the AI agent'),
  summary: z
    .string()
    .default('')
    .describe('High-level instructions for using the validated flow'),
  inputsSchema: z
    .string()
    .default('')
    .describe('JSON Schema (string) representing the inputs of the flow'),
  serviceUsage: ServiceUsageSchema.optional().openapi({
    description: 'Token usage statistics for the generation',
  }),
  bubbleCount: z.number().optional().openapi({
    description: 'Number of bubbles used in the generated flow',
  }),
  codeLength: z.number().optional().openapi({
    description: 'Length of the generated code in characters',
  }),
});
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
export type GenerateBubbleFlowCodeResponse = z.infer<
  typeof generateBubbleFlowCodeResponseSchema
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
export type GenerationResult = z.infer<typeof GenerationResultSchema>;
