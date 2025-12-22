import { createRoute } from '@hono/zod-openapi';
import {
  subscriptionStatusResponseSchema,
  redeemCouponRequestSchema,
  redeemCouponResponseSchema,
} from '@bubblelab/shared-schemas';

// GET /subscription/status - Get user's subscription status
export const getSubscriptionStatusRoute = createRoute({
  method: 'get',
  path: '/status',
  summary: 'Get user subscription status',
  description:
    'Returns the current subscription plan, features, and usage information for the authenticated user',
  tags: ['Subscription'],
  security: [{ BearerAuth: [] }],
  responses: {
    200: {
      description: 'Subscription status retrieved successfully',
      content: {
        'application/json': {
          schema: subscriptionStatusResponseSchema,
        },
      },
    },
    401: {
      description: 'Unauthorized',
    },
  },
});

// POST /subscription/redeem - Redeem a hackathon coupon code
export const redeemCouponRoute = createRoute({
  method: 'post',
  path: '/redeem',
  summary: 'Redeem a hackathon coupon code',
  description:
    'Validates and applies a hackathon coupon code to grant temporary pro access',
  tags: ['Subscription'],
  security: [{ BearerAuth: [] }],
  request: {
    body: {
      content: {
        'application/json': {
          schema: redeemCouponRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Coupon redemption result',
      content: {
        'application/json': {
          schema: redeemCouponResponseSchema,
        },
      },
    },
    400: {
      description: 'Invalid or expired coupon code',
    },
    401: {
      description: 'Unauthorized',
    },
  },
});
