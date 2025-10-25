import { createRoute, z } from '@hono/zod-openapi';
import {
  errorResponseSchema,
  MilkTeaRequestSchema,
  MilkTeaResponseSchema,
  PearlRequestSchema,
  PearlResponseSchema,
} from './index.js';

// POST /ai/milktea - Run MilkTea AI agent
export const milkTeaRoute = createRoute({
  method: 'post',
  path: '/milktea',
  summary: 'Run MilkTea AI Agent',
  description:
    'Execute MilkTea AI agent to help configure bubble parameters through conversation',
  request: {
    body: {
      content: {
        'application/json': {
          schema: MilkTeaRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: 'MilkTea agent executed successfully',
      content: {
        'application/json': {
          schema: MilkTeaResponseSchema,
        },
      },
    },
    400: {
      description: 'Bad request or validation failed',
      content: {
        'application/json': {
          schema: errorResponseSchema,
        },
      },
    },
    500: {
      description: 'Internal server error',
      content: {
        'application/json': {
          schema: errorResponseSchema,
        },
      },
    },
  },
  tags: ['AI'],
});

// POST /ai/pearl - Run Pearl AI agent (with optional streaming)
export const pearlRoute = createRoute({
  method: 'post',
  path: '/pearl',
  summary: 'Run Pearl AI Agent',
  description:
    'Execute Pearl AI agent to help build complete workflows with multiple integrations. Use ?stream=true for real-time streaming.',
  request: {
    query: z.object({
      stream: z
        .string()
        .optional()
        .transform((val) => val === 'true')
        .openapi({
          description:
            'Enable streaming mode for real-time token and tool call updates',
          example: 'true',
        }),
    }),
    body: {
      content: {
        'application/json': {
          schema: PearlRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Pearl agent executed successfully',
      content: {
        'application/json': {
          schema: PearlResponseSchema,
        },
        'text/event-stream': {
          schema: z.string().openapi({
            description: 'Server-Sent Events stream (when stream=true)',
            example:
              'data: {"type":"token","data":{"content":"Hello","messageId":"msg-123"}}\n\n',
          }),
        },
      },
    },
    400: {
      description: 'Bad request or validation failed',
      content: {
        'application/json': {
          schema: errorResponseSchema,
        },
      },
    },
    500: {
      description: 'Internal server error',
      content: {
        'application/json': {
          schema: errorResponseSchema,
        },
      },
    },
  },
  tags: ['AI'],
});
