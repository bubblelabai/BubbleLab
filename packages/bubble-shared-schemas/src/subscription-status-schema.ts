import { z } from '@hono/zod-openapi';
import { ServiceUsageSchema } from './bubbleflow-execution-schema';
import { orgRoleSchema, orgTypeSchema } from './organization-schema';

// ============================================================================
// Reusable Usage Schema
// ============================================================================

/**
 * Token usage breakdown by model
 */
export const tokenUsageSchema = z
  .object({
    modelName: z.string().optional().openapi({
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
  .openapi('TokenUsage');

export type TokenUsage = z.infer<typeof tokenUsageSchema>;

/**
 * Reusable usage schema for both personal and organization usage
 */
export const usageSchema = z
  .object({
    executionCount: z.number().openapi({
      description: 'Current monthly execution count',
      example: 100,
    }),
    tokenUsage: z.array(tokenUsageSchema).openapi({
      description: 'Token usage breakdown by model for current month',
    }),
    serviceUsage: z.array(ServiceUsageSchema).openapi({
      description: 'Service usage and cost breakdown for current month',
    }),
    estimatedMonthlyCost: z.number().optional().openapi({
      description: 'Projected monthly cost based on current usage trend',
      example: 14.19,
    }),
  })
  .openapi('Usage');

export type Usage = z.infer<typeof usageSchema>;

/**
 * Organization billing context - shows which org the billing belongs to
 */
export const billingOrganizationSchema = z
  .object({
    id: z.number().openapi({
      description: 'Organization ID',
      example: 123,
    }),
    name: z.string().openapi({
      description: 'Organization name',
      example: 'My Team',
    }),
    slug: z.string().openapi({
      description: 'Organization slug',
      example: 'my-team',
    }),
    type: orgTypeSchema.optional().openapi({
      description: 'Organization type (personal or organization)',
    }),
    role: orgRoleSchema.openapi({
      description: "Current user's role in this organization",
    }),
    memberCount: z.number().openapi({
      description: 'Number of members in the organization',
      example: 5,
    }),
  })
  .openapi('BillingOrganization');

export type BillingOrganization = z.infer<typeof billingOrganizationSchema>;

// ============================================================================
// Offer Schemas
// ============================================================================

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
    // Organization context - which org the billing belongs to
    organization: billingOrganizationSchema.optional().openapi({
      description:
        'Organization that owns the billing (null for personal accounts without org)',
    }),
    // Organization-level usage (what billing is based on)
    usage: z.object({
      executionCount: z.number().openapi({
        description: 'Organization monthly execution count',
        example: 100,
      }),
      executionLimit: z.number().openapi({
        description: 'Organization monthly execution limit',
        example: 42,
      }),
      creditLimit: z.number().openapi({
        description: 'Organization monthly credit limit',
        example: 100,
      }),
      activeFlowLimit: z.number().openapi({
        description: 'Organization monthly active flow limit',
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
      tokenUsage: z.array(tokenUsageSchema).openapi({
        description: 'Token usage breakdown by model for current month',
      }),
      serviceUsage: z.array(ServiceUsageSchema).openapi({
        description: 'Service usage and cost breakdown for current month',
      }),
    }),
    // User's personal contribution to the organization usage
    personalUsage: usageSchema.optional().openapi({
      description:
        "User's personal contribution to the organization's usage for current billing period",
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

// ============================================================================
// Organization Usage Breakdown (Admin/Owner Only)
// ============================================================================

/**
 * User usage item in org usage breakdown (admin/owner only endpoint)
 */
export const userUsageItemSchema = z
  .object({
    userId: z.string().openapi({
      description: 'User ID from Clerk',
      example: 'user_30Gbwrzto1VZvAHcGUm5NLQhpkp',
    }),
    firstName: z.string().optional().openapi({
      description: "User's first name",
      example: 'John',
    }),
    lastName: z.string().optional().openapi({
      description: "User's last name",
      example: 'Doe',
    }),
    userEmail: z.string().optional().openapi({
      description: 'User email address',
      example: 'john@acme.com',
    }),
    role: orgRoleSchema.openapi({
      description: "User's role in the organization",
    }),
    executionCount: z.number().openapi({
      description: 'Number of executions by this user',
      example: 42,
    }),
    totalCost: z.number().openapi({
      description: 'Total cost incurred by this user',
      example: 5.67,
    }),
  })
  .openapi('UserUsageItem');

export type UserUsageItem = z.infer<typeof userUsageItemSchema>;

/**
 * Organization usage breakdown response (admin/owner only)
 * Response from GET /subscription/org-usage
 */
export const orgUsageBreakdownResponseSchema = z
  .object({
    organizationId: z.number().openapi({
      description: 'Organization ID',
      example: 123,
    }),
    organizationName: z.string().optional().openapi({
      description: 'Organization name',
      example: 'Acme Inc',
    }),
    monthYear: z.string().openapi({
      description: 'Billing month in YYYY-MM format',
      example: '2025-01',
    }),
    totalOrgCost: z.number().openapi({
      description: 'Total organization cost for this billing period',
      example: 45.67,
    }),
    totalOrgExecutions: z.number().openapi({
      description: 'Total executions across all users',
      example: 500,
    }),
    users: z.array(userUsageItemSchema).openapi({
      description: 'Usage breakdown by user',
    }),
  })
  .openapi('OrgUsageBreakdownResponse');

export type OrgUsageBreakdownResponse = z.infer<
  typeof orgUsageBreakdownResponseSchema
>;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Helper to check if user is admin or owner in their org
 */
export function isAdminOrOwner(
  subscription: SubscriptionStatusResponse
): boolean {
  const role = subscription.organization?.role;
  return role === 'owner' || role === 'admin';
}

/**
 * Helper to check if user is a regular member
 */
export function isMember(subscription: SubscriptionStatusResponse): boolean {
  const role = subscription.organization?.role;
  return role === 'member';
}
