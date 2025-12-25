import { z } from '@hono/zod-openapi';
import { ServiceUsageSchema } from './bubbleflow-execution-schema';

// Hackathon offer schema for promotional code redemptions
export const hackathonOfferSchema = z
  .object({
    isActive: z.boolean().openapi({
      description: 'Whether a hackathon offer is currently active',
      example: true,
    }),
    expiresAt: z.string().openapi({
      description: 'ISO date when the hackathon offer expires',
      example: '2025-01-15T14:30:00.000Z',
    }),
    redeemedAt: z.string().openapi({
      description: 'ISO date when the code was redeemed',
      example: '2025-01-14T14:30:00.000Z',
    }),
  })
  .openapi('HackathonOffer');

export type HackathonOffer = z.infer<typeof hackathonOfferSchema>;

// Special offer schema for private metadata overrides (exclusive members)
export const specialOfferSchema = z
  .object({
    isActive: z.boolean().openapi({
      description: 'Whether a special offer is currently active',
      example: true,
    }),
    plan: z.string().openapi({
      description: 'The plan granted by the special offer',
      example: 'unlimited',
    }),
    expiresAt: z.string().nullable().openapi({
      description:
        'ISO date when the special offer expires (null = never expires)',
      example: '2025-06-15T14:30:00.000Z',
    }),
  })
  .openapi('SpecialOffer');

export type SpecialOffer = z.infer<typeof specialOfferSchema>;

// Coupon redemption request schema
export const redeemCouponRequestSchema = z
  .object({
    code: z.string().min(1).openapi({
      description: 'The coupon code to redeem',
      example: 'HACKATHON2025',
    }),
  })
  .openapi('RedeemCouponRequest');

export type RedeemCouponRequest = z.infer<typeof redeemCouponRequestSchema>;

// Coupon redemption response schema
export const redeemCouponResponseSchema = z
  .object({
    success: z.boolean().openapi({
      description: 'Whether the redemption was successful',
      example: true,
    }),
    message: z.string().openapi({
      description: 'Human-readable message about the redemption result',
      example: 'Coupon redeemed successfully! You now have Pro access.',
    }),
    expiresAt: z.string().optional().openapi({
      description: 'When the offer expires (if successful)',
      example: '2025-01-15T14:30:00.000Z',
    }),
  })
  .openapi('RedeemCouponResponse');

export type RedeemCouponResponse = z.infer<typeof redeemCouponResponseSchema>;

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
      executionCount: z.number().openapi({
        description: 'Current monthly execution count',
        example: 100,
      }),
      executionLimit: z.number().openapi({
        description: 'Current monthly execution limit',
        example: 42,
      }),
      creditLimit: z.number().openapi({
        description: 'Monthly credit limit',
        example: 100,
      }),
      activeFlowLimit: z.number().openapi({
        description: 'Current monthly active flow limit',
        example: 2,
      }),
      estimatedMonthlyCost: z.number().openapi({
        description: 'Projected monthly cost based on current usage trend',
        example: 14.19,
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
      serviceUsage: z.array(ServiceUsageSchema).openapi({
        description: 'Service usage and cost breakdown for current month',
      }),
    }),
    isActive: z.boolean().openapi({
      description: 'Whether the subscription is active',
      example: true,
    }),
    hackathonOffer: hackathonOfferSchema.optional().openapi({
      description: 'Active hackathon promotional offer information',
    }),
    specialOffer: specialOfferSchema.optional().openapi({
      description:
        'Special offer from private metadata (takes precedence over hackathon offer)',
    }),
  })
  .openapi('SubscriptionStatusResponse');

export type SubscriptionStatusResponse = z.infer<
  typeof subscriptionStatusResponseSchema
>;
