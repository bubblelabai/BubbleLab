import { createRoute, z } from '@hono/zod-openapi';
import {
  errorResponseSchema,
  credentialResponseSchema,
  createCredentialSchema,
  createCredentialResponseSchema,
  updateCredentialSchema,
  updateCredentialResponseSchema,
  successMessageResponseSchema,
  databaseMetadataSchema,
} from './index.js';

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
