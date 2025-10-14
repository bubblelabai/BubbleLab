import { createRoute, z } from '@hono/zod-openapi';
import {
  errorResponseSchema,
  webhookResponseSchema,
  credentialResponseSchema,
  createCredentialSchema,
  createCredentialResponseSchema,
  updateCredentialSchema,
  updateCredentialResponseSchema,
  successMessageResponseSchema,
  createBubbleFlowSchema,
  createBubbleFlowResponseSchema,
  executeBubbleFlowSchema,
  executeBubbleFlowResponseSchema,
  bubbleFlowDetailsResponseSchema,
  updateBubbleFlowParametersSchema,
  bubbleFlowListResponseSchema,
  activateBubbleFlowResponseSchema,
  listBubbleFlowExecutionsResponseSchema,
  databaseMetadataSchema,
  joinWaitlistSchema,
  joinWaitlistResponseSchema,
  oauthInitiateRequestSchema,
  oauthInitiateResponseSchema,
  oauthCallbackRequestSchema,
  oauthTokenRefreshResponseSchema,
  oauthRevokeResponseSchema,
  validateBubbleFlowCodeSchema,
  generateBubbleFlowCodeSchema,
  validateBubbleFlowCodeResponseSchema,
  MilkTeaRequestSchema,
  MilkTeaResponseSchema,
} from './index.js';

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

// GET /credentials - List user's credentials
export const listCredentialsRoute = createRoute({
  method: 'get',
  path: '/',
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.array(credentialResponseSchema),
        },
      },
      description: 'List of user credentials',
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
  tags: ['Credentials'],
});

