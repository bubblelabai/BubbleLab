import { OpenAPIHono } from '@hono/zod-openapi';
import { streamSSE } from 'hono/streaming';
import { milkTeaRoute, pearlRoute } from '../schemas/ai.js';
import {
  setupErrorHandler,
  validationErrorHook,
} from '../utils/error-handler.js';
import { runMilkTea } from '../services/ai/milktea.js';
import { runPearl } from '../services/ai/pearl.js';
import { env } from '../config/env.js';
import { CredentialType } from '../schemas/index.js';
import type { StreamingEvent } from '@bubblelab/shared-schemas';

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

app.openapi(pearlRoute, async (c) => {
  const request = c.req.valid('json');
  const { stream } = c.req.valid('query');

  // If stream is not true, fall back to regular route
  if (!stream) {
    const result = await runPearl(request, {
      [CredentialType.GOOGLE_GEMINI_CRED]: env.GOOGLE_API_KEY!,
      [CredentialType.OPENAI_CRED]: env.OPENAI_API_KEY!,
      [CredentialType.OPENROUTER_CRED]: env.OPENROUTER_API_KEY!,
    });

    if (!result.success) {
      return c.json(
        {
          error: result.error || 'Pearl agent execution failed',
        },
        500
      );
    }

    return c.json(result, 200);
  }

  // Streaming mode
  return streamSSE(c, async (stream) => {
    try {
      const streamingCallback = async (event: StreamingEvent) => {
        await stream.writeSSE({
          data: JSON.stringify(event),
          event: event.type,
          id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        });
      };

      const result = await runPearl(
        request,
        {
          [CredentialType.GOOGLE_GEMINI_CRED]: env.GOOGLE_API_KEY!,
          [CredentialType.OPENAI_CRED]: env.OPENAI_API_KEY!,
          [CredentialType.OPENROUTER_CRED]: env.OPENROUTER_API_KEY!,
        },
        streamingCallback
      );

      // Send final result
      await stream.writeSSE({
        data: JSON.stringify({
          type: 'complete',
          data: {
            result,
            totalDuration: 0, // We don't track duration in Pearl
          },
        }),
        event: 'complete',
      });

      // Send stream completion
      await stream.writeSSE({
        data: JSON.stringify({
          type: 'stream_complete',
          timestamp: new Date().toISOString(),
        }),
        event: 'stream_complete',
      });
    } catch (error) {
      console.error('[API] Pearl streaming error:', error);
      await stream.writeSSE({
        data: JSON.stringify({
          type: 'error',
          error:
            error instanceof Error ? error.message : 'Unknown streaming error',
          recoverable: false,
        }),
        event: 'error',
      });
    }
  });
});

export default app;
