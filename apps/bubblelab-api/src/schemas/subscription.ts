import { createRoute } from '@hono/zod-openapi';
import { subscriptionStatusResponseSchema } from '@bubblelab/shared-schemas';

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
