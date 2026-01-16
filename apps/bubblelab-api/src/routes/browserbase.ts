import { OpenAPIHono } from '@hono/zod-openapi';
import { createRoute, z } from '@hono/zod-openapi';
import { getUserId } from '../middleware/auth.js';
import { browserbaseService } from '../services/browserbase-service.js';
import {
  setupErrorHandler,
  validationErrorHook,
} from '../utils/error-handler.js';
import {
  browserbaseSessionCreateRequestSchema,
  browserbaseSessionCreateResponseSchema,
  browserbaseSessionCompleteRequestSchema,
  browserbaseSessionCompleteResponseSchema,
  browserbaseSessionReopenRequestSchema,
  browserbaseSessionReopenResponseSchema,
  CredentialType,
} from '@bubblelab/shared-schemas';

const app = new OpenAPIHono({
  defaultHook: validationErrorHook,
});
setupErrorHandler(app);

// Error response schema for OpenAPI
const errorResponseSchema = z.object({
  error: z.string(),
});

// Route definitions
const sessionCreateRoute = createRoute({
  method: 'post',
  path: '/session/create',
  tags: ['BrowserBase'],
  summary: 'Create a browser session for authentication',
  description:
    'Creates a BrowserBase browser session for manual login authentication',
  request: {
    body: {
      content: {
        'application/json': {
          schema: browserbaseSessionCreateRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: browserbaseSessionCreateResponseSchema,
        },
      },
      description: 'Session created successfully',
    },
    400: {
      content: {
        'application/json': {
          schema: errorResponseSchema,
        },
      },
      description: 'Bad request',
    },
  },
});

const sessionCompleteRoute = createRoute({
  method: 'post',
  path: '/session/complete',
  tags: ['BrowserBase'],
  summary: 'Complete browser session and capture credentials',
  description:
    'Captures cookies from the browser session and stores them as a credential',
  request: {
    body: {
      content: {
        'application/json': {
          schema: browserbaseSessionCompleteRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: browserbaseSessionCompleteResponseSchema,
        },
      },
      description: 'Credential captured successfully',
    },
    400: {
      content: {
        'application/json': {
          schema: errorResponseSchema,
        },
      },
      description: 'Bad request',
    },
  },
});

const sessionReopenRoute = createRoute({
  method: 'post',
  path: '/session/reopen',
  tags: ['BrowserBase'],
  summary: 'Reopen existing browser session',
  description:
    'Reopens an existing browser session with stored context for review or re-authentication',
  request: {
    body: {
      content: {
        'application/json': {
          schema: browserbaseSessionReopenRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: browserbaseSessionReopenResponseSchema,
        },
      },
      description: 'Session reopened successfully',
    },
    400: {
      content: {
        'application/json': {
          schema: errorResponseSchema,
        },
      },
      description: 'Bad request',
    },
  },
});

const sessionCloseRoute = createRoute({
  method: 'post',
  path: '/session/close',
  tags: ['BrowserBase'],
  summary: 'Close a browser session',
  description: 'Closes/releases a BrowserBase session',
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            sessionId: z.string(),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            message: z.string(),
          }),
        },
      },
      description: 'Session closed successfully',
    },
    400: {
      content: {
        'application/json': {
          schema: errorResponseSchema,
        },
      },
      description: 'Bad request',
    },
  },
});

// POST /browserbase/session/create
app.openapi(sessionCreateRoute, async (c) => {
  const userId = getUserId(c);
  const { credentialType, name } = c.req.valid('json');

  if (!browserbaseService.isConfigured()) {
    return c.json(
      { error: 'BrowserBase is not configured on this server' },
      400
    );
  }

  try {
    const result = await browserbaseService.createSession(
      userId,
      credentialType as CredentialType,
      name
    );

    return c.json(
      {
        sessionId: result.sessionId,
        debugUrl: result.debugUrl,
        contextId: result.contextId,
        state: result.state,
      },
      200
    );
  } catch (error) {
    console.error('[BrowserBase] Session creation failed:', error);
    return c.json(
      {
        error:
          error instanceof Error ? error.message : 'Failed to create session',
      },
      400
    );
  }
});

// POST /browserbase/session/complete
app.openapi(sessionCompleteRoute, async (c) => {
  const { state, name } = c.req.valid('json');

  try {
    const result = await browserbaseService.completeSession(state, name);

    return c.json(
      {
        id: result.credentialId,
        message: 'Browser session credential created successfully',
      },
      200
    );
  } catch (error) {
    console.error('[BrowserBase] Session completion failed:', error);
    return c.json(
      {
        error:
          error instanceof Error ? error.message : 'Failed to complete session',
      },
      400
    );
  }
});

// POST /browserbase/session/reopen
app.openapi(sessionReopenRoute, async (c) => {
  const userId = getUserId(c);
  const { credentialId } = c.req.valid('json');

  if (!browserbaseService.isConfigured()) {
    return c.json(
      { error: 'BrowserBase is not configured on this server' },
      400
    );
  }

  try {
    const result = await browserbaseService.reopenSession(userId, credentialId);

    return c.json(
      {
        sessionId: result.sessionId,
        debugUrl: result.debugUrl,
      },
      200
    );
  } catch (error) {
    console.error('[BrowserBase] Session reopen failed:', error);
    return c.json(
      {
        error:
          error instanceof Error ? error.message : 'Failed to reopen session',
      },
      400
    );
  }
});

// POST /browserbase/session/close
app.openapi(sessionCloseRoute, async (c) => {
  const { sessionId } = c.req.valid('json');

  if (!browserbaseService.isConfigured()) {
    return c.json(
      { error: 'BrowserBase is not configured on this server' },
      400
    );
  }

  try {
    await browserbaseService.closeSession(sessionId);
    return c.json({ message: 'Session closed successfully' }, 200);
  } catch (error) {
    console.error('[BrowserBase] Session close failed:', error);
    return c.json(
      {
        error:
          error instanceof Error ? error.message : 'Failed to close session',
      },
      400
    );
  }
});

export default app;
