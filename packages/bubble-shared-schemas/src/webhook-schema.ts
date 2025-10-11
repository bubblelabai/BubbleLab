import { z } from '@hono/zod-openapi';
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
export type WebhookResponse = z.infer<typeof webhookResponseSchema>;
export type WebhookExecutionResponse = z.infer<
  typeof webhookExecutionResponseSchema
>;
