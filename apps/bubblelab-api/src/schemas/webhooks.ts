import { createRoute, z } from '@hono/zod-openapi';
import { errorResponseSchema, webhookResponseSchema } from './index.js';

export const webhookRoute = createRoute({
  method: 'post',
  path: '/{userId}/{path}',
  request: {
    params: z.object({
      userId: z.string().openapi({
        description: 'User ID',
        example: 'user123',
      }),
      path: z.string().openapi({
        description: 'Webhook path',
        example: 'my-webhook',
      }),
    }),
    body: {
      content: {
        'application/json': {
          schema: z.record(z.string(), z.unknown()).openapi('WebhookPayload'),
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: webhookResponseSchema,
        },
      },
      description: 'Webhook executed successfully or Slack verification',
    },
    403: {
      content: {
        'application/json': {
          schema: errorResponseSchema,
        },
      },
      description: 'Webhook is inactive',
    },
    404: {
      content: {
        'application/json': {
          schema: errorResponseSchema,
        },
      },
      description: 'Webhook not found',
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
  tags: ['Webhooks'],
});

// POST /webhook/{userId}/{path}/stream - Execute webhook with streaming
export const webhookStreamRoute = createRoute({
  method: 'post',
  path: '/{userId}/{path}/stream',
  request: {
    params: z.object({
      userId: z.string().openapi({
        description: 'User ID',
        example: 'user123',
      }),
      path: z.string().openapi({
        description: 'Webhook path',
        example: 'my-webhook',
      }),
    }),
    body: {
      content: {
        'application/json': {
          schema: z.record(z.string(), z.unknown()).openapi('WebhookPayload'),
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        'text/event-stream': {
          schema: z.string().openapi({
            description: 'Server-Sent Events stream with execution logs',
            example:
              'data: {"type":"log_line","timestamp":"2024-01-01T00:00:00Z","lineNumber":1,"message":"Statement: VariableDeclaration"}\n\n',
          }),
        },
      },
      description: 'Webhook execution stream started successfully',
    },
    404: {
      content: {
        'application/json': {
          schema: errorResponseSchema,
        },
      },
      description: 'Webhook not found',
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
  tags: ['Webhooks'],
  summary: 'Execute webhook with streaming',
  description:
    'Execute a webhook by userId and path with real-time streaming of execution logs. Does not require authentication.',
});
