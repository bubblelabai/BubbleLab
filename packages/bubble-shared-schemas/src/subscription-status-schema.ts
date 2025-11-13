import { z } from '@hono/zod-openapi';
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
        description: 'Current monthly usage count (in USD)',
        example: 42,
      }),
      limit: z.number().openapi({
        description: 'Monthly usage limit (in USD)',
        example: 100,
      }),
      estimatedMonthlyCost: z.number().openapi({
        description: 'Projected monthly cost based on current usage trend',
        example: 14.19,
      }),
      percentage: z.number().openapi({
        description: 'Usage percentage (0-100)',
        example: 42,
      }),
      resetDate: z.string().openapi({
        description: 'ISO date when usage resets',
        example: '2025-02-01T00:00:00.000Z',
      }),
      tokenUsage: z
        .array(
          z.object({
            modelName: z.string().openapi({
              description: 'Model name',
              example: 'gpt-4',
            }),
            inputTokens: z.number().openapi({
              description: 'Input tokens used this month',
              example: 1500,
            }),
            outputTokens: z.number().openapi({
              description: 'Output tokens used this month',
              example: 750,
            }),
            totalTokens: z.number().openapi({
              description: 'Total tokens used this month',
              example: 2250,
            }),
          })
        )
        .openapi({
          description: 'Token usage breakdown by model for current month',
        }),
      serviceUsage: z
        .array(
          z.object({
            service: z.string().openapi({
              description: 'Service identifier',
              example: 'OPENAI_CRED',
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
              description:
                'Bubble Lab price per unit (with multiplier applied)',
              example: 2.1,
            }),
            totalCost: z.number().openapi({
              description: 'Total cost for this service (usage * unitCost)',
              example: 4.725,
            }),
          })
        )
        .openapi({
          description: 'Service usage and cost breakdown for current month',
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