// POST /credentials - Create new credential
export const createCredentialRoute = createRoute({
  method: 'post',
  path: '/',
  request: {
    body: {
      content: {
        'application/json': {
          schema: createCredentialSchema,
        },
      },
    },
  },
  responses: {
    201: {
      content: {
        'application/json': {
          schema: createCredentialResponseSchema,
        },
      },
      description: 'Credential created successfully',
    },
    400: {
      content: {
        'application/json': {
          schema: errorResponseSchema,
        },
      },
      description: 'Validation failed',
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
  tags: ['Credentials'],
});

// DELETE /credentials/:id - Delete credential
export const deleteCredentialRoute = createRoute({
  method: 'delete',
  path: '/{id}',
  request: {
    params: z.object({
      id: z
        .string()
        .regex(/^[0-9]+$/)
        .openapi({
          description: 'Credential ID',
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
      description: 'Credential deleted successfully',
    },
    400: {
      content: {
        'application/json': {
          schema: errorResponseSchema,
        },
      },
      description: 'Invalid credential ID format',
    },
    404: {
      content: {
        'application/json': {
          schema: errorResponseSchema,
        },
      },
      description: 'Credential not found',
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
  tags: ['Credentials'],
});

// PUT /credentials/:id - Update credential
export const updateCredentialRoute = createRoute({
  method: 'put',
  path: '/{id}',
  request: {
    params: z.object({
      id: z
        .string()
        .regex(/^[0-9]+$/)
        .openapi({
          description: 'Credential ID',
          example: '123',
        }),
    }),
    body: {
      content: {
        'application/json': {
          schema: updateCredentialSchema,
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: updateCredentialResponseSchema,
        },
      },
      description: 'Credential updated successfully',
    },
    400: {
      content: {
        'application/json': {
          schema: errorResponseSchema,
        },
      },
      description: 'Invalid credential ID format or validation failed',
    },
    404: {
      content: {
        'application/json': {
          schema: errorResponseSchema,
        },
      },
      description: 'Credential not found',
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
  tags: ['Credentials'],
});

// GET /credentials/:id/metadata - Get credential metadata
export const getCredentialMetadataRoute = createRoute({
  method: 'get',
  path: '/{id}/metadata',
  request: {
    params: z.object({
      id: z
        .string()
        .regex(/^[0-9]+$/)
        .openapi({
          description: 'Credential ID',
          example: '123',
        }),
    }),
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: databaseMetadataSchema.nullable(),
        },
      },
      description: 'Credential metadata retrieved successfully',
    },
    400: {
      content: {
        'application/json': {
          schema: errorResponseSchema,
        },
      },
      description: 'Invalid credential ID format',
    },
    404: {
      content: {
        'application/json': {
          schema: errorResponseSchema,
        },
      },
      description: 'Credential not found',
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
  tags: ['Credentials'],
});

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

// ========================= OAuth Routes =========================

// OAuth initiate route - POST /oauth/:provider/initiate
export const oauthInitiateRoute = createRoute({
  method: 'post',
  path: '/{provider}/initiate',
  summary: 'Initiate OAuth flow',
  description: 'Start OAuth authorization flow for a provider',
  request: {
    params: z.object({
      provider: z.string().openapi({ example: 'google' }),
    }),
    body: {
      content: {
        'application/json': {
          schema: oauthInitiateRequestSchema,
        },
      },
      required: false,
    },
  },
  responses: {
    200: {
      description: 'OAuth authorization URL generated',
      content: {
        'application/json': {
          schema: oauthInitiateResponseSchema,
        },
      },
    },
    400: {
      description: 'Bad request',
      content: {
        'application/json': {
          schema: errorResponseSchema,
        },
      },
    },
  },
  tags: ['OAuth'],
});

// OAuth callback route - GET /oauth/:provider/callback
export const oauthCallbackRoute = createRoute({
  method: 'get',
  path: '/{provider}/callback',
  summary: 'Handle OAuth callback',
  description: 'Handle OAuth provider callback and exchange code for tokens',
  request: {
    params: z.object({
      provider: z.string().openapi({ example: 'google' }),
    }),
    query: z.object({
      code: z.string().optional(),
      state: z.string().optional(),
      error: z.string().optional(),
      error_description: z.string().optional(),
    }),
  },
  responses: {
    302: {
      description: 'Redirect to frontend',
    },
    400: {
      description: 'Bad request',
      content: {
        'application/json': {
          schema: errorResponseSchema,
        },
      },
    },
  },
  tags: ['OAuth'],
});

// OAuth callback POST route - POST /oauth/:provider/callback
export const oauthCallbackPostRoute = createRoute({
  method: 'post',
  path: '/{provider}/callback',
  summary: 'Complete OAuth flow',
  description:
    'Complete OAuth flow by exchanging code for tokens and creating credential',
  request: {
    params: z.object({
      provider: z.string().openapi({ example: 'google' }),
    }),
    body: {
      content: {
        'application/json': {
          schema: oauthCallbackRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Credential created successfully',
      content: {
        'application/json': {
          schema: createCredentialResponseSchema,
        },
      },
    },
    400: {
      description: 'Bad request',
      content: {
        'application/json': {
          schema: errorResponseSchema,
        },
      },
    },
  },
  tags: ['OAuth'],
});

// OAuth token refresh route - POST /oauth/:provider/refresh
export const oauthTokenRefreshRoute = createRoute({
  method: 'post',
  path: '/{provider}/refresh',
  summary: 'Refresh OAuth token',
  description: 'Manually refresh an OAuth token',
  request: {
    params: z.object({
      provider: z.string().openapi({ example: 'google' }),
    }),
    body: {
      content: {
        'application/json': {
          schema: z.object({
            credentialId: z.number(),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Token refreshed successfully',
      content: {
        'application/json': {
          schema: oauthTokenRefreshResponseSchema,
        },
      },
    },
    400: {
      description: 'Bad request',
      content: {
        'application/json': {
          schema: errorResponseSchema,
        },
      },
    },
  },
  tags: ['OAuth'],
});

// OAuth revoke route - DELETE /oauth/:provider/revoke/:credentialId
export const oauthRevokeRoute = createRoute({
  method: 'delete',
  path: '/{provider}/revoke/{credentialId}',
  summary: 'Revoke OAuth credential',
  description: 'Revoke OAuth tokens and delete credential',
  request: {
    params: z.object({
      provider: z.string().openapi({ example: 'google' }),
      credentialId: z
        .string()
        .regex(/^\d+$/)
        .transform(Number)
        .openapi({ example: '123' }),
    }),
  },
  responses: {
    200: {
      description: 'Credential revoked successfully',
      content: {
        'application/json': {
          schema: oauthRevokeResponseSchema,
        },
      },
    },
    400: {
      description: 'Bad request',
      content: {
        'application/json': {
          schema: errorResponseSchema,
        },
      },
    },
  },
  tags: ['OAuth'],
});

// ========================= AI Routes =========================

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
