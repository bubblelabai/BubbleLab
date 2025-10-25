import { createRoute, z } from '@hono/zod-openapi';
import {
  errorResponseSchema,
  joinWaitlistSchema,
  joinWaitlistResponseSchema,
} from './index.js';

// POST /join-waitlist - Join waitlist
export const joinWaitlistRoute = createRoute({
  method: 'post',
  path: '/',
  request: {
    body: {
      content: {
        'application/json': {
          schema: joinWaitlistSchema,
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: joinWaitlistResponseSchema,
        },
      },
      description: 'Successfully joined the waitlist',
    },
    400: {
      content: {
        'application/json': {
          schema: errorResponseSchema,
        },
      },
      description: 'Validation failed',
    },
    409: {
      content: {
        'application/json': {
          schema: errorResponseSchema,
        },
      },
      description: 'User already exists or in waitlist',
    },
    500: {
      content: {
        'application/json': {
          schema: errorResponseSchema,
        },
      },
      description: 'Internal server error',
    },
  },
  tags: ['Waitlist'],
});
