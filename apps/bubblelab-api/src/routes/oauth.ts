import { OpenAPIHono } from '@hono/zod-openapi';
import { getUserId } from '../middleware/auth.js';
import { oauthService } from '../services/oauth-service.js';
import {
  setupErrorHandler,
  validationErrorHook,
} from '../utils/error-handler.js';
import {
  oauthInitiateRoute,
  oauthCallbackRoute,
  oauthCallbackPostRoute,
  oauthTokenRefreshRoute,
  oauthRevokeRoute,
} from '../schemas/oauth.js';
import { type OAuthProvider } from '@bubblelab/shared-schemas';

const app = new OpenAPIHono({
  defaultHook: validationErrorHook,
});
setupErrorHandler(app);

// OAuth initiate route - POST /oauth/:provider/initiate
app.openapi(oauthInitiateRoute, async (c) => {
  const userId = getUserId(c);
  const provider = c.req.param('provider');

  // Get validated request body
  const body = c.req.valid('json');

  if (!provider) {
    return c.json({ error: 'Provider is required' }, 400);
  }

  if (!body.credentialType) {
    return c.json({ error: 'Credential type is required' }, 400);
  }

  try {
    const result = await oauthService.initiateOAuth(
      provider as OAuthProvider,
      userId,
      body.credentialType,
      body.name,
      body.scopes
    );

    return c.json(result, 200);
  } catch (error) {
    console.error('OAuth initiation failed:', error);
    return c.json(
      {
        error:
          error instanceof Error ? error.message : 'OAuth initiation failed',
      },
      400
    );
  }
});

// OAuth callback route - GET /oauth/:provider/callback
app.openapi(oauthCallbackRoute, async (c) => {
  const provider = c.req.param('provider');
  const { code, state, error, error_description } = c.req.valid('query');

  const frontendUrl = process.env.DASHBOARD_URL || 'http://localhost:3000';

  if (!provider) {
    return c.json({ error: 'Provider is required' }, 500);
  }

  // Handle OAuth error responses
  if (error) {
    console.error(`OAuth error from ${provider}:`, error, error_description);
    return c.redirect(
      `${frontendUrl}/credentials?error=${error}&description=${encodeURIComponent(error_description || '')}`
    );
  }

  // Validate required parameters
  if (!code || !state) {
    return c.redirect(`${frontendUrl}/credentials?error=missing_parameters`);
  }

  try {
    const result = await oauthService.handleOAuthCallback(
      provider,
      code,
      state
    );

    // Redirect to frontend with success
    return c.redirect(
      `${frontendUrl}/credentials?success=true&provider=${provider}&credentialId=${result.credentialId}`
    );
  } catch (error) {
    console.error('OAuth callback failed:', error);
    const errorMessage =
      error instanceof Error ? error.message : 'OAuth callback failed';
    return c.redirect(
      `${frontendUrl}/credentials?error=${encodeURIComponent(errorMessage)}`
    );
  }
});

// OAuth callback POST route for frontend completion
app.openapi(oauthCallbackPostRoute, async (c) => {
  const provider = c.req.param('provider');
  const { code, state, name } = c.req.valid('json');

  if (!provider) {
    return c.json({ error: 'Provider is required' }, 400);
  }

  if (!code || !state) {
    return c.json({ error: 'Code and state are required' }, 400);
  }

  try {
    const result = await oauthService.handleOAuthCallback(
      provider,
      code,
      state,
      name
    );

    // Transform result to match expected schema
    return c.json(
      {
        id: result.credentialId,
        message: 'OAuth credential created successfully',
      },
      200
    );
  } catch (error) {
    console.error('OAuth callback failed:', error);
    return c.json(
      {
        error: error instanceof Error ? error.message : 'OAuth callback failed',
      },
      400
    );
  }
});

// OAuth token refresh route - POST /oauth/:provider/refresh
app.openapi(oauthTokenRefreshRoute, async (c) => {
  const { credentialId } = c.req.valid('json');

  try {
    await oauthService.refreshToken(credentialId);
    return c.json({ message: 'Token refreshed successfully' }, 200);
  } catch (error) {
    console.error('Token refresh failed:', error);
    return c.json(
      {
        error: error instanceof Error ? error.message : 'Token refresh failed',
      },
      400
    );
  }
});

// OAuth revoke route - DELETE /oauth/:provider/revoke/:credentialId
app.openapi(oauthRevokeRoute, async (c) => {
  const credentialId = c.req.valid('param').credentialId;

  try {
    await oauthService.revokeCredential(credentialId);
    return c.json({ message: 'Credential revoked successfully' }, 200);
  } catch (error) {
    console.error('Credential revocation failed:', error);
    return c.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Credential revocation failed',
      },
      400
    );
  }
});

export default app;
