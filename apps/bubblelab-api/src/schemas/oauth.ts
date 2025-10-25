import { createRoute, z } from '@hono/zod-openapi';
import {
  errorResponseSchema,
  oauthInitiateRequestSchema,
  oauthInitiateResponseSchema,
  oauthCallbackRequestSchema,
  oauthTokenRefreshResponseSchema,
  oauthRevokeResponseSchema,
  createCredentialResponseSchema,
} from './index.js';

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
