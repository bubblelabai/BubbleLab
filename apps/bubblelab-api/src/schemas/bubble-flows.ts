import { createRoute, z } from '@hono/zod-openapi';
import {
  errorResponseSchema,
  createBubbleFlowSchema,
  createBubbleFlowResponseSchema,
  executeBubbleFlowSchema,
  executeBubbleFlowResponseSchema,
  bubbleFlowDetailsResponseSchema,
  updateBubbleFlowParametersSchema,
  updateBubbleFlowNameSchema,
  bubbleFlowListResponseSchema,
  activateBubbleFlowResponseSchema,
  listBubbleFlowExecutionsResponseSchema,
  successMessageResponseSchema,
  validateBubbleFlowCodeSchema,
  generateBubbleFlowCodeSchema,
  validateBubbleFlowCodeResponseSchema,
} from './index.js';

// POST /bubble-flow - Validate and store BubbleFlow
export const createBubbleFlowRoute = createRoute({
  method: 'post',
  path: '/',
  request: {
    body: {
      content: {
        'application/json': {
          schema: createBubbleFlowSchema,
        },
      },
    },
  },
  responses: {
    201: {
      content: {
        'application/json': {
          schema: createBubbleFlowResponseSchema,
        },
      },
      description: 'BubbleFlow created successfully',
    },
    400: {
      content: {
        'application/json': {
          schema: errorResponseSchema,
        },
      },
      description: 'Validation failed or invalid input',
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
  tags: ['BubbleFlow'],
});

// POST /:id/execute - Execute stored BubbleFlow
export const executeBubbleFlowRoute = createRoute({
  method: 'post',
  path: '/{id}/execute',
  request: {
    params: z.object({
      id: z
        .string()
        .regex(/^[0-9]+$/)
        .openapi({
          description: 'BubbleFlow ID',
          example: '123',
        }),
    }),
    body: {
      content: {
        'application/json': {
          schema: executeBubbleFlowSchema,
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: executeBubbleFlowResponseSchema,
        },
      },
      description: 'BubbleFlow executed successfully',
    },
    400: {
      content: {
        'application/json': {
          schema: errorResponseSchema,
        },
      },
      description: 'Invalid ID format',
    },
    404: {
      content: {
        'application/json': {
          schema: errorResponseSchema,
        },
      },
      description: 'BubbleFlow not found',
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
  tags: ['BubbleFlow'],
});

// POST /:id/execute-stream - Execute stored BubbleFlow with live streaming
export const executeBubbleFlowStreamRoute = createRoute({
  method: 'post',
  path: '/{id}/execute-stream',
  request: {
    params: z.object({
      id: z
        .string()
        .regex(/^[0-9]+$/)
        .openapi({
          description: 'BubbleFlow ID',
          example: '123',
        }),
    }),
    body: {
      content: {
        'application/json': {
          schema: executeBubbleFlowSchema,
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
      description: 'BubbleFlow execution stream started successfully',
    },
    400: {
      content: {
        'application/json': {
          schema: errorResponseSchema,
        },
      },
      description: 'Invalid ID format',
    },
    404: {
      content: {
        'application/json': {
          schema: errorResponseSchema,
        },
      },
      description: 'BubbleFlow not found',
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
  tags: ['BubbleFlow'],
});

// GET /bubble-flow/:id - Get bubble flow details with parameters
export const getBubbleFlowRoute = createRoute({
  method: 'get',
  path: '/{id}',
  request: {
    params: z.object({
      id: z
        .string()
        .regex(/^[0-9]+$/)
        .openapi({
          description: 'BubbleFlow ID',
          example: '123',
        }),
    }),
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: bubbleFlowDetailsResponseSchema,
        },
      },
      description: 'BubbleFlow details retrieved successfully',
    },
    400: {
      content: {
        'application/json': {
          schema: errorResponseSchema,
        },
      },
      description: 'Invalid ID format',
    },
    404: {
      content: {
        'application/json': {
          schema: errorResponseSchema,
        },
      },
      description: 'BubbleFlow not found',
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
  tags: ['BubbleFlow'],
});

// PUT /bubble-flow/:id - Update bubble flow parameters
export const updateBubbleFlowRoute = createRoute({
  method: 'put',
  path: '/{id}',
  request: {
    params: z.object({
      id: z
        .string()
        .regex(/^[0-9]+$/)
        .openapi({
          description: 'BubbleFlow ID',
          example: '123',
        }),
    }),
    body: {
      content: {
        'application/json': {
          schema: updateBubbleFlowParametersSchema,
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: updateBubbleFlowParametersSchema,
        },
      },
      description: 'BubbleFlow parameters updated successfully',
    },
    400: {
      content: {
        'application/json': {
          schema: errorResponseSchema,
        },
      },
      description: 'Invalid ID format or validation failed',
    },
    404: {
      content: {
        'application/json': {
          schema: errorResponseSchema,
        },
      },
      description: 'BubbleFlow not found',
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
  tags: ['BubbleFlow'],
});

// PATCH /bubble-flow/:id/name - Update bubble flow name
export const updateBubbleFlowNameRoute = createRoute({
  method: 'patch',
  path: '/{id}/name',
  request: {
    params: z.object({
      id: z
        .string()
        .regex(/^[0-9]+$/)
        .openapi({
          description: 'BubbleFlow ID',
          example: '123',
        }),
    }),
    body: {
      content: {
        'application/json': {
          schema: updateBubbleFlowNameSchema,
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: successMessageResponseSchema,
        },
      },
      description: 'BubbleFlow name updated successfully',
    },
    400: {
      content: {
        'application/json': {
          schema: errorResponseSchema,
        },
      },
      description: 'Invalid ID format or name validation failed',
    },
    404: {
      content: {
        'application/json': {
          schema: errorResponseSchema,
        },
      },
      description: 'BubbleFlow not found',
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
  tags: ['BubbleFlow'],
});

// GET /bubble-flow - List all bubble flows for the user
export const listBubbleFlowsRoute = createRoute({
  method: 'get',
  path: '/',
  responses: {
    200: {
      content: {
        'application/json': {
          schema: bubbleFlowListResponseSchema,
        },
      },
      description: 'List of user bubble flows',
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
  tags: ['BubbleFlow'],
});

// POST /bubble-flow/:id/activate - Activate bubble flow webhook
export const activateBubbleFlowRoute = createRoute({
  method: 'post',
  path: '/{id}/activate',
  request: {
    params: z.object({
      id: z
        .string()
        .regex(/^[0-9]+$/)
        .openapi({
          description: 'BubbleFlow ID',
          example: '123',
        }),
    }),
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: activateBubbleFlowResponseSchema,
        },
      },
      description: 'BubbleFlow activated successfully',
    },
    400: {
      content: {
        'application/json': {
          schema: errorResponseSchema,
        },
      },
      description: 'Invalid ID format',
    },
    403: {
      content: {
        'application/json': {
          schema: errorResponseSchema,
        },
      },
      description: 'Webhook limit exceeded',
    },
    404: {
      content: {
        'application/json': {
          schema: errorResponseSchema,
        },
      },
      description: 'BubbleFlow not found',
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
  tags: ['BubbleFlow'],
});

// POST /bubble-flow/:id/deactivate - Deactivate bubble flow webhook
export const deactivateBubbleFlowRoute = createRoute({
  method: 'post',
  path: '/{id}/deactivate',
  request: {
    params: z.object({
      id: z
        .string()
        .regex(/^[0-9]+$/)
        .openapi({
          description: 'BubbleFlow ID',
          example: '123',
        }),
    }),
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean().openapi({
              description: 'Whether the deactivation was successful',
              example: true,
            }),
            message: z.string().openapi({
              description: 'Success message',
              example: 'Webhook deactivated successfully',
            }),
          }),
        },
      },
      description: 'Webhook deactivated successfully',
    },
    400: {
      content: {
        'application/json': {
          schema: errorResponseSchema,
        },
      },
      description: 'Invalid ID format',
    },
    404: {
      content: {
        'application/json': {
          schema: errorResponseSchema,
        },
      },
      description: 'BubbleFlow not found',
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
  tags: ['BubbleFlow'],
});

// DELETE /bubble-flow/:id - Delete bubble flow
export const deleteBubbleFlowRoute = createRoute({
  method: 'delete',
  path: '/{id}',
  request: {
    params: z.object({
      id: z
        .string()
        .regex(/^[0-9]+$/)
        .openapi({
          description: 'BubbleFlow ID',
          example: '123',
        }),
    }),
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: successMessageResponseSchema,
        },
      },
      description: 'BubbleFlow deleted successfully',
    },
    400: {
      content: {
        'application/json': {
          schema: errorResponseSchema,
        },
      },
      description: 'Invalid ID format',
    },
    404: {
      content: {
        'application/json': {
          schema: errorResponseSchema,
        },
      },
      description: 'BubbleFlow not found',
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
  tags: ['BubbleFlow'],
});

// GET /bubble-flow/:id/executions - Get BubbleFlow execution history
export const listBubbleFlowExecutionsRoute = createRoute({
  method: 'get',
  path: '/{id}/executions',
  request: {
    params: z.object({
      id: z
        .string()
        .regex(/^[0-9]+$/)
        .openapi({
          description: 'BubbleFlow ID',
          example: '123',
        }),
    }),
    query: z.object({
      limit: z
        .string()
        .regex(/^[0-9]+$/)
        .optional()
        .openapi({
          description: 'Maximum number of executions to return',
          example: '50',
        }),
      offset: z
        .string()
        .regex(/^[0-9]+$/)
        .optional()
        .openapi({
          description: 'Number of executions to skip',
          example: '0',
        }),
    }),
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: listBubbleFlowExecutionsResponseSchema,
        },
      },
      description: 'BubbleFlow execution history retrieved successfully',
    },
    400: {
      content: {
        'application/json': {
          schema: errorResponseSchema,
        },
      },
      description: 'Invalid ID format',
    },
    404: {
      content: {
        'application/json': {
          schema: errorResponseSchema,
        },
      },
      description: 'BubbleFlow not found',
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
  tags: ['BubbleFlow'],
});

export const validateBubbleFlowCodeRoute = createRoute({
  method: 'post',
  path: '/validate',
  request: {
    body: {
      content: {
        'application/json': {
          schema: validateBubbleFlowCodeSchema,
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: validateBubbleFlowCodeResponseSchema,
        },
      },
      description: 'BubbleFlow code validation result',
    },
    400: {
      content: {
        'application/json': {
          schema: errorResponseSchema,
        },
      },
      description: 'Invalid request body',
    },
    403: {
      content: {
        'application/json': {
          schema: errorResponseSchema,
        },
      },
      description: 'Webhook limit exceeded',
    },
    404: {
      content: {
        'application/json': {
          schema: errorResponseSchema,
        },
      },
      description:
        'BubbleFlow not found or user does not have permission to update it',
    },
    500: {
      content: {
        'application/json': {
          schema: errorResponseSchema,
        },
      },
      description: 'Internal server error during validation',
    },
  },
  tags: ['BubbleFlow'],
  summary: 'Validate BubbleFlow Code',
  description:
    'Validates TypeScript BubbleFlow code for syntax, type errors, and bubble structure',
});

export const generateBubbleFlowCodeRoute = createRoute({
  method: 'post',
  path: '/generate',
  request: {
    body: {
      content: {
        'application/json': {
          schema: generateBubbleFlowCodeSchema,
        },
      },
    },
  },

  responses: {
    200: {
      content: {
        'text/event-stream': {
          schema: z.string().describe('Server-Sent Events stream'),
        },
      },
      description: 'Real-time streaming of BubbleFlow code generation process',
      headers: z.object({
        'Content-Type': z.literal('text/event-stream'),
        'Cache-Control': z.literal('no-cache'),
        Connection: z.literal('keep-alive'),
      }),
    },
    403: {
      content: {
        'application/json': {
          schema: errorResponseSchema,
        },
      },
      description: 'Code generation is disabled in production',
    },
    400: {
      content: {
        'application/json': {
          schema: errorResponseSchema,
        },
      },
      description: 'Invalid request body',
    },
    500: {
      content: {
        'application/json': {
          schema: errorResponseSchema,
        },
      },
      description: 'Internal server error during generation',
    },
  },
  tags: ['BubbleFlow'],
  summary: 'Generate BubbleFlow Code with Streaming',
  description:
    'Generates TypeScript BubbleFlow code from natural language prompts using AI with real-time streaming of tokens, tool calls, and progress',
});
