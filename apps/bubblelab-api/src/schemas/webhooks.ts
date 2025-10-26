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

// POST /webhook/test - Test webhook endpoint with authentication
export const webhookTestRoute = createRoute({
  method: 'post',
  path: '/test',
  security: [
    {
      Bearer: [],
    },
  ],
  request: {
    body: {
      content: {
        'application/json': {
          schema: z
            .object({
              message: z.string().optional().openapi({
                description: 'Optional test message',
                example: 'Hello from test webhook',
              }),
            })
            .optional(),
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean().openapi({
              description: 'Test execution success status',
              example: true,
            }),
            message: z.string().openapi({
              description: 'Ping message',
              example: 'pong',
            }),
            acknowledged: z.boolean().openapi({
              description: 'Acknowledgment status',
              example: true,
            }),
            timestamp: z.string().openapi({
              description: 'Response timestamp',
              example: '2024-01-01T00:00:00.000Z',
            }),
            userId: z.string().openapi({
              description: 'Authenticated user ID',
              example: 'user_123',
            }),
            receivedMessage: z.string().optional().openapi({
              description: 'Echo of received message',
              example: 'Hello from test webhook',
            }),
          }),
        },
      },
      description: 'Test webhook executed successfully',
    },
    401: {
      content: {
        'application/json': {
          schema: errorResponseSchema,
        },
      },
      description: 'Unauthorized - Invalid or missing authentication token',
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
  summary: 'Test webhook endpoint',
  description:
    'Test webhook endpoint that requires authentication and responds with ping message and acknowledgment.',
});
