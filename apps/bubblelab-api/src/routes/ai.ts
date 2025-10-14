import { OpenAPIHono } from '@hono/zod-openapi';
import { milkTeaRoute } from '../schemas/routes.js';
import {
  setupErrorHandler,
  validationErrorHook,
} from '../utils/error-handler.js';
import { runMilkTea } from '../services/ai/milktea.js';
import { env } from '../config/env.js';
import { CredentialType } from '../schemas/index.js';

const app = new OpenAPIHono({
  defaultHook: validationErrorHook,
});
setupErrorHandler(app);

app.openapi(milkTeaRoute, async (c) => {
  // const userId = getUserId(c);
  const request = c.req.valid('json');

  // Execute MilkTea agent
  const result = await runMilkTea(request, {
    [CredentialType.GOOGLE_GEMINI_CRED]: env.GOOGLE_API_KEY!,
    [CredentialType.OPENAI_CRED]: env.OPENAI_API_KEY!,
    [CredentialType.OPENROUTER_CRED]: env.OPENROUTER_API_KEY!,
  });

  if (!result.success) {
    return c.json(
      {
        error: result.error || 'MilkTea agent execution failed',
      },
      500
    );
  }

  return c.json(result, 200);
});

export default app;
